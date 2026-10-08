import * as THREE from 'three';

// Physics stays in kilometres. Three.js components apply this conversion once.
export const SCENE_SCALE = 0.001;

export const LINK_STATES = {
  SEARCH: 'SEARCH',
  BEACON_DETECTION: 'BEACON_DETECTION',
  TRACKING: 'TRACKING',
  ALIGNMENT: 'ALIGNMENT',
  LOCKED: 'LOCKED',
  TRANSMITTING: 'TRANSMITTING',
  REACQUIRING: 'REACQUIRING',
  BLOCKED: 'BLOCKED',
};

class PhysicsEngine {
  constructor() {
    this.time = 0;
    this.visualTimeScale = 175;
    this.stateElapsed = 0;
    this.lockSettleTime = 0;
    this.eventRemaining = 0;
    this.eventDuration = 7;
    this.isPaused = false;
    this.simSpeed = 1.0;
    
    this.state = {
      satA: { position: new THREE.Vector3(), altitude: 500 },
      satB: { position: new THREE.Vector3(), altitude: 508 },
      beaconPos: new THREE.Vector3(),
      gimbalPos: new THREE.Vector3(),
      
      // We will use a quaternion for gimbal orientation
      gimbalQuat: new THREE.Quaternion(),
      gimbal: { az: 0, el: 0, targetAz: 0, targetEl: 0 },
      
      distance: 0,
      pointingError: 1000,
      receivedPower: -100,
      snr: 0,
      ber: 1,
      linkMargin: -72,
      dataRateGbps: 0,
      laserActive: false,
      simTime: 0,
      linkState: LINK_STATES.SEARCH,
      
      disturbances: {
        vibration: 0,
        thermalDrift: 0,
        spaceDust: 0,
        turbulence: 0,
        cloudInterference: 0,
      },
      effectiveDisturbances: {
        vibration: 0,
        thermalDrift: 0,
        spaceDust: 0,
        turbulence: 0,
        cloudInterference: 0,
      },
      diagnostics: {
        atmLoss: 0, cloudLoss: 0, dustLoss: 0, totalLoss: 0,
        thermalError: 0, turbError: 0, vibError: 0
      }
    };
    
    // Physical orbital params (Earth radius = 6371 km)
    this.earthRadius = 6371;
    this.orbitA = this.earthRadius + this.state.satA.altitude;
    this.orbitB = this.earthRadius + this.state.satB.altitude;
    
    // Orbital angular velocity (rad/s), realistic LEO is ~0.001 rad/s
    this.omegaA = 0.00105;
    this.omegaB = 0.00099;
    
    this.phaseA = 0;
    this.phaseB = 0.36; // separated enough to make both satellites obvious
    
    this.gimbalAxis = new THREE.Vector3(0, 0, 1); // default forward
    this.targetDir = new THREE.Vector3();
    this.commandedTarget = new THREE.Vector3();
    this.baseGimbalQuat = new THREE.Quaternion();
    this.targetQuat = new THREE.Quaternion();
    this.jitterQuat = new THREE.Quaternion();
    this.gimbalOffset = new THREE.Vector3(0, 0, 320);
    this.beaconOffset = new THREE.Vector3(0, 0, 240);
    this.jitterAxis = new THREE.Vector3(1, 1, 0).normalize();
    this.worldUp = new THREE.Vector3(0, 1, 0);
    this.opticalAxis = new THREE.Vector3(0, 0, 1);
    this.sweepEuler = new THREE.Euler();
    
    // State machine thresholds
    this.lockThresholdUrad = 20;
    this.alignThresholdUrad = 200;
    this.reacquireThresholdUrad = 200;
    this.autoTrack = true;
  }

  setDisturbances(newDists) {
    this.state.disturbances = { ...this.state.disturbances, ...newDists };
  }

  getDisturbances() {
    return this.state.disturbances;
  }

  introduceDisturbance() {
    this.eventRemaining = this.eventDuration;
  }

  transition(nextState) {
    if (nextState === this.state.linkState) return;
    this.state.linkState = nextState;
    this.stateElapsed = 0;
    this.lockSettleTime = 0;
  }

  update(dt) {
    if (this.isPaused) return;
    const step = THREE.MathUtils.clamp(dt, 0, 0.05) * this.simSpeed;
    this.time += step;
    this.state.simTime = this.time;
    this.stateElapsed += step;
    if (this.eventRemaining > 0) this.eventRemaining = Math.max(0, this.eventRemaining - step);

    const base = this.state.disturbances;
    const impulse = this.eventRemaining > 0
      ? Math.sin((this.eventRemaining / this.eventDuration) * Math.PI * 0.5)
      : 0;
    const clamp = (value) => THREE.MathUtils.clamp(value, 0, 1);
    
    // Check if disturbance values changed for debug logging
    if (this._lastDisturbances) {
      if (
        this._lastDisturbances.turbulence !== base.turbulence ||
        this._lastDisturbances.cloudInterference !== base.cloudInterference ||
        this._lastDisturbances.thermalDrift !== base.thermalDrift ||
        this._lastDisturbances.spaceDust !== base.spaceDust ||
        this._lastDisturbances.vibration !== base.vibration
      ) {
        console.log('[FSOC DISTURBANCE]');
        console.log(`Atmospheric: UI = ${base.turbulence * 100}% | Physics = ${base.turbulence.toFixed(2)}`);
        console.log(`Cloud: UI = ${base.cloudInterference * 100}% | Physics = ${base.cloudInterference.toFixed(2)}`);
        console.log(`Thermal: UI = ${base.thermalDrift * 100}% | Physics = ${base.thermalDrift.toFixed(2)}`);
        console.log(`Dust: UI = ${base.spaceDust * 100}% | Physics = ${base.spaceDust.toFixed(2)}`);
        this._shouldLogEffect = true;
      }
    }
    this._lastDisturbances = { ...base };

    const d = this.state.effectiveDisturbances = {
      turbulence: clamp(base.turbulence + impulse * 0.45),
      cloudInterference: clamp(base.cloudInterference + impulse * 0.25),
      spaceDust: clamp(base.spaceDust + impulse * 0.35),
      vibration: clamp(base.vibration + impulse * 0.8),
      thermalDrift: clamp(base.thermalDrift + impulse * 0.35),
    };

    // Two deterministic, visibly moving LEO tracks.
    const orbitStep = step * this.visualTimeScale;
    this.phaseA += this.omegaA * orbitStep;
    this.phaseB += this.omegaB * orbitStep;
    const { satA, satB, gimbalPos, beaconPos } = this.state;
    satA.position.set(Math.cos(this.phaseA) * this.orbitA, 0, Math.sin(this.phaseA) * this.orbitA);
    satB.position.set(
      Math.cos(this.phaseB) * this.orbitB,
      Math.sin(this.phaseB) * this.orbitB * 0.12,
      Math.sin(this.phaseB) * this.orbitB * 0.993,
    );
    gimbalPos.copy(satA.position).add(this.gimbalOffset);
    const bToGimbal = new THREE.Vector3().subVectors(gimbalPos, satB.position).normalize();
    beaconPos.copy(satB.position).add(bToGimbal.multiplyScalar(240));
    this.state.distance = gimbalPos.distanceTo(beaconPos);
    this.targetDir.subVectors(beaconPos, gimbalPos).normalize();

    // 1. True target direction
    const dx = beaconPos.x - gimbalPos.x;
    const dy = beaconPos.y - gimbalPos.y;
    const dz = beaconPos.z - gimbalPos.z;
    const horizontal = Math.sqrt(dx * dx + dz * dz);
    
    // Calculate target azimuth and elevation in RADIANS
    const targetAz = Math.atan2(dx, dz);
    const targetEl = Math.atan2(dy, horizontal);
    
    this.targetDir.set(dx, dy, dz).normalize();

    // 2. Calculate continuous disturbances
    const newThermalAz = d.thermalDrift * 0.05 * Math.sin(this.time * 0.3);
    const newThermalEl = d.thermalDrift * 0.05 * Math.cos(this.time * 0.3 * 0.7);

    // 3. Gimbal Servo (Quaternion-based tracker)
    if (!this.state.gimbalQuat) {
        this.state.gimbalQuat = new THREE.Quaternion();
    }

    if (this.state.linkState === LINK_STATES.SEARCH) {
        // Search pattern
        const searchTarget = new THREE.Vector3(
            Math.sin(Math.cos(this.time * 0.75) * 0.5),
            Math.sin(this.time * 1.25) * 0.2,
            Math.cos(Math.cos(this.time * 0.75) * 0.5)
        ).normalize();
        const searchQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), searchTarget);
        this.state.gimbalQuat.slerp(searchQuat, step * 2.0);
    } else if (this.autoTrack) {
        // Calculate effective target direction (true target + thermal drift)
        let effectiveTargetDir = this.targetDir.clone();
        if (newThermalAz !== 0 || newThermalEl !== 0) {
            const thermalQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-newThermalEl, -newThermalAz, 0, 'YXZ'));
            effectiveTargetDir.applyQuaternion(thermalQuat);
        }

        // The target quaternion aligns local +Z to the effective target direction
        const targetQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), effectiveTargetDir);

        // Smoothly slerp the gimbal quaternion toward the target quaternion
        // Using a high slerp factor effectively creates a critically damped response with zero overshoot.
        // FSMs (Fine Steering Mirrors) track extremely fast. We must multiply by visualTimeScale 
        // to prevent large steady-state tracking lag in fast-forward simulation.
        const servoSpeed = 50.0 * this.visualTimeScale; 
        this.state.gimbalQuat.slerp(targetQuat, Math.min(1.0, step * servoSpeed));
    }
    
    // 4. Calculate actual optical axis from the servo's current quaternion
    this.opticalAxis.copy(new THREE.Vector3(0, 0, 1).applyQuaternion(this.state.gimbalQuat)).normalize();

    // 5. Apply Fast Jitter (Vibration) & Beam Wander (Turbulence) to Optical Axis
    const turbX = d.turbulence * 0.0003 * (Math.sin(this.time * 12.3) + Math.cos(this.time * 7.7));
    const turbY = d.turbulence * 0.0003 * (Math.cos(this.time * 11.1) + Math.sin(this.time * 8.9));
    
    const jitter = d.vibration * 0.015 * (
      Math.sin(this.time * 31) * 0.7 + Math.sin(this.time * 17 + 0.8) * 0.3
    );

    const sideAxis = new THREE.Vector3().crossVectors(this.opticalAxis, this.worldUp);
    if (sideAxis.lengthSq() < 1e-12) sideAxis.set(1, 0, 0); else sideAxis.normalize();

    this.jitterQuat.setFromAxisAngle(this.worldUp, turbX);
    this.jitterQuat.multiply(new THREE.Quaternion().setFromAxisAngle(sideAxis, turbY));
    this.jitterQuat.multiply(new THREE.Quaternion().setFromAxisAngle(this.jitterAxis, jitter));
    
    // Apply jitter to get final optical axis
    this.gimbalAxis.copy(this.opticalAxis).applyQuaternion(this.jitterQuat).normalize();
    
    // Update gimbalQuat for 3D visual rendering by applying the world-space jitter
    // We multiply on the left because jitterQuat is in world space.
    // This perfectly preserves the roll of the servo and prevents Math snapping.
    this.state.gimbalQuat.premultiply(this.jitterQuat);

    // Update legacy telemetry for the UI tracking camera
    this.state.gimbal.az = Math.atan2(this.gimbalAxis.x, this.gimbalAxis.z);
    this.state.gimbal.el = Math.asin(this.gimbalAxis.y);

    // The pointing error is now injected directly from the Three.js renderer
    // via setAuthoritativeError to ensure 100% ground-truth consistency.

    // Save diagnostic values
    const atmLoss = d.turbulence * 8.0;
    const cloudLoss = d.cloudInterference * 40.0;
    const dustLoss = d.spaceDust * 68.0; // Significant loss at 100% dust
    this.state.autoTrack = this.autoTrack;
    this.state.diagnostics = {
      atmLoss, cloudLoss, dustLoss, totalLoss: atmLoss + cloudLoss + dustLoss,
      thermalError: Math.abs(newThermalAz * 1e6),
      turbError: Math.sqrt(turbX**2 + turbY**2) * 1e6,
      vibError: Math.abs(jitter * 1e6)
    };
    
    // Save target AZ/EL for diagnostics
    this.state.gimbal.targetAz = targetAz;
    this.state.gimbal.targetEl = targetEl;
    this.state.opticalAxis = { x: this.gimbalAxis.x, y: this.gimbalAxis.y, z: this.gimbalAxis.z };
    this.state.targetDirObj = { x: this.targetDir.x, y: this.targetDir.y, z: this.targetDir.z };

    // Earth Occlusion and Cloud Block Check
    const rayVec = new THREE.Vector3().subVectors(beaconPos, gimbalPos);
    const rayLenSq = rayVec.lengthSq();
    let losBlocked = false;
    if (rayLenSq > 0) {
      const pVec = new THREE.Vector3().copy(gimbalPos).negate(); // Vector from gimbal to origin
      const t = pVec.dot(rayVec) / rayLenSq;
      if (t >= 0 && t <= 1) {
        const closestPoint = new THREE.Vector3().copy(gimbalPos).add(rayVec.multiplyScalar(t));
        if (closestPoint.length() < this.earthRadius) {
          losBlocked = true;
        }
      }
    }
    if (d.cloudInterference >= 0.8) {
      losBlocked = true;
    }
    this.state.losBlocked = losBlocked;
    
    const error = this.state.pointingError;
    const current = this.state.linkState;
    
    const Pt = 40; // dBm
    const Gt = 110; // dBi
    const Gr = 110; // dBi
    const lambda = 1550e-9;
    const R = Math.max(this.state.distance * 1000, 1000); // meters
    const fspl = 20 * Math.log10((4 * Math.PI * R) / lambda);
    
    // Gaussian pointing loss
    const beamDivergenceRad = 200e-6; // 200 urad
    const budgetErrorRad = error * 1e-6;
    const pointingLoss = 4.343 * Math.pow(budgetErrorRad / beamDivergenceRad, 2);
    
    const propagationLoss = this.state.diagnostics.totalLoss;
    const theoreticalReceivedPower = Pt + Gt + Gr - fspl - propagationLoss - pointingLoss;
    
    const noiseFloor = -70 + d.turbulence * 5 + d.spaceDust * 2;
    const theoreticalSnr = theoreticalReceivedPower - noiseFloor;
    
    // Determine Link State based on physics
    const ALIGN_THRESHOLD = 50000; // 50,000 urad
    const LOCK_THRESHOLD = 10; // 10 urad
    const UNLOCK_THRESHOLD = 25; // 25 urad
    
    // Simplistic beacon detection (if LOS and within some FOV)
    const beaconDetected = !losBlocked && error < 1000000;
    
    if (losBlocked) {
      this.transition(LINK_STATES.BLOCKED);
    } else if (current === LINK_STATES.BLOCKED) {
      this.transition(LINK_STATES.SEARCH);
    } else if (current === LINK_STATES.SEARCH && beaconDetected) {
      this.transition(LINK_STATES.BEACON_DETECTION);
    } else if (current === LINK_STATES.BEACON_DETECTION) {
      this.transition(LINK_STATES.TRACKING);
    } else if (current === LINK_STATES.TRACKING) {
      if (error < ALIGN_THRESHOLD) this.transition(LINK_STATES.ALIGNMENT);
      else if (!beaconDetected) this.transition(LINK_STATES.SEARCH);
    } else if (current === LINK_STATES.ALIGNMENT) {
      if (error <= LOCK_THRESHOLD) this.transition(LINK_STATES.LOCKED);
      else if (error > ALIGN_THRESHOLD * 1.5) this.transition(LINK_STATES.REACQUIRING);
    } else if (current === LINK_STATES.LOCKED) {
      if (error > UNLOCK_THRESHOLD) this.transition(LINK_STATES.ALIGNMENT);
      else if (theoreticalSnr > 2) this.transition(LINK_STATES.TRANSMITTING);
    } else if (current === LINK_STATES.TRANSMITTING) {
      if (error > UNLOCK_THRESHOLD || theoreticalSnr <= 2) this.transition(LINK_STATES.ALIGNMENT);
    } else if (current === LINK_STATES.REACQUIRING) {
      if (error < ALIGN_THRESHOLD) this.transition(LINK_STATES.ALIGNMENT);
      else if (this.stateElapsed > 5.0) this.transition(LINK_STATES.SEARCH);
    }

    const linkBudgetAllowsTransmission = theoreticalSnr > 2;
    const isTransmitting = (current === LINK_STATES.TRANSMITTING || current === LINK_STATES.LOCKED) 
                            && error <= UNLOCK_THRESHOLD 
                            && linkBudgetAllowsTransmission 
                            && beaconDetected;

    this.state.servoActive = this.autoTrack && this.state.linkState !== LINK_STATES.SEARCH;
    
    if (isTransmitting) {
      this.state.receivedPower = theoreticalReceivedPower;
      this.state.snr = Math.max(0, theoreticalSnr);
      this.state.linkMargin = this.state.receivedPower + 48; // -48 dBm min
      
      const snrLinear = Math.pow(10, this.state.snr / 10);
      this.state.ber = Math.max(1e-15, Math.min(0.5, 0.5 * Math.exp(-snrLinear / 2))); // BPSK approximation
      
      const linkQualityFactor = Math.max(0, Math.min(1, this.state.snr / 20));
      this.state.dataRateGbps = 10 * linkQualityFactor;
    } else {
      this.state.receivedPower = -120;
      this.state.snr = 0;
      this.state.linkMargin = -72;
      this.state.ber = 0.5;
      this.state.dataRateGbps = 0;
    }
    this.state.laserActive = isTransmitting && this.state.dataRateGbps > 0;

    if (this._shouldLogEffect) {
      console.log('[FSOC EFFECT]');
      console.log(`Pointing Error = ${this.state.pointingError.toFixed(2)} µrad`);
      console.log(`Received Power = ${this.state.receivedPower.toFixed(2)} dBm`);
      console.log(`SNR = ${this.state.snr.toFixed(2)} dB`);
      console.log(`BER = ${this.state.ber.toExponential(2)}`);
      console.log(`Link Margin = ${this.state.linkMargin.toFixed(2)} dB`);
      console.log(`State = ${this.state.linkState}`);
      this._shouldLogEffect = false;
    }
  }

  setAuthoritativeError(errUrad, opticalAxis, targetDir, dotProduct) {
    this.state.pointingError = THREE.MathUtils.clamp(errUrad, 0, Math.PI * 1e6);
    if (!Number.isFinite(this.state.pointingError)) this.state.pointingError = Math.PI * 1e6;
    this.state.opticalAxis = { x: opticalAxis.x, y: opticalAxis.y, z: opticalAxis.z };
    this.state.targetDirObj = { x: targetDir.x, y: targetDir.y, z: targetDir.z };
    this.state.dotProduct = dotProduct;
  }

  getState() {
    return this.state;
  }
}

export const engine = new PhysicsEngine();
