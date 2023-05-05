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

export function CosineSampleHemisphere(radius: number) : THREE.Vector3 {
    let u = Math.random();
    let v = Math.random();
    let phi = 2 * Math.PI * u;
    let cosTheta = Math.sqrt(v);
    let sinTheta = 1 - cosTheta * cosTheta;
    let x = radius * Math.cos(phi) * sinTheta;
    let y = radius * cosTheta;
    let z = radius * Math.sin(phi) * sinTheta;
    return new THREE.Vector3(x, y, z);
}

export function RandomInHemisphere(radius: number) : THREE.Vector3 {
    while (true) {
        let x = Math.random() * 2 * radius - radius;
        let y = Math.random() * 2 * radius - radius;
        let z = Math.random() * 2 * radius - radius;
        let v = new THREE.Vector3(x, y, z);
        if (v.length() <= radius && 0 < v.y) {
            return v;
        }
    }
}