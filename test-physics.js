import * as THREE from 'three';
import { engine } from './src/simulation/physicsEngine.js';

for (let i = 0; i < 200; i++) {
  engine.update(0.016); // 16ms per frame
  
  // Emulate Satellites.jsx logic
  const state = engine.getState();
  const gimbalPos = state.satA.position.clone().add(engine.gimbalOffset);
  const bToGimbal = new THREE.Vector3().subVectors(gimbalPos, state.satB.position).normalize();
  const beaconPos = state.satB.position.clone().add(bToGimbal.multiplyScalar(240));
  
  const targetDirection = beaconPos.clone().sub(gimbalPos).normalize();
  
  const opticalAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(state.gimbalQuat).normalize();
  
  const dot = THREE.MathUtils.clamp(opticalAxis.dot(targetDirection), -1, 1);
  const pointingErrorRad = Math.acos(dot);
  const pointingErrorUrad = pointingErrorRad * 1e6;
  
  engine.setAuthoritativeError(pointingErrorUrad, opticalAxis, targetDirection, dot);
}

const finalState = engine.getState();
console.log("Link State:", finalState.linkState);
console.log("Pointing Error:", finalState.pointingError);
console.log("Optical Axis:", finalState.opticalAxis);
console.log("Target Dir:", finalState.targetDirObj);
console.log("Gimbal Quat:", finalState.gimbalQuat);
