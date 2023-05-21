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

    let theta = 2 * Math.PI * eps1;
    let r = Math.sqrt(eps2) * radius;
    let x = r * Math.cos(theta);
    let z = r * Math.sin(theta);
    let y = Math.random() * h;

    let v = new THREE.Vector3(x, y, z);
    let quaternion = new THREE.Quaternion();
    normal.normalize();
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    v.applyQuaternion(quaternion);

    return v;
}

export function IsInCuboid(pos: THREE.Vector3, cubePos: THREE.Vector3, w: number, h: number, d: number) {
    let x = pos.x - cubePos.x;
    let y = pos.y - cubePos.y;
    let z = pos.z - cubePos.z;

    return x >= -w / 2 && x <= w / 2 && y >= -h / 2 && y <= h / 2 && z >= -d / 2 && z <= d / 2;
}

export function IsInCylinder(pos: THREE.Vector3, cylinderPos : THREE.Vector3, radius: number, height: number) {
    let x = pos.x - cylinderPos.x;
    let y = pos.y - cylinderPos.y;
    let z = pos.z - cylinderPos.z;
    let dist = Math.sqrt(x * x + z * z);
    return dist <= radius && 0 <= y && y <= height;
}

export function IsInCone(pos: THREE.Vector3, conePos: THREE.Vector3, radius: number, height: number) {
    let x = pos.x - conePos.x;
    let y = pos.y - conePos.y;
    let z = pos.z - conePos.z;
    pos = new THREE.Vector3(x, y, z);

    let tip = new THREE.Vector3(0, height, 0);
    let dir = new THREE.Vector3(0, -1.0, 0);
    let cone_dist = pos.sub(tip).dot(dir);

    if (cone_dist < 0 || cone_dist > height) { return false; }

    let cone_rad = (cone_dist / height) * radius;
    let orth_dist = pos.sub(tip).sub(dir.multiplyScalar(cone_dist)).length();
    return orth_dist <= cone_rad;
}

export function IsInSphere(pos: THREE.Vector3, spherePos: THREE.Vector3, radius: number) {
    let x = pos.x - spherePos.x;
    let y = pos.y - spherePos.y;
    let z = pos.z - spherePos.z;
    return Math.sqrt(x * x + y * y + z * z) <= radius;
}

export function IsInHemisphere(pos: THREE.Vector3, spherePos: THREE.Vector3, radius: number) {
    let x = pos.x - spherePos.x;
    let y = pos.y - spherePos.y;
    let z = pos.z - spherePos.z;
    return Math.sqrt(x * x + y * y + z * z) <= radius && y >= 0;
}

