import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import * as lil from 'lil-gui'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { CoralGenerator } from './CoralGenerator'

export class GeneratorScene implements Experience {
  resources: Resource[] = []
  private coralGenerator: CoralGenerator
  private generatorMeshes: THREE.Mesh[]
  private coralMesh: THREE.Mesh | THREE.LineSegments
  private attractorMeshes: THREE.Points
  private sampleMesh: THREE.Mesh
  private gui: lil.GUI

  private showAttractors: boolean = true
  private showSamplingMesh: boolean = true
  private toggleLineOrMesh: boolean = true

  constructor(private engine: Engine) {
    this.coralGenerator = new CoralGenerator()
    this.generatorMeshes = []
    this.gui = new lil.GUI()
  }

  init() {
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.5,
      })
    )

    plane.rotation.x = -Math.PI / 2
    plane.receiveShadow = true

    this.engine.scene.add(plane)
    this.engine.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    let directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.castShadow = true
    directionalLight.position.set(2, 2, 2)

    this.engine.scene.add(directionalLight)

    // Create skybox
    this.createSkybox()

    // Create coral generator GUI
    this.gui.add(this, 'showAttractors').name('Show Attractors')
    this.gui.add(this, 'showSamplingMesh').name('Show Sampling Mesh')
    this.gui.add(this, 'toggleLineOrMesh').name('Toggle Line/Mesh')
    this.coralGenerator.CreateGUI(this.gui)
  }

  resize() {}

  update(delta: number) {
    let newRender = this.coralGenerator.update(delta)

    if (newRender) {
      if (this.coralMesh) {
        this.engine.scene.remove(this.coralMesh)
        this.coralMesh.geometry.dispose()
      }

      if (this.toggleLineOrMesh) {
        this.coralMesh = this.coralGenerator.GenerateMeshFromVerts()
      } else {
        this.coralMesh = this.coralGenerator.GenerateLineFromVerts()
      }
      this.engine.scene.add(this.coralMesh)

      // Remove all attractor meshes
      if (this.attractorMeshes) {
        this.attractorMeshes.geometry.dispose()
        this.engine.scene.remove(this.attractorMeshes)
      }
      if (this.showAttractors) {
        // Create a small red sphere for each attractor
        let geometry = new THREE.BufferGeometry()
        let vertices = new Float32Array(
          this.coralGenerator.attractors.length * 3
        )
        vertices.set(
          this.coralGenerator.attractors.map((a) => [a.x, a.y, a.z]).flat()
        )
        geometry.setAttribute(
          'position',
          new THREE.BufferAttribute(vertices, 3)
        )
        let material = new THREE.PointsMaterial({
          color: 0xff0000,
          size: 0.05,
          opacity: 0.5,
          transparent: true,
        })
        this.attractorMeshes = new THREE.Points(geometry, material)

        this.engine.scene.add(this.attractorMeshes)
      }

      if (this.sampleMesh) {
        this.engine.scene.remove(this.sampleMesh)
        this.sampleMesh.geometry.dispose()
      }

        // Draw attractor reference mesh
        if (this.showSamplingMesh) {
            this.sampleMesh = this.coralGenerator.attractorShape.GetMesh();
            this.sampleMesh.castShadow = false;
            this.sampleMesh.receiveShadow = false;
            this.engine.scene.add(this.sampleMesh);
        }
    }

  createSkybox() {
    let texture = new THREE.TextureLoader().load('assets/textures/skybox.jpg')
    let skyboxGeo = new THREE.SphereGeometry(1000, 25, 25)
    let skyboxMat = new THREE.MeshPhongMaterial({
      map: texture,
      side: THREE.BackSide,
    })
    let skybox = new THREE.Mesh(skyboxGeo, skyboxMat)
    this.engine.scene.add(skybox)
  }
}
