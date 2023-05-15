import * as THREE from 'three';
import * as lil from 'lil-gui';
import * as Utils from './Utils';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

enum AttractorShape {
    Sphere,
    Hemisphere,
    Cone,
    Cylinder,
    Cuboid,
    Torus,
}

export class CoralGenerator {
    // Attractor parameters
    public attractors: THREE.Vector3[] = [];
    public attractorCount: number = 100;
    public attractorStrength: number = 1.0;
    public attractorKillRange: number = 0.1;
    public attractorRadius: number = 3;
    public attractorFood: number = 0.5;

    // Sampling parameters
    public attractorShape: SamplingShape = SamplingShape.Sphere;

    // Growth parameters
    public startPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    public branchLength: number = 0.05;
    public timeBetweenIterations: number = 0.1;
    public randomGrowth: number = 0.5;
    public branchingProbability: number = 0.000000001;
    public maxBranchingAngle: number = 0.5;
    public minEnergy: number = 0.001;

    // Geometry parameters
    public radialSegments: number = 12;
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
                direction.add(this.environment.CalculateSeaCurrentImpact());

                direction.normalize();
                direction.multiplyScalar(this.branchLength);

                let end = start.clone().add(direction);
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
                        branch.energy += this.attractorFood;
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

    GenerateMeshFromVerts() {
        let vertices = new Float32Array((this.branches.length + 1) * this.radialSegments * 3);
        let indices = new Uint32Array(this.branches.length * this.radialSegments * 6);

        // Construct vertices
        for (let i = 0; i < this.branches.length; i++) {
            this.branches[i].verticesId = i * this.radialSegments;

            // Quaternion rotation to align branch with its direction
            let quaternion = new THREE.Quaternion();
            let dir = this.branches[i].direction.clone();
            let norm = new THREE.Vector3(0, 1, 0);
            dir.normalize();
            // Check if same hemisphere
            quaternion.setFromUnitVectors(norm, this.branches[i].direction);

            for (let s = 0; s < this.radialSegments; s++) {
                let angle = s * 2 * Math.PI / this.radialSegments;
                
                let x = Math.cos(angle);
                let y = Math.sin(angle);
                let radius = this.branches[i].GetRadius(new THREE.Vector3(x, 0, y));
                radius += this.environment.CalculateTemperatureImpact(this.branches[i].end, this.attractors);
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

        let geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();
        
        geometry = BufferGeometryUtils.mergeVertices(geometry);

        const material = new THREE.MeshPhongMaterial({color: 0xff4c00, side: THREE.DoubleSide, wireframe: false});
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    GenerateLineFromVerts() {
        let lineSegments = new THREE.LineSegments();
        this.branches.forEach(branch => {
            let geometry = new THREE.BufferGeometry();
            let vertices = new Float32Array(2 * 3);
            vertices[0] = branch.start.x;
            vertices[1] = branch.start.y;
            vertices[2] = branch.start.z;
            vertices[3] = branch.end.x;
            vertices[4] = branch.end.y;
            vertices[5] = branch.end.z;
            geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geometry.computeVertexNormals();
            let material = new THREE.LineBasicMaterial({color: 0xff0000});
            let line = new THREE.Line(geometry, material);
            lineSegments.add(line);
        });
        return lineSegments;
    }

    GenerateTubeFromVerts() {
        let curve = new THREE.CatmullRomCurve3(this.branches.map(branch => branch.end));
        let geometry = new THREE.TubeGeometry(curve, this.branches.length * 10, 0.1, 8, false);
        let material = new THREE.MeshPhongMaterial({color: 0xff0000});
        let mesh = new THREE.Mesh(geometry, material);
        return mesh;
    }


    CreateGUI(gui: lil.GUI) {
        // Create attractor folder
        const attractorFolder = gui.addFolder('Attractors');
        attractorFolder.open();
        attractorFolder.add(this, 'attractorCount', 0, 10000, 1).name("Count").onChange(() => { this.Reset() });
        attractorFolder.add(this, 'attractorRadius', 0, 10, 0.1).name("Sample Radius").onChange(() => { this.Reset() });
        attractorFolder.add(this, 'attractorStrength', 0, 10, 0.1).name("Influence Radius").onChange(() => { this.Reset() });
        attractorFolder.add(this, "attractorKillRange", 0, 10, 0.1).name("Kill Radius").onChange(() => { this.Reset() });
        attractorFolder.add(this, "attractorFood", 0, 2, 0.1).name("Food").onChange(() => { this.Reset() });



        this.environment.CreateEnvGui(gui, this.Reset.bind(this));
    }

    Reset() {
        this.geometry.dispose();

        this.GenerateAttractors();
        this.geometry = new THREE.BufferGeometry();
        this.branches = [];
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
                    // Sort branch attractors by distance
                    branch.attractors.sort((a, b) => { return branch.end.distanceTo(a) - branch.end.distanceTo(b) });
                    // Grow initial branch
                    let newBranch = this.GrowBranch(branch, branch.attractors[0]);
                    branch.energy *= 0.75;
                    newBranches.push(newBranch);
                    // Add new branch to children
                    branch.children.push(newBranch);
                    // Add new branch to extremities list
                    this.extremities.push(newBranch);

                    // Grow additional branches in direction of other attractors with decreasing probability
                    let prob = this.branchingProbability;
                    for (let i=1; i < branch.attractors.length; i++) {
                        if (Math.random() < prob && branch.energy > this.minEnergy) {
                            let newBranch = this.GrowBranch(branch, branch.attractors[i]);
                            branch.energy *= 0.75;
                            newBranches.push(newBranch);
                            // Add new branch to children
                            branch.children.push(newBranch);
                            // Add new branch to extremities list
                            this.extremities.push(newBranch);
                            prob *= this.branchingProbability;
                        }
                    }
                }
            });
            this.branches.push(...newBranches);
        } else {
            // Otherwise, we just grow the edges of the mesh but we must expend energy
            this.extremities.forEach((extrem) => {
                if (extrem.energy/2 > this.minEnergy) {
                    let start = extrem.end;
                    let dir = extrem.direction.clone();
                    dir = dir.add(Utils.RandomInSphere(this.randomGrowth));
                    dir.add(this.environment.CalculateSeaCurrentImpact());
                    dir.normalize();
                    dir.multiplyScalar(this.branchLength);
                    
                    let end = extrem.end.clone().add(dir);
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
            // console.log(this.branches);
        }
    }

    private GrowBranch(branch: Branch, attractor: THREE.Vector3) {
        // Compute new direction
        let newDirection = attractor.clone().sub(branch.end);
        newDirection.normalize();
        newDirection.add(Utils.RandomInHemisphere(this.randomGrowth));
        newDirection.add(this.environment.CalculateSeaCurrentImpact());
        newDirection.normalize();
        newDirection.multiplyScalar(this.branchLength);

        // Smoothen direction with parent direction
        let smoothingFactor = 0.1;
        let parentDirection = branch.direction.clone();
        parentDirection.multiplyScalar(smoothingFactor);
        newDirection.normalize();
        newDirection.multiplyScalar(1-smoothingFactor);
        
        newDirection.normalize();
        newDirection.multiplyScalar(this.branchLength);

        // Compute new end position
        let newEnd = branch.end.clone().add(newDirection);
        newDirection.normalize();

        // Create new branch
        let newBranch = new Branch(branch.end, newEnd, newDirection, branch, this.extremitiesSize, branch.energy * 0.75);
        return newBranch;
    }


    private SampleShape() {
        switch (this.attractorShape) {
            case SamplingShape.Sphere:
                return Utils.RandomInSphere(this.shapeProperties);
            case SamplingShape.Cuboid:
                return Utils.RandomInCube(this.shapeSize);
            case SamplingShape.Cone:
                return Utils.RandomInCone(this.shapeSize);
            case SamplingShape.Cylinder:
                return Utils.RandomInCylinder(this.shapeSize);
        }
    }

    private CreateObstacleMesh() {
        let geometry = new THREE.SphereGeometry( 0.5, 32, 32 );
        let material = new THREE.MeshBasicMaterial( {color: 0xffff00} );
        let sphere = new THREE.Mesh( geometry, material );
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
        let radius = this.size + closestAngle * 0.05;

        // Smoothen the radius with the parent radius if there is one
        if (this.parent != null) {
            let smoothingFactor = 0.5;
            let parentRadius = this.parent.GetRadius(this.direction);
            radius = radius * (1-smoothingFactor) + parentRadius * smoothingFactor;
        }
        
        // Add offset based on the angle between the closest child and the given x, y
        return radius;
    }


}

class Environment {

    public seaCurrent : THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    public seaCurrentSpeed : number = 0.4;
    public seaCurrentTemperature : number = 0;
    
    public lightDirection : THREE.Vector3 = new THREE.Vector3(0, 0, 0);

    public temperatureInfluence : number = 0.01;


    
    constructor() {
    }

    CreateEnvGui(gui : lil.GUI, reset : () => void) {
        let folder = gui.addFolder("Environment");
        folder.add(this.seaCurrent, "x", -1, 1, 0.01).onChange(reset);
        folder.add(this.seaCurrent, "y", -1, 1, 0.01).onChange(reset);
        folder.add(this.seaCurrent, "z", -1, 1, 0.01).onChange(reset);
        folder.add(this, "seaCurrentSpeed", 0, 1, 0.01).name("Sea Current Influence").onChange(reset);
        folder.add(this, "temperatureInfluence", 0, 1, 0.01).name("Temperature Influence").onChange(reset);

    }


    CalculateSeaCurrentImpact() {
        /**
         * We define Sea Current Simply as 
         */

        // Compute direction
        let direction = this.seaCurrent.clone()
        direction.normalize()
        direction.multiplyScalar(this.seaCurrentSpeed);

        // Multiply by depth
        return direction;
    }

    CalculateGravityImpact() {

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

    CalculateTemperatureImpact(position: THREE.Vector3, attractors : THREE.Vector3[]) {
        /**
         * Temperature should decrease with distance from the surface and should impact the size of the branches.
         */

        let depth = position.y;
        
        // Get the topmost attractor
        let topAttractor = attractors[0];
        let topAttractorDepth = topAttractor.y;
        attractors.forEach((attractor) => {
            if (attractor.y > topAttractorDepth) {
                topAttractor = attractor;
                topAttractorDepth = attractor.y;
            }
        });

        // Compute temperature
        let temperature = THREE.MathUtils.mapLinear(depth, -1.0, topAttractorDepth, 0.0, 1.0);

        return temperature * this.temperatureInfluence;
    }
}

class SamplingShape {

    public reset : () => void;
    public shapeType : AttractorShape;
    private radius : number = 1;
    private height : number = 1;
    private width : number = 1;
    private depth : number = 1;
    private normal : THREE.Vector3 = new THREE.Vector3(0, 1, 0);
    


    constructor(shapeType : AttractorShape, reset : () => void) {
        this.reset = reset;
        this.shapeType = shapeType;
    }

    updateGUI(gui : lil.GUI, reset : () => void) {
        let folder = gui.addFolder("Sampling Shape");
        folder.add(this, "shapeType", AttractorShape.Sphere, AttractorShape.Hemisphere, 1).onChange(reset);
        folder.add(this, "radius", 0, 1, 0.01).onChange(reset);
        folder.add(this, "height", 0, 1, 0.01).onChange(reset);
        folder.add(this, "width", 0, 1, 0.01).onChange(reset);
        folder.add(this, "depth", 0, 1, 0.01).onChange(reset);
        folder.add(this.normal, "x", -1, 1, 0.01).onChange(reset);
        folder.add(this.normal, "y", -1, 1, 0.01).onChange(reset);
        folder.add(this.normal, "z", -1, 1, 0.01).onChange(reset);
    }

    public SampleShape() {
        switch (this.shapeType) {
            case AttractorShape.Sphere:
                return Utils.RandomInSphere(this.radius);
            case AttractorShape.Hemisphere:
                return Utils.RandomInHemisphere(this.radius);
            case AttractorShape.Cuboid:
                return Utils.RandomInCuboid(this.width, this.height, this.depth);
            case AttractorShape.Cone:
                return Utils.RandomInCone(this.radius, this.height, this.normal);
            case AttractorShape.Cylinder:
                return Utils.RandomInCylinder(this.radius, this.height, this.normal);
        }
        return new THREE.Vector3(0, 0, 0);
    }

}