import * as THREE from 'three';

export function RandomInSphere(radius: number) : THREE.Vector3 {
    while (true) {
        let x = Math.random() * 2 * radius - radius;
        let y = Math.random() * 2 * radius - radius;
        let z = Math.random() * 2 * radius - radius;
        let v = new THREE.Vector3(x, y, z);
        if (v.length() <= radius) {
            return v;
        }
    }
}

export function CosineSampleHemisphere(radius: number, normal : THREE.Vector3) : THREE.Vector3 {
    let u = Math.random();
    let v = Math.random();
    let phi = 2 * Math.PI * u;
    let cosTheta = Math.sqrt(v);
    let sinTheta = 1 - cosTheta * cosTheta;
    let x = radius * Math.cos(phi) * sinTheta;
    let y = radius * cosTheta;
    let z = radius * Math.sin(phi) * sinTheta;

    let out = new THREE.Vector3(x, y, z);
    let quaternion = new THREE.Quaternion();
    normal.normalize();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    out.applyQuaternion(quaternion);

    return out;
}

export function RandomInHemisphere(radius: number, normal : THREE.Vector3) : THREE.Vector3 {
    while (true) {
        let x = Math.random() * 2 * radius - radius;
        let y = Math.random() * 2 * radius - radius;
        let z = Math.random() * 2 * radius - radius;
        let v = new THREE.Vector3(x, y, z);
        if (v.length() <= radius && 0 < v.y) {
            let quaternion = new THREE.Quaternion();
            normal.normalize();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            v.applyQuaternion(quaternion);
            return v;
        }
    }
}

export function RandomInCuboid(x:number, y:number, z:number, normal: THREE.Vector3) {
    let u = Math.random() * x - x / 2;
    let v = Math.random() * y - y / 2;
    let w = Math.random() * z - z / 2;

    let out = new THREE.Vector3(u, v, w);
    let quaternion = new THREE.Quaternion();
    normal.normalize();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    out.applyQuaternion(quaternion);
    
    return out;
}

export function RandomInCone(radius: number, height: number, normal: THREE.Vector3) {
    while (true) {
        let x = Math.random() * 2 * radius - radius;
        let y = Math.random() * height;
        let z = Math.random() * 2 * radius - radius;
        let v = new THREE.Vector3(x, y, z);

        // Check if in cone
        let tip = new THREE.Vector3(0, height, 0);
        let dir = new THREE.Vector3(0, -1, 0);
        let cone_dist = v.clone().sub(tip).dot(dir);
        let cone_rad = (cone_dist / height) * radius;
        let orth_dist = v.clone().sub(tip).sub(dir.multiplyScalar(cone_dist)).length();
        if (orth_dist <= cone_rad) {
            // Rotate to normal
            let quaternion = new THREE.Quaternion();
            normal.normalize();
            quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
            v.applyQuaternion(quaternion);
            return v;
        }
    }
}

export function RandomInCylinder(radius : number, h : number, normal : THREE.Vector3) {
    let eps1 = Math.random();
    let eps2 = Math.random();
    let eps3 = Math.random();

    // Get angle from radius and height
    let angle = Math.atan(radius / h);
    let phi = 2 * Math.PI * eps1;
    let u = eps2 * (1 - Math.cos(angle)) + Math.cos(angle);

    let x = Math.sqrt(1 - u * u) * Math.cos(phi);
    let z = Math.sqrt(1 - u * u) * Math.sin(phi);
    let y = u;

    let v = new THREE.Vector3(x, y, z);
    let quaternion = new THREE.Quaternion();
    normal.normalize();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    v.applyQuaternion(quaternion);

    return v;
}