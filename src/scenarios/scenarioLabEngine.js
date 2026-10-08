import * as THREE from 'three';

// ===================================================================
// FSOC SCENARIO LAB ENGINE
// Completely independent from the simulation physicsEngine.
// All telemetry is derived from actual 3D scenario state.
// ===================================================================

export const SCENARIO_PRESETS = {
  NOMINAL: {
    name: 'NOMINAL LINK',
    asteroids: false,
    spaceDustDensity: 0.05,
    lidar: true,
    atmosphericTurbulence: false,
    thermalDrift: false,
  },
  ASTEROID_OBSTRUCTION: {
    name: 'ASTEROID OBSTRUCTION',
    asteroids: true,
    spaceDustDensity: 0.05,
    lidar: true,
    atmosphericTurbulence: false,
    thermalDrift: false,
  },
  SPACE_DUST: {
    name: 'SPACE DUST CLOUD',
    asteroids: false,
    spaceDustDensity: 0.85,
    lidar: true,
    atmosphericTurbulence: false,
    thermalDrift: false,
  },
  COMBINED: {
    name: 'COMBINED ENVIRONMENT',
    asteroids: true,
    spaceDustDensity: 0.75,
    lidar: true,
    atmosphericTurbulence: true,
    thermalDrift: true,
  },
};

// Deterministic pseudo-random
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

class ScenarioLabEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.time = 0;
    this.running = false;
    this.paused = false;
    this.activePreset = 'NOMINAL';

    // Different parameters but safe relative geometry
    // To prevent rapid occultation, their initial phase difference and speed ensures Earth is outside the optical path.
    // Wrap phases during update to prevent unbounded numerical growth.
    this.orbits = {
      satA: {
        radius: 11.0,
        speed: 0.03,
        inclination: 0.15,
        phase: 0,
      },
      satB: {
        radius: 26.0,
        speed: 0.02,
        inclination: 0.3,
        phase: 0.5,
      },
    };

    // Positions (updated each frame via refs, exposed for telemetry)
    this.nominalSatAPos = new THREE.Vector3();
    this.satAPos = new THREE.Vector3();
    this.satBPos = new THREE.Vector3();
    this.satATerminalPos = new THREE.Vector3();
    this.satBBeaconPos = new THREE.Vector3();

    // Autonomous Avoidance Navigation
    this.navState = 'NORMAL'; 
    this.navTimer = 0;
    this.clearanceTimer = 0;
    this.satAVelocity = new THREE.Vector3();
    this.satBVelocity = new THREE.Vector3();
    this.avoidanceVector = new THREE.Vector3();
    this.avoidanceOffset = new THREE.Vector3();

    // Link & Transmission State
    this.linkState = 'INITIALIZATION';
    this.laserEnabled = false;
    this.dataTransfer = false;

    // Event Log & Timeline
    this.eventLog = [];
    this.timelinePhase = 1; // 1 to 8

    // Gimbal tracking
    this.gimbalQuat = new THREE.Quaternion();
    this.gimbalAz = 0;
    this.gimbalEl = 0;
    this.pointingError = 500; // µrad

    // Asteroids
    this.asteroids = [];
    this.asteroidSeed = 42;

    // Environment controls
    this.spaceDustDensity = 0.05;
    this.atmosphericTurbulence = false;
    this.thermalDrift = false;
    this.lidarEnabled = true;

    // LiDAR state
    this.lidarDetected = [];
    this.lidarNearestObj = null;
    this.lidarNearestDist = Infinity;
    this.lidarObstructionRisk = 'NONE';
    this.lidarNearestVelocity = 0;

    // Link telemetry (calculated from state)
    this.distance = 0;
    this.lineOfSight = true;
    this.receivedPower = -42;
    this.snr = 45;
    this.ber = 1e-15;
    this.linkMargin = 30;
    this.dataRate = 10; // Gbps
    this.linkStatus = 'IDLE';
    this.laserActive = false;

    // Disturbance state
    this.dustAttenuation = 0; // dB
    this.atmTurbulenceLoss = 0; // dB
    this.thermalDriftLoss = 0; // dB
    this.pointingLoss = 0; // dB
    this.obstructed = false;

    // Pre-allocated vectors for performance
    this._dir = new THREE.Vector3();
    this._targetQuat = new THREE.Quaternion();
    this._optAxis = new THREE.Vector3();
    this._tempV = new THREE.Vector3();
    this._closestPt = new THREE.Vector3();
  }

  applyPreset(presetKey) {
    const preset = SCENARIO_PRESETS[presetKey];
    if (!preset) return;
    this.activePreset = presetKey;
    this.spaceDustDensity = preset.spaceDustDensity;
    this.atmosphericTurbulence = preset.atmosphericTurbulence;
    this.thermalDrift = preset.thermalDrift;
    this.lidarEnabled = preset.lidar;

    this.logEvent(`SCENARIO LOADED: ${preset.name}`);

    // Rebuild asteroids
    if (preset.asteroids) {
      this._generateAsteroids(presetKey);
    } else {
      this.asteroids = [];
    }
  }

  logEvent(msg) {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    // Prevent duplicate consecutive messages
    if (this.eventLog.length > 0 && this.eventLog[0].msg === msg) return;
    this.eventLog.unshift({ time: timeStr, msg });
    if (this.eventLog.length > 50) this.eventLog.pop();
  }

  _generateAsteroids(presetKey) {
    const rand = seededRandom(this.asteroidSeed);
    this.asteroids = [];

    const count = presetKey === 'COMBINED' ? 12 : 8;

    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 8 + rand() * 14;
      const y = (rand() - 0.5) * 8;
      this.asteroids.push({
        id: `AST-${String(i + 1).padStart(2, '0')}`,
        position: new THREE.Vector3(
          Math.cos(angle) * dist,
          y,
          Math.sin(angle) * dist
        ),
        velocity: new THREE.Vector3(
          (rand() - 0.5) * 0.3,
          (rand() - 0.5) * 0.1,
          (rand() - 0.5) * 0.3
        ),
        radius: 0.15 + rand() * 0.45,
        rotation: new THREE.Euler(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI),
        rotSpeed: (rand() - 0.5) * 0.5,
      });
    }

    // For ASTEROID_OBSTRUCTION: place one asteroid near the link path
    if (presetKey === 'ASTEROID_OBSTRUCTION' || presetKey === 'COMBINED') {
      // Will be positioned dynamically between the two satellites
      this.asteroids.push({
        id: 'AST-XX',
        position: new THREE.Vector3(0, 0, 0), // will be set in update
        velocity: new THREE.Vector3(0.05, 0.01, -0.02),
        radius: 0.35,
        rotation: new THREE.Euler(0.5, 0.3, 0.1),
        rotSpeed: 0.2,
        _isPathAsteroid: true, // marker
        _initialized: false,
      });
    }
  }

  start() {
    if (this.running) {
      this.paused = false;
      return;
    }
    
    this.running = true;
    this.paused = false;
    
    if (this.time === 0) {
      this.linkState = 'INITIALIZATION';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.logEvent('INITIALIZATION STARTED');
      this.logEvent('LiDAR scan initiated');
      this.timelinePhase = 1; // 01 INITIALIZATION
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
  }

  stop() {
    this.running = false;
    this.laserActive = false;
    this.linkStatus = 'IDLE';
  }

  update(dt) {
    if (!this.running || this.paused) return;
    const step = Math.min(dt, 0.05);
    this.time += step;

    this._updateOrbits(step);
    this._updateAsteroids(step);
    this._updateGimbalTracking(step);
    this._updateLiDAR();
    this._updateLinkBudget(step);
  }

  _updateOrbits(step) {
    // Satellite A nominal orbit
    const oA = this.orbits.satA;
    oA.phase = (oA.phase + oA.speed * step) % (Math.PI * 2);
    this.nominalSatAPos.set(
      Math.cos(oA.phase) * oA.radius,
      Math.sin(oA.phase) * oA.radius * oA.inclination,
      Math.sin(oA.phase) * oA.radius
    );

    // Sat A velocity approximation
    const nextPhaseA = oA.phase + 0.01;
    this._tempV.set(
      Math.cos(nextPhaseA) * oA.radius,
      Math.sin(nextPhaseA) * oA.radius * oA.inclination,
      Math.sin(nextPhaseA) * oA.radius
    );
    this.satAVelocity.subVectors(this._tempV, this.nominalSatAPos).normalize().multiplyScalar(oA.speed * oA.radius * 20); // rough scaling to units/sec

    // Apply Avoidance Offset
    this.satAPos.copy(this.nominalSatAPos).add(this.avoidanceOffset);

    // Satellite B orbit
    const oB = this.orbits.satB;
    oB.phase = (oB.phase + oB.speed * step) % (Math.PI * 2);
    this.satBPos.set(
      Math.cos(oB.phase) * oB.radius,
      Math.sin(oB.phase) * oB.radius * oB.inclination,
      Math.sin(oB.phase) * oB.radius
    );
    
    // Sat B velocity
    const nextPhaseB = oB.phase + 0.01;
    this._tempV.set(
      Math.cos(nextPhaseB) * oB.radius,
      Math.sin(nextPhaseB) * oB.radius * oB.inclination,
      Math.sin(nextPhaseB) * oB.radius
    );
    this.satBVelocity.subVectors(this._tempV, this.satBPos).normalize().multiplyScalar(oB.speed * oB.radius * 20);

    // Terminal/beacon positions track satellite positions
    this.satATerminalPos.copy(this.satAPos);
    this.satBBeaconPos.copy(this.satBPos);

    // Distance
    this.distance = this.satAPos.distanceTo(this.satBPos);
  }

  _updateAsteroids(step) {
    for (const ast of this.asteroids) {
      // Position the collision-course asteroid to hit the optical corridor
      if (ast._isPathAsteroid && !ast._initialized && this.time > 0.1) {
        const timeToHit = 8.0;
        
        // Predict satellites
        const oA = this.orbits.satA;
        const phaseA = oA.phase + (oA.speed * timeToHit);
        const futA = new THREE.Vector3(Math.cos(phaseA)*oA.radius, Math.sin(phaseA)*oA.radius*oA.inclination, Math.sin(phaseA)*oA.radius);
        
        const oB = this.orbits.satB;
        const phaseB = oB.phase + (oB.speed * timeToHit);
        const futB = new THREE.Vector3(Math.cos(phaseB)*oB.radius, Math.sin(phaseB)*oB.radius*oB.inclination, Math.sin(phaseB)*oB.radius);

        // Asteroid targets a point on the optical corridor (30% from Sat A)
        const targetPt = new THREE.Vector3().lerpVectors(futA, futB, 0.3);

        // Asteroid velocity
        ast.velocity.set(0.1, -0.4, 0.5).normalize().multiplyScalar(1.8); // 1.8 units/sec

        // Start position is target - (velocity * time)
        ast.position.copy(targetPt).sub(ast.velocity.clone().multiplyScalar(timeToHit));
        
        ast._initialized = true;
      }

      // Drift
      ast.position.addScaledVector(ast.velocity, step);
      ast.rotation.x += ast.rotSpeed * step;
      ast.rotation.y += ast.rotSpeed * step * 0.7;
    }
  }

  _updateGimbalTracking(step) {
    // Gimbal on Sat A points toward Sat B beacon
    this._dir.subVectors(this.satBBeaconPos, this.satATerminalPos).normalize();

    // Target quaternion: from default forward (+Z) to target direction
    this._targetQuat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._dir);

    // Servo tracking: instant when locked, damped when searching
    const trackRate = this.navState === 'NORMAL' ? 1.0 : Math.min(1.0, step * 3.0);
    this.gimbalQuat.slerp(this._targetQuat, trackRate);

    // Calculate actual optical axis
    this._optAxis.set(0, 0, 1).applyQuaternion(this.gimbalQuat).normalize();

    // Pointing error
    const dot = THREE.MathUtils.clamp(this._optAxis.dot(this._dir), -1, 1);
    const errorRad = Math.acos(dot);
    this.pointingError = errorRad * 1e6; // µrad

    // Add thermal drift jitter
    if (this.thermalDrift && this.time > 2) {
      const driftJitter = Math.sin(this.time * 0.5) * 3.0 + Math.sin(this.time * 1.7) * 1.5;
      this.pointingError += Math.abs(driftJitter);
    }

    // Add atmospheric turbulence jitter
    if (this.atmosphericTurbulence && this.time > 2) {
      const atmJitter = Math.sin(this.time * 8) * 2.0 + Math.sin(this.time * 23) * 0.8;
      this.pointingError += Math.abs(atmJitter);
    }

    // Gimbal Az/El (for display)
    this.gimbalAz = Math.atan2(this._dir.x, this._dir.z) * (180 / Math.PI);
    this.gimbalEl = Math.asin(THREE.MathUtils.clamp(this._dir.y, -1, 1)) * (180 / Math.PI);
  }

  _updateLiDAR() {
    if (!this.lidarEnabled) {
      this.lidarDetected = [];
      this.lidarNearestObj = null;
      this.lidarNearestDist = Infinity;
      this.lidarObstructionRisk = 'NONE';
      this.lidarNearestVelocity = 0;
      return;
    }

    const detected = [];
    let nearestDist = Infinity;
    let nearestObj = null;
    let obstructionRisk = 'NONE';

    let obstructionPredicted = false;
    let computedAvoidanceTarget = new THREE.Vector3();
    let minClearance = Infinity;

    const u = new THREE.Vector3().subVectors(this.satBPos, this.satAPos).normalize();
    const lengthAB = this.satBPos.distanceTo(this.satAPos);

    for (const ast of this.asteroids) {
      const distToSatA = ast.position.distanceTo(this.satAPos);

      if (distToSatA < 45) {
        // Predictive Collision Detection for Optical Corridor
        const relPos = new THREE.Vector3().subVectors(ast.position, this.satAPos);
        const relVel = new THREE.Vector3().subVectors(ast.velocity, this.satAVelocity);
        
        const w = new THREE.Vector3().crossVectors(relPos, u);
        const v = new THREE.Vector3().crossVectors(relVel, u);
        const vSq = v.lengthSq();
        
        let tca = -1;
        let risk = 'LOW';
        let currentClearance = new THREE.Vector3().crossVectors(relPos, u).length() - ast.radius;

        if (vSq > 1e-6) {
          tca = -w.dot(v) / vSq;
          if (tca > 0 && tca < 12) {
            // Check if intercept is between A and B
            const p_t = ast.position.clone().add(ast.velocity.clone().multiplyScalar(tca));
            const a_t = this.satAPos.clone().add(this.satAVelocity.clone().multiplyScalar(tca));
            const proj = new THREE.Vector3().subVectors(p_t, a_t).dot(u);
            
            if (proj > 0 && proj < lengthAB) {
              const clearanceAtTca = Math.sqrt(Math.max(0, w.lengthSq() - Math.pow(w.dot(v), 2) / vSq)) - ast.radius;
              
              if (clearanceAtTca < 2.5) {
                risk = clearanceAtTca < 1.0 ? 'CRITICAL' : 'HIGH';
                if (risk === 'CRITICAL' || risk === 'HIGH') {
                  obstructionRisk = risk;
                  obstructionPredicted = true;
                  
                  if (clearanceAtTca < minClearance) {
                    minClearance = clearanceAtTca;
                    // Avoidance vector: push Sat A away from the asteroid to shift the corridor
                    const ptOnLine = a_t.clone().add(u.clone().multiplyScalar(proj));
                    const pushDir = new THREE.Vector3().subVectors(ptOnLine, p_t).normalize();
                    // Shift by 6 units laterally
                    computedAvoidanceTarget.copy(pushDir).multiplyScalar(6.0);
                  }
                }
              } else if (clearanceAtTca < 5.0) {
                risk = 'MEDIUM';
                if (obstructionRisk === 'NONE' || obstructionRisk === 'LOW') obstructionRisk = 'MEDIUM';
              }
            }
          }
        }

        if (distToSatA < nearestDist) {
          nearestDist = distToSatA;
          nearestObj = ast;
        }

        detected.push({
          id: ast.id,
          distance: distToSatA,
          clearance: Math.max(0, currentClearance),
          tca: tca > 0 ? tca : null,
          risk,
          velocity: relVel.length(),
          position: ast.position.clone(),
        });
      }
    }

    // High-density dust clouds
    if (this.spaceDustDensity > 0.5) {
      detected.push({
        id: 'DUST-CLOUD',
        distance: this.distance * 0.5,
        clearance: 0,
        risk: 'LOW',
        velocity: 0,
        position: this._tempV.addVectors(this.satAPos, this.satBPos).multiplyScalar(0.5).clone(),
      });
    }

    this.lidarDetected = detected;
    this.lidarNearestObj = nearestObj;
    this.lidarNearestDist = nearestDist;
    this.lidarObstructionRisk = obstructionRisk;
    this.lidarNearestVelocity = nearestObj ? detected.find(d => d.id === nearestObj.id).velocity : 0;

    // Apply Avoidance State Machine
    this._updateAvoidance(1/60, obstructionPredicted, computedAvoidanceTarget);
  }

  _updateAvoidance(step, obstructionPredicted, computedAvoidanceTarget) {
    if (obstructionPredicted) {
      if (this.navState === 'NORMAL' || this.navState === 'RETURNING') {
        this.navState = 'OBSTRUCTION_DETECTED';
        this.navTimer = 0;
        this.logEvent('Optical obstruction predicted');
        const obj = this.lidarDetected.find(d => d.risk === 'CRITICAL' || d.risk === 'HIGH');
        if (obj) {
           this.logEvent(`${obj.id} detected`);
           this.logEvent(`CLOSEST APPROACH: ${(obj.tca).toFixed(1)}s`);
           this.logEvent('OBSTRUCTION RISK: HIGH');
        }
      }

      this.navTimer += step;
      if (this.navState === 'OBSTRUCTION_DETECTED' && this.navTimer > 1.0) {
        this.navState = 'LASER_SAFE_SHUTDOWN';
        this.logEvent('LASER SAFE SHUTDOWN');
        this.logEvent('DATA TRANSFER STOPPED');
      } else if (this.navState === 'LASER_SAFE_SHUTDOWN' && this.navTimer > 2.0) {
        this.navState = 'AVOIDANCE_MANEUVER';
        this.logEvent('AVOIDANCE MANEUVER INITIATED');
      }

      if (this.navState === 'AVOIDANCE_MANEUVER') {
        this.avoidanceVector.lerp(computedAvoidanceTarget, step * 1.5);
      }
      this.clearanceTimer = 0;
    } else {
      if (this.navState === 'AVOIDANCE_MANEUVER' || this.navState === 'LASER_SAFE_SHUTDOWN' || this.navState === 'OBSTRUCTION_DETECTED') {
        this.navState = 'CLEARANCE_CONFIRMED';
        this.logEvent('Asteroid cleared');
      }
      
      if (this.navState === 'CLEARANCE_CONFIRMED') {
        this.clearanceTimer += step;
        if (this.clearanceTimer > 6.0) {
          this.navState = 'RETURNING';
          this.logEvent('RETURNING TO NOMINAL TRAJECTORY');
        }
      }
      
      if (this.navState === 'RETURNING' || this.navState === 'CLEARANCE_CONFIRMED') {
        this.avoidanceVector.lerp(new THREE.Vector3(0,0,0), step * 0.8);
        if (this.navState === 'RETURNING' && this.avoidanceOffset.lengthSq() < 0.1) {
          this.navState = 'NORMAL';
          this.avoidanceVector.set(0,0,0);
          this.avoidanceOffset.set(0,0,0);
        }
      }
    }
    this.avoidanceOffset.lerp(this.avoidanceVector, step * 2.0);
  }

  _updateLinkBudget(step) {
    // 1. Geometric obstruction check (Asteroids)
    this.obstructed = false;
    const beamLine = new THREE.Line3(this.satATerminalPos, this.satBBeaconPos);
    for (const ast of this.asteroids) {
      beamLine.closestPointToPoint(ast.position, true, this._closestPt);
      const distToBeam = ast.position.distanceTo(this._closestPt);
      if (distToBeam < ast.radius * 1.2) {
        this.obstructed = true;
        break;
      }
    }

    // 1.5 Geometric obstruction check (Earth)
    let earthOcculted = false;
    const origin = new THREE.Vector3(0,0,0);
    const u = new THREE.Vector3().subVectors(this.satBBeaconPos, this.satATerminalPos).normalize();
    const w = new THREE.Vector3().subVectors(origin, this.satATerminalPos);
    const proj = w.dot(u);
    if (proj > 0 && proj < this.distance) {
        const distToEarth = new THREE.Vector3().crossVectors(w, u).length();
        if (distToEarth < 6.8) { // Earth Radius + safety margin
            earthOcculted = true;
        }
    }

    // 2. Space dust attenuation (proportional to density and path length)
    // Typical: 0 density → 0 dB loss, 100% density → ~15 dB loss
    this.dustAttenuation = this.spaceDustDensity * 15.0;

    // 3. Atmospheric turbulence loss
    this.atmTurbulenceLoss = this.atmosphericTurbulence ? (2.5 + Math.sin(this.time * 3) * 1.5) : 0;

    // 4. Thermal drift loss
    this.thermalDriftLoss = this.thermalDrift ? (1.0 + Math.sin(this.time * 0.1) * 0.8) : 0;

    // 5. Pointing loss (from actual pointing error)
    this.pointingLoss = Math.min(10, (this.pointingError / 10) * 0.5);

    // Total loss
    const totalLoss = this.dustAttenuation + this.atmTurbulenceLoss + this.thermalDriftLoss + this.pointingLoss;

    // Link & Transmission State Machine
    const prevLinkState = this.linkState;

    if (this.time < 1.0) {
      this.linkState = 'INITIALIZATION';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 1;
    } else if (this.time < 2.0) {
      this.linkState = 'BEACON_DETECTION';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 2;
    } else if (this.time < 3.0) {
      this.linkState = 'TRACKING';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 3;
    } else if (this.time < 4.0) {
      this.linkState = 'ALIGNMENT';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 4;
    } else if (earthOcculted) {
      this.linkState = 'EARTH_OCCULTED';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 8;
    } else if (this.navState === 'OBSTRUCTION_DETECTED') {
      this.linkState = 'OBSTRUCTION_DETECTED';
      this.laserEnabled = true;
      this.dataTransfer = true;
      this.timelinePhase = 7;
    } else if (this.navState === 'LASER_SAFE_SHUTDOWN' || this.navState === 'AVOIDANCE_MANEUVER') {
      this.linkState = 'LASER_SAFE_SHUTDOWN';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 7;
    } else if (this.navState === 'CLEARANCE_CONFIRMED') {
      this.linkState = 'PATH_CLEAR';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 7;
    } else if (this.navState === 'RETURNING' && this.pointingError > 50) {
      this.linkState = 'REACQUIRING';
      this.laserEnabled = false;
      this.dataTransfer = false;
      this.timelinePhase = 3;
    } else if (this.pointingError > 80) {
      this.linkState = 'DISTURBANCE';
      this.laserEnabled = true; // Beam wanders but remains on
      this.dataTransfer = false;
      this.timelinePhase = 7;
    } else {
      this.linkState = 'TRANSMISSION';
      this.laserEnabled = true;
      this.dataTransfer = true;
      this.timelinePhase = 6;
    }

    if (prevLinkState !== this.linkState) {
      if (this.linkState === 'BEACON_DETECTION') this.logEvent('Tracking beacon acquired');
      else if (this.linkState === 'ALIGNMENT') this.logEvent('Optical alignment initiated');
      else if (this.linkState === 'TRANSMISSION') {
          this.logEvent('Optical lock acquired');
          this.logEvent('LASER TRANSMISSION ENABLED');
          this.logEvent('DATA TRANSFER RESUMED');
      }
      else if (this.linkState === 'REACQUIRING' && prevLinkState === 'PATH_CLEAR') {
          this.logEvent('Tracking reacquisition');
      }
      else if (this.linkState === 'EARTH_OCCULTED') {
          this.logEvent('LINK LOST: EARTH OCCULTATION');
      }
    }

    // Telemetry calculation from actual state
    if (!this.laserEnabled) {
      this.receivedPower = -120;
      this.snr = 0;
      this.ber = 0.5;
      this.linkMargin = -72;
      this.dataRate = 0;
    } else {
      // Baseline: -42 dBm received, 45 dB SNR at clear conditions
      this.receivedPower = -42 - totalLoss;
      this.snr = Math.max(0, 45 - totalLoss);
      this.linkMargin = Math.max(-30, 30 - totalLoss);

      if (this.snr > 20) this.ber = 1e-15;
      else if (this.snr > 15) this.ber = 1e-12;
      else if (this.snr > 10) this.ber = 1e-9;
      else if (this.snr > 5) this.ber = 1e-6;
      else if (this.snr > 2) this.ber = 1e-3;
      else this.ber = 0.5;

      if (!this.dataTransfer) {
         this.dataRate = 0;
      } else {
         if (this.snr > 20) this.dataRate = 10;
         else if (this.snr > 15) this.dataRate = 5;
         else if (this.snr > 10) this.dataRate = 2.5;
         else if (this.snr > 5) this.dataRate = 1;
         else this.dataRate = 0;
      }
    }
  }

  // Returns a snapshot for the UI (avoids leaking refs)
  getSnapshot() {
    return {
      time: this.time,
      running: this.running,
      paused: this.paused,
      activePreset: this.activePreset,

      // Positions (cloned for safety)
      nominalSatAPos: this.nominalSatAPos.clone(),
      satAPos: this.satAPos.clone(),
      satBPos: this.satBPos.clone(),
      distance: this.distance,

      // Avoidance Navigation
      navState: this.navState,
      satAVelocity: this.satAVelocity.length(),
      satBVelocity: this.satBVelocity.length(),

      // Gimbal
      pointingError: this.pointingError,
      gimbalAz: this.gimbalAz,
      gimbalEl: this.gimbalEl,

      // Link
      linkState: this.linkState,
      laserEnabled: this.laserEnabled,
      dataTransfer: this.dataTransfer,
      lineOfSight: !this.obstructed,
      receivedPower: this.receivedPower,
      snr: this.snr,
      ber: this.ber,
      linkMargin: this.linkMargin,
      dataRate: this.dataRate,
      obstructed: this.obstructed,

      // LiDAR
      lidarEnabled: this.lidarEnabled,
      lidarDetected: this.lidarDetected,
      lidarNearestObj: this.lidarNearestObj ? this.lidarNearestObj.id : '---',
      lidarNearestDist: this.lidarNearestDist,
      lidarObstructionRisk: this.lidarObstructionRisk,
      lidarNearestVelocity: this.lidarNearestVelocity,

      // Environment
      spaceDustDensity: this.spaceDustDensity,
      atmosphericTurbulence: this.atmosphericTurbulence,
      thermalDrift: this.thermalDrift,

      // Losses
      dustAttenuation: this.dustAttenuation,
      atmTurbulenceLoss: this.atmTurbulenceLoss,
      thermalDriftLoss: this.thermalDriftLoss,
      pointingLoss: this.pointingLoss,

      // Asteroid count
      asteroidCount: this.asteroids.length,

      // UI
      eventLog: [...this.eventLog],
      timelinePhase: this.timelinePhase,
    };
  }
}

export const scenarioLabEngine = new ScenarioLabEngine();
