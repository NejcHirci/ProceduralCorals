import * as THREE from 'three';

export function RandomInSphere(radius: number) : THREE.Vector3 {
    while (true) {
        let x = Math.random() * 2 * radius - radius;
        let y = Math.random() * 2 * radius - radius;
        let z = Math.random() * 2 * radius - radius;
        let v = new THREE.Vector3(x, y, z);
        if (v.length() <= radius) {
            return v.multiplyScalar(radius);
        }
    }
}