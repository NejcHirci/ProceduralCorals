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

export function RandomInCuboid(x:number, y:number, z:number) {
    let u = Math.random() * x - x / 2;
    let v = Math.random() * y - y / 2;
    let w = Math.random() * z - z / 2;
    return new THREE.Vector3(u, v, w);
}

export function RandomInCone(radius: number, h: number, normal: THREE.Vector3) {
    let eps1 = Math.random();
    let eps2 = Math.random();
    let theta = 2 * Math.PI * eps1;
    let r = Math.sqrt(eps2);
    let x = r * Math.cos(theta);
    let z = r * Math.sin(theta);
    let y = 1 - eps2;

    let v = new THREE.Vector3(x, y, z);
    let quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    v.applyQuaternion(quaternion);

    return new THREE.Vector3(x, y, z);
}

export function RandomInCylinder(radius : number, h : number, normal : THREE.Vector3) {
    let eps1 = Math.random();
    let eps2 = Math.random();
    let eps3 = Math.random();

    let theta = 2 * Math.PI * eps1;
    let r = radius * Math.sqrt(eps2);
    let x = r * Math.cos(theta);
    let z = r * Math.sin(theta);
    let y = h * eps3;

    let v = new THREE.Vector3(x, y, z);
    let quaternion = new THREE.Quaternion();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    v.applyQuaternion(quaternion);

    return v;
}