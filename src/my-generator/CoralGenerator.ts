import * as THREE from 'three'
import * as lil from 'lil-gui'
import * as Utils from './Utils'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as MeshExporter from './MeshExporter'

enum AttractorShape {
  Sphere,
  Hemisphere,
  Cone,
  Cylinder,
  Cuboid
}

export class CoralGenerator {
  // Attractor parameters
  public attractors: THREE.Vector3[] = [];
  public attractorCount: number = 100;
  public attractorStrength: number = 1.0;
  public attractorKillRange: number = 0.1;
  public attractorFood: number = 0.5;
  public growthDecrease: number = 0.5;

  // Sampling parameters
  public attractorShape: SamplingShape;;

  // Growth parameters
  public startPosition: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public maxInitialBranches: number = 5;
  public branchLength: number = 0.06;
  public timeBetweenIterations: number = 0.25;
  public randomGrowth: number = 0.5;
  public branchingProbability: number = 0.000000001;
  public maxBranchingAngle: number = Math.PI / 2;
  public minEnergy: number = 0.01;

  // Obstacle parameters
  public obstacleMesh: ObstacleMesh;

  // Geometry parameters
  public radialSegments: number = 12
  public extremitiesSize: number = 0.02

  // Internal variables
  private activeAttractors: number[] = []
  private branches: Branch[] = []
  private extremities: Branch[] = []
  private numRemainingAttractors: number = 0
  public timeSinceLastIteration: number = 0
  private color: THREE.Color = new THREE.Color(0xff4c00);

  public geometry: THREE.BufferGeometry

  // Environment
  public environment: Environment

  constructor() {
    this.geometry = new THREE.BufferGeometry();
    this.environment = new Environment();
    this.attractorShape = new SamplingShape(AttractorShape.Sphere, this.Reset.bind(this));
    this.obstacleMesh = new ObstacleMesh(AttractorShape.Sphere, this.Reset.bind(this));
    this.init();
  }

  init() {
    this.GenerateAttractors();

    // Find closest attractor equal to the number of initial branches
    
    this.attractors.sort((a, b) => { return a.distanceTo(this.startPosition) - b.distanceTo(this.startPosition) });

    // Create initial branches
    for (let i = 0; i < this.maxInitialBranches; i++) {
      if (this.attractors[i].distanceTo(this.startPosition) < this.attractorStrength * 2) {
        let direction = this.attractors[i].clone().sub(this.startPosition);
        direction.normalize();
        let branch = new Branch(this.startPosition, direction.multiplyScalar(this.branchLength), direction, null, this.extremitiesSize, 1.0);
        this.branches.push(branch);
      }
    }
  }

  update(delta: number) {
    this.timeSinceLastIteration += delta
    if (this.timeSinceLastIteration >= this.timeBetweenIterations) {
      this.timeSinceLastIteration = 0

      // Set branches with no children as new extremities
      this.extremities = this.branches.filter(
        (branch) => branch.children.length == 0
      )

      // Remove attractors in kill range and add energy to branches
      for (let i = this.attractors.length - 1; i >= 0; i--) {
        this.branches.every((branch) => {
          if (
            branch.end.distanceTo(this.attractors[i]) < this.attractorKillRange
          ) {
            branch.energy += this.attractorFood
            this.attractors.splice(i, 1)
            this.numRemainingAttractors--
            console.log('Killed attractor')
            // If attractor is killed, stop
            return false
          }
          // If attractor is not killed, continue
          return true
        })
      }

      if (this.numRemainingAttractors > 0) {
        this.Grow()
      }
      return true
    }
    return false
  }

  GenerateAttractors() {
    this.attractors = [];
    this.activeAttractors = [];
    for (let i = 0; i < this.attractorCount; i++) {
      let attractor = this.attractorShape.SampleShape();

      // Check if attractor is inside obstacle
      if (!this.obstacleMesh.IsInside(attractor, 0.0)) {
        this.attractors.push(attractor);
      }
    }
    this.numRemainingAttractors = this.attractors.length;
  }

  GenerateMeshFromVerts() {
    // Count number of extremities
    let extremities:Branch[] = [];
    this.branches.forEach((branch) => {
      if (branch.children.length == 0) {
        extremities.push(branch);
      }
    });
    let numExtremities = extremities.length;
    //this.FixSelfIntersections();
    let vertices = new Float32Array((this.branches.length + 1) * this.radialSegments * 3);
    let indices = new Uint32Array(this.branches.length * this.radialSegments * 6 + numExtremities * (this.radialSegments - 2) * 3);

    // Construct vertices
    for (let i = 0; i < this.branches.length; i++) {
      this.branches[i].verticesId = i * this.radialSegments;

      // Quaternion rotation to align branch with its direction
      let quaternion = new THREE.Quaternion();
      let dir = this.branches[i].direction.clone();
      let norm = new THREE.Vector3(0, 1, 0);
      dir.normalize();

      // Check if same hemisphere
      quaternion.setFromAxisAngle
      quaternion.setFromUnitVectors(norm, dir);

      for (let s = 0; s < this.radialSegments; s++) {
        let angle = s * 2 * Math.PI / this.radialSegments;

        if (dir.dot(norm) < 0) {
          //angle -= Math.PI / 2;
        }

        let x = Math.cos(angle);
        let y = Math.sin(angle);
        let radius = this.branches[i].GetRadius(new THREE.Vector3(x, 0, y));
        radius += this.environment.CalculateTemperatureImpact(this.branches[i].end, this.attractors);
        let vertex = new THREE.Vector3(x * radius, 0, y * radius);
        vertex.applyQuaternion(quaternion)
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

      let bid = this.branches.length * this.radialSegments;
      if (this.branches[i].parent != null) {
        bid = this.branches[i].parent!.verticesId;
      }
      let tid = this.branches[i].verticesId;

      for (let s = 0; s < this.radialSegments; s++) {
        indices[fid + s * 6] = bid + s
        indices[fid + s * 6 + 1] = tid + s

        if (s == this.radialSegments - 1) {
          indices[fid + s * 6 + 2] = tid
          indices[fid + s * 6 + 3] = bid + s
          indices[fid + s * 6 + 4] = tid
          indices[fid + s * 6 + 5] = bid
        } else {
          indices[fid + s * 6 + 2] = tid + s + 1
          indices[fid + s * 6 + 3] = bid + s
          indices[fid + s * 6 + 4] = tid + s + 1
          indices[fid + s * 6 + 5] = bid + s + 1
        }
      }
    }

    // Construct faces at the end of extremities
    for (let i = 0; i < numExtremities; i++) {
      let fid = this.branches.length * this.radialSegments * 6 + i * (this.radialSegments - 2) * 3;
      let bid = extremities[i].verticesId;

      for (let s = 0; s < this.radialSegments - 2; s++) {
        indices[fid + s * 3] = bid
        indices[fid + s * 3 + 1] = bid + s + 1
        indices[fid + s * 3 + 2] = bid + s + 2
      }
    }



    let geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    const material = new THREE.MeshPhongMaterial({
      color: this.color,
      side: THREE.DoubleSide,
      wireframe: false,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true

    return mesh
  }

  GenerateLineFromVerts() {
    let lineSegments = new THREE.LineSegments()
    this.branches.forEach((branch) => {
      let geometry = new THREE.BufferGeometry()
      let vertices = new Float32Array(2 * 3)
      vertices[0] = branch.start.x
      vertices[1] = branch.start.y
      vertices[2] = branch.start.z
      vertices[3] = branch.end.x
      vertices[4] = branch.end.y
      vertices[5] = branch.end.z
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      geometry.computeVertexNormals()
      let material = new THREE.LineBasicMaterial({ color: 0xff0000 })
      let line = new THREE.Line(geometry, material)
      lineSegments.add(line)
    })
    return lineSegments
  }

  GenerateTubeFromVerts() {
    let tubeSegments: THREE.TubeGeometry[] = []
    this.branches.forEach((branch) => {
      let points = [branch.start, branch.end]
      let geometry = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),
        64,
        0.1,
        8,
        false
      )
      tubeSegments.push(geometry)
    })
    // Construct missing tubes between parent and child
    for (let i = 0; i < this.branches.length; i++) {
      if (this.branches[i].parent != null) {
        let points = [this.branches[i].parent!.end, this.branches[i].start]
        let geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(points),
          64,
          0.1,
          8,
          false
        )
        tubeSegments.push(geometry)
      }
    }
    let meshGeometry = BufferGeometryUtils.mergeBufferGeometries(tubeSegments)
    let material = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      side: THREE.DoubleSide,
      wireframe: false,
    })
    let mesh = new THREE.Mesh(meshGeometry, material)
    return mesh
  }

  CreateGUI(gui: lil.GUI) {
    gui.addColor(this, 'color').name("Color").onChange(() => { this.Reset() });
    gui.add({
      export: () => {
        MeshExporter.exportMesh(this.GenerateMeshFromVerts(), "coral.gltf");
      }
    }, 'export').name("Export");
    const attractorFolder = gui.addFolder('Attractors');
    attractorFolder.open();
    attractorFolder.add(this, 'attractorCount', 0, 10000, 1).name("Count").onChange(() => { this.Reset() });
    attractorFolder.add(this, 'attractorStrength', 0, 10, 0.1).name("Influence Radius").onChange(() => { this.Reset() });
    attractorFolder.add(this, "attractorKillRange", 0, 10, 0.1).name("Kill Radius").onChange(() => { this.Reset() });
    attractorFolder.add(this, "attractorFood", 0, 2, 0.1).name("Food").onChange(() => { this.Reset() });

    // Create Sample folder
    this.attractorShape.updateGUI(attractorFolder);

    // Create branch folder
    const branchFolder = gui.addFolder('Branches');
    branchFolder.open();
    branchFolder.add(this, 'maxInitialBranches', 0, 100, 1).name("Initial Count").onChange(() => { this.Reset() });
    branchFolder.add(this, 'extremitiesSize', 0, 1, 0.01).name("Base Width").onChange(() => { this.Reset() });
    branchFolder.add(this, 'branchLength', 0, 10, 0.1).name("Length").onChange(() => { this.Reset() });
    branchFolder.add(this, 'timeBetweenIterations', 0.01, 1, 0.01).name("Growth Speed").onChange(() => { this.Reset() });
    branchFolder.add(this, 'randomGrowth', 0, 1, 0.01).name("Random Growth").onChange(() => { this.Reset() });
    branchFolder.add(this, 'branchingProbability', 0, 1, 0.01).name("Branching Probability").onChange(() => { this.Reset() });
    branchFolder.add(this, 'maxBranchingAngle', 0, Math.PI, 0.01).name("Max Branching Angle").onChange(() => { this.Reset() });
    branchFolder.add(this, 'minEnergy', 0, 1, 0.01).name("Min Energy to Branch").onChange(() => { this.Reset() });

    // Create obstacle folder
    this.obstacleMesh.updateGUI(gui);

    this.environment.CreateEnvGui(gui, this.Reset.bind(this));
  }

  Reset() {
    this.geometry.dispose()

    console.log(this.attractorShape)

    this.GenerateAttractors()
    this.geometry = new THREE.BufferGeometry()
    this.branches = []
    this.init()
  }

  private Grow() {
    // We grow one iteration of all branches

    // Clear active attractors
    this.activeAttractors = []
    this.branches.forEach((b) => (b.attractors = []))

    // Associate each attractor with a branch
    this.attractors.forEach((attractor, index) => {
      let minDist = Infinity;
      let minBranch:any = null;
      this.branches.forEach((branch) => {
        let dist = branch.end.distanceTo(attractor)
        if (dist < minDist && dist < this.attractorStrength) {
          minDist = dist;
          minBranch = branch;
        }
      });

      if (minBranch != null) {
        minBranch!.attractors.push(attractor);
        this.activeAttractors.push(index);
      }
    })

    // If at least an attraction point is found, we grow the mesh
    if (this.activeAttractors.length > 0) {
      // Clear extremities list because new will be set
      this.extremities = []

      // New branches list
      let newBranches: Branch[] = []

      // Create new branches in all attractor directions but only if the branch has enough energy and space
      for (let i=0; i < this.branches.length; i++) {
        let branch = this.branches[i];
        if (branch.attractors.length > 0 && branch.energy > this.minEnergy) {
          // Sort branch attractors by distance
          branch.attractors.sort((a, b) => {
            return branch.end.distanceTo(a) - branch.end.distanceTo(b)
          })

          // Get average attractor position
          let avgAttractor = new THREE.Vector3()
          branch.attractors.forEach((attractor) => {
            avgAttractor.add(attractor)
          })
          avgAttractor.divideScalar(branch.attractors.length);

          // Check if avgAttractor direction angle is within the branch angle
          let angle = branch.end.clone().sub(branch.start).angleTo(avgAttractor.clone().sub(branch.end));
          if (angle < this.maxBranchingAngle) {
            // Grow initial branch
            let newBranch = this.GrowBranch(branch, avgAttractor);
            if (newBranch == null) { return; }
            branch.energy /= (this.growthDecrease + 1.0);
            newBranches.push(newBranch);
            // Add new branch to children
            branch.children.push(newBranch);
            // Add new branch to extremities list
            this.extremities.push(newBranch);
          }

          // Grow additional branches in direction of other attractors with decreasing probability
          let prob = this.branchingProbability;
          for (let i = 1; i < branch.attractors.length; i++) {
            if (Math.random() < prob && branch.energy > this.minEnergy) {
              let angle = branch.direction.clone().angleTo(branch.attractors[i].clone().sub(branch.end));
              if (angle < this.maxBranchingAngle) {
                let newBranch = this.GrowBranch(branch, branch.attractors[i]);
                if (newBranch == null) { return; }
                branch.energy /= (this.growthDecrease + 1.0);
                newBranches.push(newBranch);
                // Add new branch to children
                branch.children.push(newBranch);
                // Add new branch to extremities list
                this.extremities.push(newBranch);
                prob *= this.branchingProbability;
              }
            }
          }
        }
      };
      this.branches.push(...newBranches);
    } else {
      // Otherwise, we just grow the edges of the mesh but we must expend energy
      this.extremities.forEach((extrem) => {
        if (extrem.energy / 2 > this.minEnergy) {
          let newBranch = this.GrowBranch(extrem, extrem.end.clone());
          if (newBranch == null) { return; }
          extrem.energy /= (this.growthDecrease + 1.0);

          // Add child to parent
          extrem.children.push(newBranch)

          // Add new branch to extremities list
          this.branches.push(newBranch)
          this.extremities.push(newBranch)
        }
      })
      // console.log(this.branches);
    }
  }

  private GrowBranch(branch: Branch, attractor: THREE.Vector3) {
    // Compute new direction
    let newDirection = attractor.clone().sub(branch.end)
    newDirection.normalize()
    newDirection.add(Utils.RandomInSphere(this.randomGrowth))
    newDirection.add(this.environment.CalculateSeaCurrentImpact())
    newDirection.normalize()

    // Smoothen direction with parent direction
    let smoothingFactor = 0.5
    let parentDirection = branch.direction.clone()
    parentDirection.multiplyScalar(smoothingFactor)
    newDirection.normalize()
    newDirection.multiplyScalar(1 - smoothingFactor)
    newDirection.normalize();

    // Check if new direction does not intersect with an obstacle
    let tempEnd = branch.end.clone().add(newDirection.clone().multiplyScalar(this.branchLength));
    if (this.obstacleMesh.IsInside(tempEnd, this.extremitiesSize)) {
      // If it does, we try to find a new direction
      let newDirectionFound = false;
      let nbTries = 0;
      while (nbTries < 20) {
        newDirection = Utils.RandomInSphere(this.randomGrowth);
        newDirection.add(this.environment.CalculateSeaCurrentImpact());
        newDirection.normalize();
        tempEnd = branch.end.clone().add(newDirection.clone().multiplyScalar(this.branchLength));
        if (!this.obstacleMesh.IsInside(tempEnd, this.extremitiesSize)) {
          newDirectionFound = true;
          break;
        }
        nbTries++;
      }
      if (newDirectionFound) {
        newDirection.normalize();
      } else {
        return null;
      }
    }

    // Compute new end position
    newDirection.multiplyScalar(this.branchLength);
    let newEnd = branch.end.clone().add(newDirection)
    newDirection.normalize()

    // Create new branch
    let energy = branch.energy / (this.growthDecrease + 1.0);
    let newBranch = new Branch(branch.end, newEnd, newDirection, branch, this.extremitiesSize, energy);
    return newBranch;
  }
}

class Branch {
  public start: THREE.Vector3
  public end: THREE.Vector3
  public direction: THREE.Vector3
  public parent: Branch | null
  public size: number
  public children: Branch[] = []
  public attractors: THREE.Vector3[]
  public verticesId: number = 0

  // Remaining energy
  public energy: number

  constructor(
    start: THREE.Vector3, end: THREE.Vector3,
    direction: THREE.Vector3,
    parent: Branch | null = null,
    size: number = 0.05,
    energy: number = 1) {

    this.start = start;
    this.end = end;
    this.direction = direction;
    this.parent = parent;
    this.size = size;
    this.energy = energy;
    this.verticesId = 0;
    this.attractors = [];
  }

  GetRadius(dir: THREE.Vector3) {
    // Radius will be computer based on the  the directions of children
    if (this.children.length == 0) {
      return this.size
    }
    // Find child with the closest direction to the given x, y
    let closestAngle = 1000
    for (let i = 0; i < this.children.length; i++) {
      let angle = dir.angleTo(this.children[i].direction)
      if (angle < closestAngle) {
        closestAngle = angle;
      }
    }
    let radius = this.size + closestAngle * 0.05

    // Smoothen the radius with the parent radius if there is one
    if (this.parent != null) {
      let smoothingFactor = 0.5
      let parentRadius = this.parent.GetRadius(this.direction)
      radius = radius * (1 - smoothingFactor) + parentRadius * smoothingFactor
    }

    // Add offset based on the angle between the closest child and the given x, y
    return radius
  }
}

class Environment {
  public seaCurrent: THREE.Vector3 = new THREE.Vector3(0, 1, 0)
  public seaCurrentSpeed: number = 0.4
  public seaCurrentTemperature: number = 0

  public lightDirection: THREE.Vector3 = new THREE.Vector3(0, 0, 0)

  public temperatureInfluence: number = 0.01

  constructor() { }

  CreateEnvGui(gui: lil.GUI, reset: () => void) {
    let folder = gui.addFolder('Environment')
    folder.add(this.seaCurrent, 'x', -1, 1, 0.01).onChange(reset)
    folder.add(this.seaCurrent, 'y', -1, 1, 0.01).onChange(reset)
    folder.add(this.seaCurrent, 'z', -1, 1, 0.01).onChange(reset)
    folder
      .add(this, 'seaCurrentSpeed', 0, 1, 0.01)
      .name('Sea Current Influence')
      .onChange(reset)
    folder
      .add(this, 'temperatureInfluence', 0, 1, 0.01)
      .name('Temperature Influence')
      .onChange(reset)
  }

  CalculateSeaCurrentImpact() {
    /**
     * We define Sea Current Simply as
     */

    // Compute direction
    let direction = this.seaCurrent.clone()
    direction.normalize()
    direction.multiplyScalar(this.seaCurrentSpeed)

    // Multiply by depth
    return direction
  }

  CalculateTemperatureImpact(
    position: THREE.Vector3,
    attractors: THREE.Vector3[]
  ) {
    /**
     * Temperature should decrease with distance from the surface and should impact the size of the branches.
     */

    let depth = position.y

    // Get the topmost attractor
    let topAttractor = attractors[0]
    let topAttractorDepth = topAttractor.y
    attractors.forEach((attractor) => {
      if (attractor.y > topAttractorDepth) {
        topAttractor = attractor
        topAttractorDepth = attractor.y
      }
    })

    // Compute temperature
    let temperature = THREE.MathUtils.mapLinear(
      depth,
      -1.0,
      topAttractorDepth,
      0.0,
      1.0
    )

    return temperature * this.temperatureInfluence
  }
}

class SamplingShape {

  public reset: () => void;
  public shapeType: AttractorShape;
  private radius: number = 1;
  private height: number = 1;
  private width: number = 1;
  private depth: number = 1;
  private normal: THREE.Vector3 = new THREE.Vector3(0, 1, 0);

  constructor(shapeType: AttractorShape, reset: () => void) {
    this.reset = reset;
    this.shapeType = shapeType;
  }

  updateGUI(gui: lil.GUI) {
    let folder = gui.addFolder("Sampling Shape");
    folder.add(this, "shapeType",
      {
        Hemisphere: AttractorShape.Hemisphere, Sphere: AttractorShape.Sphere, Cuboid: AttractorShape.Cuboid,
        Cone: AttractorShape.Cone, Cylinder: AttractorShape.Cylinder
      }).name("Shape").onChange(this.reset);
    folder.add(this, "radius", 0, 5, 0.01).name("Radius").onChange(this.reset);
    folder.add(this, "height", 0, 5, 0.01).name("Height").onChange(this.reset);
    folder.add(this, "width", 0, 5, 0.01).name("Width").onChange(this.reset);
    folder.add(this, "depth", 0, 5, 0.01).name("Depth").onChange(this.reset);
    folder.add(this.normal, "x", -1, 1, 0.01).name("Normal X").onChange(this.reset);
    folder.add(this.normal, "y", -1, 1, 0.01).name("Normal Y").onChange(this.reset);
    folder.add(this.normal, "z", -1, 1, 0.01).name("Normal Z").onChange(this.reset);
  }

  public SampleShape() {
    switch (this.shapeType) {
      case AttractorShape.Sphere:
        return Utils.RandomInSphere(this.radius).add(new THREE.Vector3(0, this.radius, 0));
      case AttractorShape.Hemisphere:
        return Utils.RandomInHemisphere(this.radius, this.normal)
      case AttractorShape.Cuboid:
        return Utils.RandomInCuboid(this.width, this.height, this.depth, this.normal).add(new THREE.Vector3(0, this.height / 2, 0));
      case AttractorShape.Cone:
        let v = Utils.RandomInCone(this.radius, this.height, this.normal);
        if (this.normal.y < 0) {
          v.add(new THREE.Vector3(0, this.height, 0));
        }
        return v;
      case AttractorShape.Cylinder:
        return Utils.RandomInCylinder(this.radius, this.height, this.normal);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  public GetMesh() {
    let material = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.05 });
    let mesh: THREE.Mesh;

    let rot = new THREE.Quaternion();
    this.normal.normalize();
    rot.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this.normal);

    switch (this.shapeType) {
      case AttractorShape.Sphere:
        mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 32, 32), material);
        mesh.position.y = this.radius;
        break;
      case AttractorShape.Hemisphere:
        mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), material);
        mesh.applyQuaternion(rot);
        break;
      case AttractorShape.Cuboid:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, this.depth), material);
        mesh.position.y = this.height / 2;
        mesh.applyQuaternion(rot);
        break;
      case AttractorShape.Cone:
        mesh = new THREE.Mesh(new THREE.ConeGeometry(this.radius, this.height, 32), material);
        mesh.position.y = this.height / 2;
        mesh.applyQuaternion(rot);
        break;
      case AttractorShape.Cylinder:
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(this.radius, this.radius, this.height, 32), material);
        mesh.position.y = this.height / 2;
        mesh.applyQuaternion(rot);
        break;
    }
    return mesh;
  }

}

class ObstacleMesh {


  public enabled: boolean = false;
  public reset: () => void;
  public shapeType: AttractorShape;
  private radius: number = 1;
  private height: number = 1;
  private width: number = 1;
  private depth: number = 1;
  private position: THREE.Vector3 = new THREE.Vector3(0, 3, 0);


  constructor(shapeType: AttractorShape, reset: () => void) {
    this.reset = reset;
    this.shapeType = shapeType;

  }

  updateGUI(gui: lil.GUI) {
    let folder = gui.addFolder("Obstacle");
    folder.add(this, "enabled").name("Enabled").onChange(this.reset);
    folder.add(this, "shapeType",
      {
        Hemisphere: AttractorShape.Hemisphere, Sphere: AttractorShape.Sphere, Cuboid: AttractorShape.Cuboid,
        Cone: AttractorShape.Cone, Cylinder: AttractorShape.Cylinder
      }).name("Shape").onChange(this.reset);
    folder.add(this, "radius", 0, 5, 0.01).name("Radius").onChange(this.reset);
    folder.add(this, "height", 0, 5, 0.01).name("Height").onChange(this.reset);
    folder.add(this, "width", 0, 5, 0.01).name("Width").onChange(this.reset);
    folder.add(this, "depth", 0, 5, 0.01).name("Depth").onChange(this.reset);
    folder.add(this.position, "x", -5, 5, 0.01).name("Position X").onChange(this.reset);
    folder.add(this.position, "y", -5, 5, 0.01).name("Position Y").onChange(this.reset);
    folder.add(this.position, "z", -5, 5, 0.01).name("Position Z").onChange(this.reset);
  }

  public IsInside(p: THREE.Vector3, r: number): boolean {
    if (!this.enabled) return false;

    switch (this.shapeType) {
      case AttractorShape.Sphere:
        return Utils.IsInSphere(p, r, this.position, this.radius);
      case AttractorShape.Hemisphere:
        return Utils.IsInHemisphere(p, r, this.position, this.radius);
      case AttractorShape.Cuboid:
        return Utils.IsInCuboid(p, r, this.position, this.width, this.height, this.depth);
      case AttractorShape.Cone:
        return Utils.IsInCone(p, r, this.position, this.radius, this.height);
      case AttractorShape.Cylinder:
        return Utils.IsInCylinder(p, r, this.position, this.radius, this.height);
    }
  }

  public GetMesh() {
    let material = new THREE.MeshBasicMaterial({ color: 0x0000ff, wireframe: true, transparent: true, opacity: 0.1 });
    let mesh: THREE.Mesh;

    switch (this.shapeType) {
      case AttractorShape.Sphere:
        mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 32, 32), material);
        mesh.position.set(this.position.x, this.position.y, this.position.z);
        break;
      case AttractorShape.Hemisphere:
        mesh = new THREE.Mesh(new THREE.SphereGeometry(this.radius, 32, 32, 0, Math.PI * 2, 0, Math.PI * 0.5), material);
        mesh.position.set(this.position.x, this.position.y, this.position.z);
        break;
      case AttractorShape.Cuboid:
        mesh = new THREE.Mesh(new THREE.BoxGeometry(this.width, this.height, this.depth), material);
        mesh.position.set(this.position.x, this.position.y, this.position.z);
        break;
      case AttractorShape.Cone:
        mesh = new THREE.Mesh(new THREE.ConeGeometry(this.radius, this.height, 32), material);
        mesh.position.set(this.position.x, this.position.y, this.position.z);
        break;
      case AttractorShape.Cylinder:
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(this.radius, this.radius, this.height, 32), material);
        mesh.position.set(this.position.x, this.position.y, this.position.z);
        break;
    }
    return mesh;
  }

}