import * as THREE from 'three';

import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

// We use this class for both remeshing and exporting the mesh
export class MeshExporter {

    public static exportMesh(model: THREE.Mesh, filename: string) {
        const exporter = new GLTFExporter();

        exporter.parse(
            model,
            function ( gltf ) {
                console.log( gltf );
                const blob = new Blob([JSON.stringify(gltf)], {type: 'application/json'});
                download(blob, filename);
                
            },
            function ( error ) {
                console.error( error );
            }
        )
    }

    public static optimizeMesh(mesh: THREE.BufferGeometry) {

    }

}

function download(blob : Blob, filename : string) {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}