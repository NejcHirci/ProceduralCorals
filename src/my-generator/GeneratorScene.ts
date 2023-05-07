import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import * as lil from 'lil-gui'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { CoralGenerator } from './CoralGenerator'

export class GeneratorScene implements Experience {
    resources: Resource[] = []
    private coralGenerator: CoralGenerator;
    private generatorMeshes: THREE.Mesh[];
    private coralMesh: THREE.Mesh;
    private attractorMeshes: THREE.Mesh[] = [];
    private sampleMesh: THREE.Mesh;
    private gui: lil.GUI;

    constructor(private engine: Engine) {
        this.coralGenerator = new CoralGenerator();
        this.generatorMeshes = [];
        this.gui = new lil.GUI();
    }

    init() {
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
        )

        plane.rotation.x = -Math.PI / 2
        plane.receiveShadow = true

        this.engine.scene.add(plane)
        this.engine.scene.add(new THREE.AmbientLight(0xffffff, 0.5))

        let directionalLight = new THREE.DirectionalLight(0xffffff, 1)
        directionalLight.castShadow = true
        directionalLight.position.set(2, 2, 2)

        this.engine.scene.add(directionalLight)

        this.coralGenerator.attractors.forEach(attractor => {
            // Create a small red sphere for each attractor
            let sphere = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
            sphere.position.copy(attractor);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            this.attractorMeshes.push(sphere);
            this.engine.scene.add(sphere);
        });

        // Create skybox
        this.createSkybox();

        // Create coral generator GUI
        this.coralGenerator.CreateGUI(this.gui);
    }

    resize() {}

    update(delta: number) {
        this.coralGenerator.update(delta);

        if (this.coralMesh) {
            this.engine.scene.remove(this.coralMesh);
            this.coralMesh.geometry.dispose();
        }

        this.coralMesh = this.coralGenerator.GenerateMesh2();
        this.engine.scene.add(this.coralMesh);

        // Remove all attractor meshes
        this.attractorMeshes.forEach((mesh) => {
            this.engine.scene.remove(mesh);
            mesh.geometry.dispose();
        });

        // Create a small red sphere for each attractor
        this.attractorMeshes = [];
        this.coralGenerator.attractors.forEach(attractor => {
            let sphere = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
            sphere.position.copy(attractor);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            this.attractorMeshes.push(sphere);
            this.engine.scene.add(sphere);
        });

        // Draw attractor reference mesh
        if (!this.sampleMesh || this.sampleMesh.geometry.parameters.radius != this.coralGenerator.attractorRadius) {
            if (this.sampleMesh) {
                this.engine.scene.remove(this.sampleMesh);
                this.sampleMesh.geometry.dispose();
            }
            this.sampleMesh = new THREE.Mesh(
                new THREE.SphereGeometry(this.coralGenerator.attractorRadius, 60, 60, 0, 2*Math.PI, 0, Math.PI/2), 
                new THREE.MeshStandardMaterial({ color: 0x00ff00, wireframe: true, transparent: true, opacity: 0.1 }));
            this.sampleMesh.castShadow = false;
            this.sampleMesh.receiveShadow = false;
            this.engine.scene.add(this.sampleMesh);
        }
    }

    createSkybox() {
        let texture = new THREE.TextureLoader().load('assets/textures/skybox.jpg');
        let skyboxGeo = new THREE.SphereGeometry(1000, 25, 25);
        let skyboxMat = new THREE.MeshPhongMaterial({ map: texture, side: THREE.BackSide });
        let skybox = new THREE.Mesh(skyboxGeo, skyboxMat);
        this.engine.scene.add(skybox);
    }
}
