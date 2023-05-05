import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { CoralGenerator } from './CoralGenerator'

export class GeneratorScene implements Experience {
    resources: Resource[] = []
    private coralGenerator: CoralGenerator;
    private generatorMeshes: THREE.Mesh[];
    private attractorMeshes: THREE.Mesh[] = [];

    constructor(private engine: Engine) {
        this.coralGenerator = new CoralGenerator();
        this.generatorMeshes = [];
    }

    init() {
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(10, 10),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
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
            let sphere = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), new THREE.MeshStandardMaterial({ color: 0xff0000 }));
            sphere.position.copy(attractor);
            sphere.castShadow = true;
            sphere.receiveShadow = true;
            this.attractorMeshes.push(sphere);
            this.engine.scene.add(sphere);
        });

        // Create skybox
        this.createSkybox();
    }

    resize() {}

    update(delta: number) {
        if (this.generatorMeshes.length > 0) {
            this.generatorMeshes.forEach((mesh) => {
                this.engine.scene.remove(mesh);
                mesh.geometry.dispose();
            });
        }
        this.coralGenerator.update(delta);

        let mesh = this.coralGenerator.GenerateMesh2();
        this.engine.scene.add(mesh);

        // this.generatorMeshes = this.coralGenerator.GenerateMesh();
        // this.generatorMeshes.forEach((mesh) => {
        //     this.engine.scene.add(mesh);
        // });

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
    }

    createSkybox() {
        let texture = new THREE.TextureLoader().load('assets/textures/skybox.jpg');
        let skyboxGeo = new THREE.SphereGeometry(1000, 25, 25);
        let skyboxMat = new THREE.MeshPhongMaterial({ map: texture, side: THREE.BackSide });
        let skybox = new THREE.Mesh(skyboxGeo, skyboxMat);
        this.engine.scene.add(skybox);
    }
}
