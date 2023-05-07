import * as THREE from 'three';
import * as lil from 'lil-gui';
import * as Utils from './Utils';

export class CoralGenerator {
    // Attractor parameters
    public attractors: THREE.Vector3[] = [];
    public attractorCount: number = 1;
    public attractorStrength: number = 1.0;
    public attractorKillRange: number = 0.1;
    public attractorRadius: number = 3;

    // Growth parameters
    public startPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    public branchLength: number = 0.05;
    public timeBetweenIterations: number = 0.1;
    public randomGrowth: number = 0.5;
    public minEnergy: number = 0.001;

    // Geometry parameters
    public radialSegments: number = 20;
    public extremitiesSize: number = 0.05;

    // Internal variables    
    private activeAttractors: number[] = [];
    private branches: Branch[] = [];
    private extremities: Branch[] = [];
    private numRemainingAttractors: number = 0;
    private timeSinceLastIteration: number = 0;

    public geometry: THREE.BufferGeometry;

    // Environment
    public environment: Environment;

    constructor() {
        this.GenerateAttractors();
        this.geometry = new THREE.BufferGeometry();
        this.environment = new Environment();
        this.init();
    }

    init() {
        let closestAttr = null;
        let closestDist = 1000;

        // Generate k first branches based on attractors
        this.attractors.every((attractor) => {
            let dist = attractor.distanceTo(this.startPosition);
            if (dist < this.attractorStrength * 3.0) {
                let start = this.startPosition.clone();
                let direction = attractor.clone().sub(this.startPosition);
                direction.add(Utils.RandomInHemisphere(this.randomGrowth));
                direction.add(this.environment.CalculateSeaCurrentImpact(start));
                direction.normalize();
                let end = start.clone().add(direction.multiplyScalar(this.branchLength));
                let branch = new Branch(start, end, direction, null, this.extremitiesSize, 1.0);
                this.branches.push(branch);
            }
            if (dist < closestDist) {
                closestDist = dist;
                closestAttr = attractor;
            }
            if (this.branches.length > 10) return false;
            return true;
        });

        if (this.branches.length == 0) {
            let direction = closestAttr.clone().sub(this.startPosition);
            direction.normalize();
            let branch = new Branch(this.startPosition, direction.multiplyScalar(this.branchLength), direction, null, this.extremitiesSize, 1.0);
            this.branches.push(branch);
        }
    }

    update(delta: number) {
        this.timeSinceLastIteration += delta;
        if (this.timeSinceLastIteration >= this.timeBetweenIterations) {
            this.timeSinceLastIteration = 0;

            // Set branches with no children as new extremities
            this.extremities = this.branches.filter((branch) => branch.children.length == 0);
            this.extremities.forEach((extrem) => extrem.grown = true);

            // Remove attractors in kill range and add energy to branches
            for (let i = this.attractors.length-1; i >= 0 ; i--) {
                this.branches.every((branch) => {
                    if (branch.end.distanceTo(this.attractors[i]) < this.attractorKillRange) {
                        branch.energy *= 1.5;
                        this.attractors.splice(i, 1);
                        this.numRemainingAttractors--;
                        console.log("Killed attractor");
                        // If attractor is killed, stop
                        return false;
                    }
                    // If attractor is not killed, continue
                    return true;
                });
            }

            if (this.numRemainingAttractors > 0) { this.Grow(); }
        }
    }

    GenerateAttractors() {
        this.attractors = [];
        this.activeAttractors = [];
        for (let i = 0; i < this.attractorCount; i++) {
            let attractor = Utils.RandomInHemisphere(this.attractorRadius);
            this.attractors.push(attractor);
        }
        this.numRemainingAttractors = this.attractors.length;
    }

    GenerateMesh() {
        // Create a line for each branch
        let tubes: THREE.Mesh[] = [];
        this.branches.forEach((branch) => {
            let spline = new THREE.CatmullRomCurve3([
                branch.start,
                branch.end
            ]);
            const geometry = new THREE.TubeGeometry(spline, 1, branch.size, 30, false);
            geometry.computeVertexNormals();
            const material = new THREE.MeshPhongMaterial({color: 0xff4040, side: THREE.DoubleSide});
            const tube = new THREE.Mesh(geometry, material);
            tube.castShadow = true;
            tube.receiveShadow = true;

            tubes.push(tube);
        });
        return  tubes;
    }

    GenerateMesh2() {
        let vertices = new Float32Array((this.branches.length + 1) * this.radialSegments * 3);
        let indices = new Uint32Array(this.branches.length * this.radialSegments * 6);

        // Construct vertices
        for (let i = 0; i < this.branches.length; i++) {
            this.branches[i].verticesId = i * this.radialSegments;

            // Quaternion rotation
            let quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.branches[i].direction.normalize());

            for (let s = 0; s < this.radialSegments; s++) {
                let angle = s * 2 * Math.PI / this.radialSegments;
                
                let x = Math.cos(angle);
                let y = Math.sin(angle);
                let radius = this.branches[i].GetRadius(new THREE.Vector3(x, 0, y));
                let vertex = new THREE.Vector3(x * radius, 0, y * radius);
                vertex.applyQuaternion(quaternion);

                vertex.add(this.branches[i].end);
                vertex.sub(this.startPosition);
                
                vertices[i * this.radialSegments * 3 + s * 3] = vertex.x;
                vertices[i * this.radialSegments * 3 + s * 3 + 1] = vertex.y;
                vertices[i * this.radialSegments * 3 + s * 3 + 2] = vertex.z;

                if (this.branches[i].parent == null) {
                    vertices[this.branches.length * this.radialSegments * 3 + s * 3] = this.branches[i].start.x + Math.cos(angle) * this.branches[i].size;
                    vertices[this.branches.length * this.radialSegments * 3 + s * 3 + 1] = this.branches[i].start.y;
                    vertices[this.branches.length * this.radialSegments * 3 + s * 3 + 2] = this.branches[i].start.z + Math.sin(angle) * this.branches[i].size;
                }
            }
        }

        for (let i = 0; i < this.branches.length; i++) {
            let fid = i * this.radialSegments * 6;
            let bid = this.branches[i].parent != null ? this.branches[i].parent.verticesId : this.branches.length * this.radialSegments;
            let tid = this.branches[i].verticesId;

            for (let s = 0; s < this.radialSegments; s++) {
                indices[fid + s * 6] = bid + s;
                indices[fid + s * 6 + 1] = tid + s;

                if (s == this.radialSegments - 1) {
                    indices[fid + s * 6 + 2] = tid;
                    indices[fid + s * 6 + 3] = bid+s;
                    indices[fid + s * 6 + 4] = tid;
                    indices[fid + s * 6 + 5] = bid;
                } else {
                    indices[fid + s * 6 + 2] = tid + s + 1;
                    indices[fid + s * 6 + 3] = bid + s;
                    indices[fid + s * 6 + 4] = tid + s + 1;
                    indices[fid + s * 6 + 5] = bid + s + 1;
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        const material = new THREE.MeshPhongMaterial({color: 0xff4040, side: THREE.DoubleSide});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    CreateGUI(gui: lil.GUI) {
        // Create attractor folder
        const attractorFolder = gui.addFolder('Attractors');
        attractorFolder.open();
        attractorFolder.add(this, 'attractorCount', 0, 300, 1).onChange(() => { this.Reset() });
        attractorFolder.add(this, 'attractorRadius', 0, 10, 0.1).onChange(() => { this.Reset() });
        attractorFolder.add(this, 'attractorStrength', 0, 10, 0.1).onChange(() => { this.Reset() });
        attractorFolder.add(this, "attractorKillRange", 0, 10, 0.1).onChange(() => { this.Reset() });

        this.environment.CreateEnvGui(gui, this.Reset.bind(this));
    }

    Reset() {
        this.geometry.dispose();

        this.GenerateAttractors();
        this.geometry = new THREE.BufferGeometry();
        this.branches = [];
        this.environment = new Environment();
        this.init();

    }

    private Grow() {
        // We grow one iteration of all branches

        // Clear active attractors
        this.activeAttractors = [];
        this.branches.forEach((b) => b.attractors = []);

        // Associate each attractor with a branch
        this.attractors.forEach((attractor, index) => {
            let minDist = Infinity;
            let minBranch : Branch | undefined = undefined;
            this.branches.forEach((branch) => {
                let dist = branch.end.distanceTo(attractor);
                if (dist < minDist && dist < this.attractorStrength) {
                    minDist = dist;
                    minBranch = branch;
                }
            });

            if (minBranch != null) {
                minBranch.attractors.push(attractor);
                this.activeAttractors.push(index);
            }
        });


        // If at least an attraction point is found, we grow the mesh
        if (this.activeAttractors.length > 0) {
            // Clear extremities list because new will be set
            this.extremities = [];

            // New branches list
            let newBranches: Branch[] = [];

            // Create new branches in all attractor directions but only if the branch has enough energy and space
            this.branches.forEach((branch) => {
                if (branch.attractors.length > 0 && branch.energy > this.minEnergy) {
                    // Create new branch in all attractor directions
                    for (let i = 0; i < branch.attractors.length; i++) {
                    };
                    // Compute new direction
                    let newDirection = new THREE.Vector3(0, 0, 0);
                    
                    branch.attractors.forEach((attractor) => {
                        let direction = attractor.clone().sub(branch.end);
                        newDirection.add(direction.normalize());
                    });


                    newDirection.multiplyScalar(1/branch.attractors.length);
                    newDirection.add(Utils.RandomInHemisphere(this.randomGrowth));
                    newDirection.normalize();
                    let seaCurrent = this.environment.CalculateSeaCurrentImpact(branch.start);
                    newDirection.add(seaCurrent);

                    // Compute new end position
                    let newEnd = branch.end.clone().add(newDirection.multiplyScalar(this.branchLength));
                    newDirection.normalize();

                    // Create new branch
                    let newBranch = new Branch(branch.end, newEnd, newDirection, branch, this.extremitiesSize, branch.energy * 0.75);
                    branch.energy *= 0.75;

                    newBranch.distanceFromRoot = branch.distanceFromRoot + 1;
                    newBranches.push(newBranch);

                    // Add new branch to children
                    branch.children.push(newBranch);

                    // Add new branch to extremities list
                    this.extremities.push(newBranch);
                }
            });
            this.branches.push(...newBranches);
        }
        else {
            // Otherwise, we just grow the edges of the mesh but we must expend energy
            this.extremities.forEach((extrem) => {
                if (extrem.energy/2 > this.minEnergy) {
                    let start = extrem.end;
                    let dir = extrem.direction.clone();
                    dir = dir.add(Utils.RandomInSphere(this.randomGrowth));
                    dir.add(this.environment.CalculateSeaCurrentImpact(start));
                    let end = extrem.end.clone().add(dir.multiplyScalar(this.branchLength));
                    dir.normalize();
                    let newBranch = new Branch(start, end, dir, extrem, this.extremitiesSize, extrem.energy/2);

                    extrem.energy /= 2;

                    // Add child to parent
                    extrem.children.push(newBranch);

                    // Add new branch to extremities list
                    this.branches.push(newBranch);
                    this.extremities.push(newBranch);
                }
            });
            console.log(this.branches);
        }


    }
}

class Branch {
    public start: THREE.Vector3;
    public end: THREE.Vector3;
    public direction: THREE.Vector3;
    public parent : Branch | null;
    public size: number;
    public children: Branch[] = [];
    public attractors: THREE.Vector3[] = [];
    public verticesId : number = 0;

    // Remaining energy
    public energy : number;

    constructor(
            start : THREE.Vector3, end : THREE.Vector3, direction : THREE.Vector3, 
            parent : Branch | null =null, 
            size : number = 0.05,
            energy : number = 1) {

        this.start = start;
        this.end = end;
        this.direction = direction;
        this.parent = parent;
        this.size = size;
        this.energy = energy;
    }

    GetRadius(dir: THREE.Vector3) {
        // Radius will be computer based on the  the directions of children
        if (this.children.length == 0) {
            return this.size;
        }
        // Find child with the closest direction to the given x, y
        let closestChild = null;
        let closestAngle = 1000;
        for (let i = 0; i < this.children.length; i++) {
            let angle = dir.angleTo(this.children[i].direction);
            if (angle < closestAngle) {
                closestAngle = angle;
                closestChild = this.children[i];
            }
        }
        
        // Add offset based on the angle between the closest child and the given x, y
        return this.size + Math.sin(closestAngle) * closestChild.size;
    }


}

class Environment {

    public seaCurrent : THREE.Vector3 = new THREE.Vector3(1, 0, 1);
    public seaCurrentSpeed : number = 0.4;
    public seaCurrentTemperature : number = 0;
    public lightDirection : THREE.Vector3 = new THREE.Vector3(0, 0, 0);


    
    constructor() {
    }

    CreateEnvGui(gui : lil.GUI, reset : () => void) {
        let folder = gui.addFolder("Environment");
        folder.add(this.seaCurrent, "x", -1, 1, 0.01).onChange(reset);
        folder.add(this.seaCurrent, "y", -1, 1, 0.01).onChange(reset);
        folder.add(this.seaCurrent, "z", -1, 1, 0.01).onChange(reset);
        folder.add(this, "seaCurrentSpeed", 0, 10, 0.01).onChange(reset);
    }


    CalculateSeaCurrentImpact(position: THREE.Vector3) {
        /**
         * Sea current will be defined with a line and speed and temperature.
         * With increasing distance from the line, the speed will decrease and some minor noise will be added.
         */

        // Compute direction
        let direction = this.seaCurrent.clone()
        direction.normalize()
        direction.multiplyScalar(this.seaCurrentSpeed);

        // Multiply by depth
        return direction;
    }

    CalculateLightImpact(position: THREE.Vector3) {
        /**
         * Light should also decrease with depth, but most importantly,
         * check if there is occlusion from position to light.
         * 
         * if there is occlusion, search for the closest point to the light
         * that is not occluded, and use that as the growth direction
         */
    }

    CalculateTemperatureImpact(position: THREE.Vector3) {
        /**
         * Temperature should decrease with distance from the surface and the sea current.
         * 
         * We will define a temperature gradient from surface to floor.
         */
    }
}