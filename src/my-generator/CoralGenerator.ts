import * as THREE from 'three';

import * as Utils from './Utils';

export class CoralGenerator {
    // Generation parameters
    public numAttractors: number = 1;
    public radius: number = 3;
    public startPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    public branchLength: number = 0.1;
    public timeBetweenIterations: number = 0.01;
    public attractorRadius: number = 0.3;
    public killRange: number = 0.1;
    public randomGrowth: number = 0.1;

    // Geometry parameters
    public radialSegments: number = 20;
    public extremitiesSize: number = 0.01;
    public invertGrowth: number = 1.0;

    // Internal variables
    public attractors: THREE.Vector3[] = [];
    private activeAttractors: number[] = [];

    private rootBranch: Branch | undefined = undefined;
    private branches: Branch[] = [];
    private extremities: Branch[] = [];
    private timeSinceLastIteration: number = 0;

    public geometry: THREE.BufferGeometry;

    constructor() {
        this.GenerateAttractors();
        this.geometry = new THREE.BufferGeometry();
        this.init();
    }

    init() {
        // Generate k first branches based on attractors
        this.attractors.every((attractor) => {
            if (attractor.distanceTo(this.startPosition) < this.attractorRadius * 3) {
                let direction = attractor.clone().sub(this.startPosition).normalize();
                let branch = new Branch(this.startPosition, direction.multiplyScalar(this.branchLength), direction);
                this.branches.push(branch);
            }
            return this.branches.length < 10;
        });
    }

    update(delta: number) {
        this.timeSinceLastIteration += delta;
        if (this.timeSinceLastIteration >= this.timeBetweenIterations) {
            this.timeSinceLastIteration = 0;

            // Set branches with no children as new extremities
            this.extremities = this.branches.filter((branch) => branch.children.length == 0);

            this.extremities.forEach((extrem) => extrem.grown = true);

            // Remove attractors in kill range
            for (let i = this.attractors.length-1; i >= 0 ; i--) {
                this.branches.every((branch) => {
                    if (branch.end.distanceTo(this.attractors[i]) < this.killRange) {
                        this.attractors.splice(i, 1);
                        this.numAttractors--;
                        console.log("Killed attractor");
                        // If attractor is killed, stop
                        return false;
                    }
                    // If attractor is not killed, continue
                    return true;
                });
            }

            if (this.numAttractors > 0) {
                // Clear active attractors
                this.activeAttractors = [];
                this.branches.forEach((b) => b.attractors = []);

                // Associate each attractor with a branch
                this.attractors.forEach((attractor, index) => {
                    let minDist = Infinity;
                    let minBranch : Branch | undefined = undefined;
                    this.branches.forEach((branch) => {
                        let dist = branch.end.distanceTo(attractor);
                        if (dist < minDist && dist < this.attractorRadius) {
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

                    // Grow each branch
                    this.branches.forEach((branch) => {
                        if (branch.attractors.length > 0) {
                            // Compute new direction
                            let newDirection = new THREE.Vector3(0, 0, 0);
                            branch.attractors.forEach((attractor) => {
                                let direction = attractor.clone().sub(branch.end);
                                newDirection.add(direction.normalize());
                            });
                            newDirection.multiplyScalar(1/branch.attractors.length);
                            newDirection.add(Utils.RandomInSphere(this.randomGrowth));
                            newDirection.normalize();

                            // Compute new end position
                            let newEnd = branch.end.clone().add(newDirection.multiplyScalar(this.branchLength));

                            // Create new branch
                            let newBranch = new Branch(branch.end, newEnd, newDirection, branch);
                            newBranch.distanceFromRoot = branch.distanceFromRoot + 1;
                            newBranches.push(newBranch);

                            // Add new branch to children
                            branch.children.push(newBranch);

                            // Add new branch to extremities list
                            this.extremities.push(newBranch);
                        } else {
                            if (branch.children.length == 0) {
                                this.extremities.push(branch);
                            }
                        }
                    });
                    this.branches.push(...newBranches);
                }
                else {
                    // Otherwise, we just grow the edges of the mesh
                    this.extremities.forEach((extrem) => {
                        let start = extrem.end;
                        let dir = extrem.direction.clone();
                        dir = dir.add(Utils.RandomInSphere(this.randomGrowth));
                        let end = extrem.end.clone().add(dir.multiplyScalar(this.branchLength));
                        dir = dir.normalize();
                        let newBranch = new Branch(start, end, dir, extrem);

                        // Add child to parent
                        extrem.children.push(newBranch);

                        // Add new branch to extremities list
                        this.branches.push(newBranch);
                        this.extremities.push(newBranch);
                    });
                    console.log(this.branches);
                }
            }
        }
        this.GenerateMesh();
    }

    GenerateAttractors() {
        this.attractors = [];
        this.activeAttractors = [];
        for (let i = 0; i < this.numAttractors; i++) {
            let attractor = Utils.RandomInHemisphere(1.5);
            this.attractors.push(attractor);
        }
    }

    GenerateMesh() {
        // Compute each branch size
        //this.branches.forEach((branch) => { branch.size = this.extremitiesSize; });
        for (let i = this.branches.length - 1; i >= 0; i--) {
            let size = 0;
            if (this.branches[i].children.length == 0) {
                size = this.extremitiesSize;
            } else {
                this.branches[i].children.forEach((child) => {
                    size += Math.pow(child.size, this.invertGrowth);
                });
                size = Math.pow(size, 1/this.invertGrowth);
            }
            this.branches[i].size = size;
        }

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


        // Compute each branch size
        for (let i = this.branches.length - 1; i >= 0; i--) {
            let size = 0;
            if (this.branches[i].children.length == 0) {
                size = this.extremitiesSize;
            } else {
                this.branches[i].children.forEach((child) => {
                    size += Math.pow(child.size, this.invertGrowth);
                });
                size = Math.pow(size, 1/this.invertGrowth);
            }
            this.branches[i].size = size;
        }

        // Construct vertices
        for (let i = 0; i < this.branches.length; i++) {
            this.branches[i].verticesId = i * this.radialSegments;

            // Quaternion rotation
            let quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.branches[i].direction);

            for (let s = 0; s < this.radialSegments; s++) {
                let angle = s * 2 * Math.PI / this.radialSegments;

                let vertex = new THREE.Vector3(Math.cos(angle) * this.branches[i].size, 0, Math.sin(angle) * this.branches[i].size);
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
}

class Branch {
    public start: THREE.Vector3;
    public end: THREE.Vector3;
    public direction: THREE.Vector3;
    public parent : Branch | null;
    // @ts-ignore
    public size: number;
    // @ts-ignore
    public lastSize: number;
    public children: Branch[] = [];
    // @ts-ignore
    public attractors: THREE.Vector3[];
    // @ts-ignore
    public verticesId : number;
    public distanceFromRoot: number = 0;
    // @ts-ignore
    public grown: boolean;

    constructor(start : THREE.Vector3, end : THREE.Vector3, direction : THREE.Vector3, parent : Branch | null =null) {
        this.start = start;
        this.end = end;
        this.direction = direction;
        this.parent = parent;
    }
}

class Environment {


    
    constructor() {
    }


    CalculateSeaCurrentImpact(position: THREE.Vector3) {
        /**
         * Sea current will be defined with a line and speed and temperature.
         * With increasing distance from the line, the speed will decrease and some minor noise will be added.
         */

        // Compute depth
        let depth = 100 - position.y;

        // Compute direction
        let direction = new THREE.Vector3(0, 0, 1);

        // Add noise
        direction.add(Utils.RandomInSphere(0.1));
        direction.normalize();

        // Multiply by depth
        return direction.multiplyScalar(1/depth);
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