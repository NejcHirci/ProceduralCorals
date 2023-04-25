import * as THREE from 'three';

import * as Utils from './Utils';

export class CoralGenerator {
    // Generation parameters
    public numAttractors: number = 5;
    public radius: number = 5;
    public startPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
    public branchLength: number = 0.5;
    public timeBetweenIterations: number = 1;
    public attractorRadius: number = 0.5;
    public killRange: number = 0.1;
    public randomGrowth: number = 0.1;

    // Geometry parameters
    public radialSegments: number = 16;
    public extremitiesSize: number = 0.05;
    public invertGrowth: number = 2;

    // Internal variables
    private attractors: THREE.Vector3[] = [];
    private activeAttractors: number[] = [];

    private rootBranch: Branch;
    private branches: Branch[] = [];
    private extremities: Branch[] = [];
    private timeSinceLastIteration: number = 0;

    public geometry: THREE.BufferGeometry;

    initialize() {
        this.GenerateAttractors(new THREE.Vector3(0, 5, 0));
        this.geometry = new THREE.BufferGeometry();

        // Generate first branch
        this.rootBranch = new Branch(
            this.startPosition,
            this.startPosition.clone().sub(new THREE.Vector3(0, this.branchLength, 0)),
            new THREE.Vector3(0, 1, 0)
        );
        this.branches.push(this.rootBranch);
        this.extremities.push(this.rootBranch);
    }

    update(delta: number) {
        this.timeSinceLastIteration += delta;
        if (this.timeSinceLastIteration >= this.timeBetweenIterations) {
            this.timeSinceLastIteration = 0;

            this.extremities.forEach((extrem) => extrem.grown = true);

            // Remove attractors in kill range
            for (let i = this.numAttractors-1; i >= 0; i--) {
                this.branches.forEach((branch) => {
                    if (branch.end.distanceTo(this.attractors[i]) < this.killRange) {
                        this.attractors.splice(i, 1);
                        this.numAttractors--;
                        return;
                    }
                });
            }

            if (this.numAttractors > 0) {
                // Clear active attractors
                this.activeAttractors = [];
                this.branches.forEach((b) => b.attractors = []);

                // Associate each attractor with a branch
                this.attractors.forEach((attractor, index) => {
                    let minDist = Infinity;
                    let minBranch = null;
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
                } else {
                    // Otherwise, we just grow the edges of the mesh
                    this.extremities.forEach((extrem) => {
                        let start = extrem.end;
                        let dir = extrem.direction.clone().add(Utils.RandomInSphere(this.randomGrowth));
                        let end = extrem.end.clone().add(dir.multiplyScalar(this.branchLength));
                        let newBranch = new Branch(start, end, dir, extrem);

                        // Add child to parent
                        extrem.children.push(newBranch);

                        // Add new branch to extremities list
                        this.branches.push(newBranch);
                        this.extremities.push(newBranch);
                    });
                }
            }
        }
        this.GenerateMesh();
    }

    GenerateAttractors(offset: THREE.Vector3) {
        this.attractors = [];
        this.activeAttractors = [];
        for (let i = 0; i < this.numAttractors; i++) {
            let radius = Math.random();
            radius = Math.pow(Math.sin(radius * Math.PI/2), 0.8);
            radius *= this.radius;

            let phi = Math.random() * Math.PI;
            let theta = Math.random() * 2 * Math.PI;

            let x = this.radius * Math.cos(theta) * Math.sin(phi);
            let y = this.radius * Math.cos(phi);
            let z = this.radius * Math.sin(theta) * Math.sin(phi);
            let attractor = new THREE.Vector3(x, y, z);
            attractor.add(offset);
            this.attractors.push(attractor);
        }
    }

    GenerateMesh() {
        let vertices = new Float32Array((this.branches.length + 1) * this.radialSegments * 3);
        let triangles = new Uint32Array(this.branches.length * this.radialSegments * 6);

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
        this.branches.forEach((branch, i) => {
            let vid = this.radialSegments * i;
            branch.verticesId = vid;

            let quat = new THREE.Quaternion();
            quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branch.direction);

            for (let j = 0; j < this.radialSegments; j++) {
                let angle = j * 2 * Math.PI / this.radialSegments;
                let x = branch.size * Math.cos(angle);
                let y = branch.size * Math.sin(angle);
                let v = new THREE.Vector3(x, y, 0);
                v.applyQuaternion(quat);

                // If branch is extremity, we grow it slowly
                if (branch.children.length == 0 && branch.grown) {
                    let scale = this.timeSinceLastIteration / this.timeBetweenIterations;
                    let diff = branch.end.clone().sub(branch.start);
                    v.add(diff.multiplyScalar(scale));
                    v.add(branch.start);
                } else {
                    v.add(branch.end);
                }

                vertices[vid + j] = v.x - this.startPosition.x
                vertices[vid + j + 1] = v.y - this.startPosition.y;
                vertices[vid + j + 2] = v.z - this.startPosition.z;

                // If root node we must add base vertices
                if (branch.parent != null) {
                    let pvid = this.branches.length * this.radialSegments + j;
                    let vec = new THREE.Vector3(Math.cos(angle) * branch.size, 0, Math.sin(angle) * branch.size);
                    vertices[pvid] = branch.start.x + vec.x - this.startPosition.x;
                    vertices[pvid + 1] = branch.start.y + vec.y - this.startPosition.y;
                    vertices[pvid + 2] = branch.start.z + vec.z - this.startPosition.z;
                }
            }
        });

        // Construct triangles after the parent vertices are computed
        this.branches.forEach((branch, i) => {
            let frontId = this.radialSegments * i * 6;
            let botId = branch.parent != undefined ? branch.parent.verticesId : this.branches.length * this.radialSegments;
            let topId = branch.verticesId;

            for (let j = 0; j < this.radialSegments; j++) {
                triangles[frontId + j * 6] = botId + j;
                triangles[frontId + j * 6 + 1] = botId + j;

                if (j == this.radialSegments-1) {
                    // Last triangle
                    triangles[frontId + j * 6 + 2] = topId;

                    triangles[frontId + j * 6 + 3] = botId + j;
                    triangles[frontId + j * 6 + 4] = topId;
                    triangles[frontId + j * 6 + 5] = botId;
                } else {
                    triangles[frontId + j * 6 + 2] = topId + j + 1;

                    triangles[frontId + j * 6 + 3] = botId + j;
                    triangles[frontId + j * 6 + 4] = topId + j + 1;
                    triangles[frontId + j * 6 + 5] = botId + j + 1;
                }
            }
        });

        // Assign values to geometry
        this.geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        this.geometry.setIndex(new THREE.BufferAttribute(triangles, 1));
        this.geometry.computeVertexNormals();
    }
}

class Branch {
    public start: THREE.Vector3;
    public end: THREE.Vector3;
    public direction: THREE.Vector3;
    public parent : Branch;
    public size: number;
    public lastSize: number;
    public children: Branch[] = [];
    public attractors: THREE.Vector3[];
    public verticesId : number;
    public distanceFromRoot: number = 0;
    public grown: boolean;

    constructor(start, end, direction, parent=null) {
        this.start = start;
        this.end = end;
        this.direction = direction;
        this.parent = parent;
    }
}