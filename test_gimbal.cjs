const THREE = require('three');

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
function shortestAngleDelta(target, current) {
    return Math.atan2(Math.sin(target - current), Math.cos(target - current));
}

let time = 0;
let phaseA = 0;
let phaseB = 0;
const orbitA = 6871;
const orbitB = 6879;
const omegaA = (2 * Math.PI) / 5400;
const omegaB = (2 * Math.PI) / 5500;
let simSpeed = 1.0;
let step = 0.016;

let state = {
    gimbal: {
        az: 0, el: 0,
        azVel: 0, elVel: 0,
        lastTargetAz: 0, lastTargetEl: 0,
        intAz: 0, intEl: 0
    }
};

for (let i = 0; i < 1000; i++) {
    time += step;
    phaseA += omegaA * step;
    phaseB += omegaB * step;

    const satA = new THREE.Vector3(Math.cos(phaseA) * orbitA, 0, Math.sin(phaseA) * orbitA);
    const satB = new THREE.Vector3(Math.cos(phaseB) * orbitB, Math.sin(phaseB) * orbitB * 0.12, Math.sin(phaseB) * orbitB * 0.993);

    const gimbalPos = satA.clone().add(new THREE.Vector3(0,0,320));
    const beaconPos = satB.clone().add(new THREE.Vector3(0,0,240));

    const dx = beaconPos.x - gimbalPos.x;
    const dy = beaconPos.y - gimbalPos.y;
    const dz = beaconPos.z - gimbalPos.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    
    const targetAz = Math.atan2(dx, dz);
    const targetEl = Math.atan2(dy, horizontal);

    let azError = shortestAngleDelta(targetAz, state.gimbal.az);
    let elError = targetEl - state.gimbal.el;

    const targetAzVel = shortestAngleDelta(targetAz, state.gimbal.lastTargetAz) / step;
    const targetElVel = (targetEl - state.gimbal.lastTargetEl) / step;
    state.gimbal.lastTargetAz = targetAz;
    state.gimbal.lastTargetEl = targetEl;

    state.gimbal.intAz += azError * step;
    state.gimbal.intEl += elError * step;
    state.gimbal.intAz = clamp(state.gimbal.intAz, -0.01, 0.01);
    state.gimbal.intEl = clamp(state.gimbal.intEl, -0.01, 0.01);

    const Kp = 250.0;
    const Ki = 15.0;
    const damping = 0.85;

    state.gimbal.azVel += (azError * Kp + state.gimbal.intAz * Ki) * step;
    state.gimbal.azVel = targetAzVel + (state.gimbal.azVel - targetAzVel) * damping;
    
    state.gimbal.elVel += (elError * Kp + state.gimbal.intEl * Ki) * step;
    state.gimbal.elVel = targetElVel + (state.gimbal.elVel - targetElVel) * damping;

    state.gimbal.az += state.gimbal.azVel * step;
    state.gimbal.el += state.gimbal.elVel * step;

    state.gimbal.az = Math.atan2(Math.sin(state.gimbal.az), Math.cos(state.gimbal.az));

    const opticalAxis = new THREE.Vector3(
        Math.sin(state.gimbal.az) * Math.cos(state.gimbal.el),
        Math.sin(state.gimbal.el),
        Math.cos(state.gimbal.az) * Math.cos(state.gimbal.el)
    ).normalize();

    const targetDir = new THREE.Vector3(dx, dy, dz).normalize();

    const dot = clamp(opticalAxis.dot(targetDir), -1, 1);
    const errUrad = Math.acos(dot) * 1e6;

    if (i % 100 === 0 || i === 999) {
        console.log(`Step ${i}: Error = ${errUrad.toFixed(2)} urad | azError = ${(azError*1e6).toFixed(2)} | elError = ${(elError*1e6).toFixed(2)}`);
    }
}
