import { Engine } from '../engine/Engine'
import * as THREE from 'three'
import { Box } from './Box'
import { Experience } from '../engine/Experience'
import { Resource } from '../engine/Resources'
import { CoralGenerator } from './CoralGenerator'

export class GeneratorScene implements Experience {
    resources: Resource[] = []
    private coralGenerator: CoralGenerator;

    constructor(private engine: Engine) {}

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

        // Create the Coral Generator
        this.coralGenerator = new CoralGenerator();
        this.coralGenerator.initialize();

        // Create Mesh for the Coral Generator
        let coralMesh = new THREE.Mesh(this.coralGenerator.geometry, new THREE.MeshStandardMaterial({ color: 0x00ff00 }));
        coralMesh.castShadow = true;
        coralMesh.receiveShadow = true;
        this.engine.scene.add(coralMesh);
    }

    resize() {}

    update(delta: number) {
        this.coralGenerator.update(delta);
    }
}
