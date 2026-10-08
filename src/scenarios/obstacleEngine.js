import * as THREE from 'three';

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

class ObstacleEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.isPaused = false;
    this.simSpeed = 1.0;
    this.time = 0;
    
    this.state = {
      satA: { position: new THREE.Vector3(-1000, 0, 0) }, // Earth relative
      satB: { position: new THREE.Vector3(1000, 0, 0) }, // Mars relative
      earthPos: new THREE.Vector3(-1000, 0, -200),
      marsPos: new THREE.Vector3(1000, 0, 200),
      
      // Tracking
      gimbalQuatA: new THREE.Quaternion(),
      gimbalQuatB: new THREE.Quaternion(),
      opticalAxisA: new THREE.Vector3(1,0,0),
      opticalAxisB: new THREE.Vector3(-1,0,0),
      pointingError: 1000,
      
      // Avoidance State
      avoidanceActive: false,
      avoidanceOffset: new THREE.Vector3(),
      targetDirectionA: new THREE.Vector3(1,0,0),
      targetDirectionB: new THREE.Vector3(-1,0,0),
      
      // LiDAR & Asteroids
      lidarActive: true,
      asteroids: [],
      debris: [],
      detectedAsteroids: [],
      
      // Telemetry
      linkState: LINK_STATES.SEARCH,
      distance: 0,
      receivedPower: -120,
      snr: 0,
      ber: 0.5,
      linkMargin: -72,
      dataRateGbps: 0,
      laserActive: false,
      
      disturbances: {
        spaceDust: 0,
        debris: 0,
        asteroidInterference: 0,
        vibration: 0,
        thermalDrift: 0
      },
      
      timeline: [
        { id: 'SEARCH', label: 'SEARCH', status: 'pending' },
        { id: 'DETECTION', label: 'DETECTION', status: 'pending' },
        { id: 'TRACKING', label: 'TRACKING', status: 'pending' },
        { id: 'ALIGNMENT', label: 'ALIGNMENT', status: 'pending' },
        { id: 'LOCK', label: 'LOCK', status: 'pending' },
        { id: 'TRANSMISSION', label: 'TRANSMISSION', status: 'pending' },
        { id: 'LIDAR', label: 'LIDAR DETECTION', status: 'pending' },
        { id: 'PREDICTION', label: 'PREDICTION', status: 'pending' },
        { id: 'WARNING', label: 'OBSTACLE WARNING', status: 'pending' },
        { id: 'AVOIDANCE', label: 'AVOIDANCE', status: 'pending' },
        { id: 'REACQUISITION', label: 'REACQUISITION', status: 'pending' },
        { id: 'RESTORED', label: 'LINK RESTORED', status: 'pending' }
      ],
      missionStatus: 'INITIALIZING',
      missionStatusColor: 'text-gray-400',
      
      demoMode: false,
      demoTime: 0
    };

    // Pre-populate deterministic asteroids
    this.state.asteroids = [
      {
        id: 'AST-07',
        position: new THREE.Vector3(0, 50, 200),
        velocity: new THREE.Vector3(0, -10, -50),
        radius: 12,
        risk: 'LOW',
        trajectory: 'SAFE'
      },
      {
        id: 'AST-11',
        position: new THREE.Vector3(300, -80, -300),
        velocity: new THREE.Vector3(-20, 20, 40),
        radius: 8,
        risk: 'LOW',
        trajectory: 'SAFE'
      }
    ];
  }

  triggerAsteroid() {
    // Inject a dangerous asteroid perfectly timed to intersect the beam
    const dist = this.state.satA.position.distanceTo(this.state.satB.position);
    const midPoint = new THREE.Vector3().addVectors(this.state.satA.position, this.state.satB.position).multiplyScalar(0.5);
    
    // Beam goes along X axis generally
    // Set asteroid above the beam, moving down
    this.state.asteroids.push({
      id: 'AST-99',
      position: new THREE.Vector3(midPoint.x + 100, midPoint.y + 200, midPoint.z),
      velocity: new THREE.Vector3(-10, -30, 0),
      radius: 18,
      risk: 'UNKNOWN',
      trajectory: 'UNKNOWN',
      predictedClearance: 0,
      timeToIntersection: 0
    });
  }

  runDemo() {
    this.reset();
    this.state.demoMode = true;
    this.state.demoTime = 0;
  }

  markTimeline(id, status) {
    const item = this.state.timeline.find(t => t.id === id);
    if (item) item.status = status;
  }

  update(dt) {
    if (this.isPaused) return;
    const step = THREE.MathUtils.clamp(dt, 0, 0.05) * this.simSpeed;
    this.time += step;
    
    if (this.state.demoMode) {
      this.state.demoTime += step;
      this.processDemoTimeline();
    }

    this.processPhysics(step);
    this.processLidar();
    this.processLinkState();
  }

  processDemoTimeline() {
    const t = this.state.demoTime;
    if (t > 2 && t < 3 && this.state.linkState === LINK_STATES.SEARCH) {
       // Auto progress initial lock
       this.state.disturbances.spaceDust = 0;
    }
    if (t > 8 && t < 9 && this.state.asteroids.length < 3) {
      this.triggerAsteroid();
    }
    if (t > 15 && t < 16 && !this.state.avoidanceActive) {
       this.state.avoidanceActive = true; // Auto trigger avoidance in demo
    }
  }

  processPhysics(step) {
    // Move asteroids
    for (const ast of this.state.asteroids) {
      ast.position.addScaledVector(ast.velocity, step);
    }

    // Distance
    this.state.distance = this.state.satA.position.distanceTo(this.state.satB.position);

    // Baseline target direction (straight line)
    const baselineDir = new THREE.Vector3().subVectors(this.state.satB.position, this.state.satA.position).normalize();
    
    if (this.state.avoidanceActive) {
      // Create a dog-leg or safe offset target
      // The scenario requests: "new beam is straight... do not physically bend around the asteroid"
      // Wait, to have a straight beam avoid an obstacle, we can point the beam to a relay?
      // "Autonomous communication geometry adjustment... new beam must be a straight line... do not physically bend"
      // If we point somewhere else, Sat B must move, or there's a relay.
      // Let's assume we use an offset pointing angle to a relay, or we shift the transmission origin slightly using a secondary aperture.
      // Or we just angle the beam slightly so it misses the asteroid and hits an extended receiver array.
      const safeOffset = new THREE.Vector3(0, 30, 50).normalize();
      this.state.targetDirectionA.copy(baselineDir).addScaledVector(safeOffset, 0.05).normalize();
    } else {
      this.state.targetDirectionA.copy(baselineDir);
    }
    
    this.state.targetDirectionB.copy(this.state.targetDirectionA).negate();

    // Servo tracking (critically damped)
    const targetQuatA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.state.targetDirectionA);
    this.state.gimbalQuatA.slerp(targetQuatA, Math.min(1.0, step * 5.0));

    this.state.opticalAxisA.set(0,0,1).applyQuaternion(this.state.gimbalQuatA).normalize();
    
    const dot = THREE.MathUtils.clamp(this.state.opticalAxisA.dot(this.state.targetDirectionA), -1, 1);
    this.state.pointingError = Math.acos(dot) * 1e6; // urad
  }

  processLidar() {
    if (!this.state.lidarActive) {
      this.state.detectedAsteroids = [];
      return;
    }

    // Lidar scans forward cone
    const detected = [];
    const beamStart = this.state.satA.position;
    const beamEnd = this.state.satB.position;
    const beamLine = new THREE.Line3(beamStart, beamEnd);
    
    let imminentCollision = false;

    for (const ast of this.state.asteroids) {
      const distToSatA = ast.position.distanceTo(this.state.satA.position);
      if (distToSatA < 4000) {
        // In range
        const closestPoint = new THREE.Vector3();
        beamLine.closestPointToPoint(ast.position, true, closestPoint);
        const distToBeam = ast.position.distanceTo(closestPoint);
        
        // Predict trajectory
        // Simplified: asteroid velocity relative to beam
        // We find the intersection of the asteroid's path with the beam
        const v = ast.velocity;
        
        let timeToIntersect = 999;
        let predictedClearance = distToBeam;
        let risk = 'LOW';
        let trajectory = 'SAFE';

        // Project forward 20 seconds
        let minClearance = distToBeam;
        for (let t = 0; t < 20; t+=0.5) {
           const p = new THREE.Vector3().copy(ast.position).addScaledVector(v, t);
           const c = new THREE.Vector3();
           beamLine.closestPointToPoint(p, true, c);
           const d = p.distanceTo(c);
           if (d < minClearance) {
             minClearance = d;
             timeToIntersect = t;
           }
        }
        
        predictedClearance = minClearance;
        if (minClearance < ast.radius + 5) {
          risk = 'HIGH';
          trajectory = 'INTERSECTING';
          if (timeToIntersect < 10) {
            risk = 'CRITICAL';
            imminentCollision = true;
          }
        } else if (minClearance < ast.radius + 20) {
          risk = 'MEDIUM';
          trajectory = 'CLOSE APPROACH';
        }

        detected.push({
          ...ast,
          distToSatA,
          predictedClearance,
          timeToIntersect,
          risk,
          trajectory
        });
      }
    }

    this.state.detectedAsteroids = detected;
    
    if (imminentCollision && !this.state.avoidanceActive) {
      this.state.disturbances.asteroidInterference = 100;
    } else {
      this.state.disturbances.asteroidInterference = 0;
    }
  }

  processLinkState() {
    const error = this.state.pointingError;
    const current = this.state.linkState;
    const obstructed = this.state.disturbances.asteroidInterference > 50;
    
    // Timeline update logic
    if (current === LINK_STATES.SEARCH && error < 1000) {
      this.state.linkState = LINK_STATES.TRACKING;
      this.markTimeline('SEARCH', 'done');
      this.markTimeline('DETECTION', 'done');
      this.markTimeline('TRACKING', 'active');
      this.state.missionStatus = 'ACQUIRING BEACON';
      this.state.missionStatusColor = 'text-yellow-400';
    } else if (current === LINK_STATES.TRACKING && error < 50) {
      this.state.linkState = LINK_STATES.ALIGNMENT;
      this.markTimeline('TRACKING', 'done');
      this.markTimeline('ALIGNMENT', 'active');
    } else if (current === LINK_STATES.ALIGNMENT && error <= 10) {
      this.state.linkState = LINK_STATES.LOCKED;
      this.markTimeline('ALIGNMENT', 'done');
      this.markTimeline('LOCK', 'active');
    } else if (current === LINK_STATES.LOCKED) {
      if (!obstructed) {
        this.state.linkState = LINK_STATES.TRANSMITTING;
        this.markTimeline('LOCK', 'done');
        this.markTimeline('TRANSMISSION', 'active');
        this.state.missionStatus = 'LINK STABLE';
        this.state.missionStatusColor = 'text-green-400';
      }
    } else if (current === LINK_STATES.TRANSMITTING) {
      if (obstructed) {
        this.state.linkState = LINK_STATES.BLOCKED;
        this.markTimeline('TRANSMISSION', 'done');
        this.markTimeline('WARNING', 'active');
        this.state.missionStatus = 'BEAM INTERSECTION PREDICTED';
        this.state.missionStatusColor = 'text-red-500';
      }
    } else if (current === LINK_STATES.BLOCKED) {
      if (this.state.avoidanceActive) {
        this.state.linkState = LINK_STATES.REACQUIRING;
        this.markTimeline('WARNING', 'done');
        this.markTimeline('AVOIDANCE', 'done');
        this.markTimeline('REACQUISITION', 'active');
        this.state.missionStatus = 'AUTONOMOUS AVOIDANCE IN PROGRESS';
        this.state.missionStatusColor = 'text-orange-400';
      } else if (!obstructed) {
        this.state.linkState = LINK_STATES.TRANSMITTING;
      }
    } else if (current === LINK_STATES.REACQUIRING) {
      if (error <= 10) {
        this.state.linkState = LINK_STATES.TRANSMITTING;
        this.markTimeline('REACQUISITION', 'done');
        this.markTimeline('RESTORED', 'active');
        this.state.missionStatus = 'FSOC LINK RESTORED';
        this.state.missionStatusColor = 'text-green-400';
      }
    }

    // Telemetry updates
    const isTransmitting = this.state.linkState === LINK_STATES.TRANSMITTING;
    this.state.laserActive = isTransmitting || this.state.linkState === LINK_STATES.LOCKED;
    
    if (isTransmitting) {
      const dustLoss = (this.state.disturbances.spaceDust / 100) * 12;
      this.state.receivedPower = -42 - dustLoss;
      this.state.snr = 45 - dustLoss;
      this.state.ber = 1e-15;
      this.state.dataRateGbps = 10;
      this.state.linkMargin = 30 - dustLoss;
    } else {
      this.state.receivedPower = -120;
      this.state.snr = 0;
      this.state.ber = 0.5;
      this.state.dataRateGbps = 0;
      this.state.linkMargin = -72;
    }
  }

  getState() {
    return this.state;
  }
}

export const obstacleEngine = new ObstacleEngine();
