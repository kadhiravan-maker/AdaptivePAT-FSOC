import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { scenarioLabEngine } from './scenarioLabEngine';

// =====================================================================
// EARTH — central celestial body with textures
// =====================================================================
export function ScenarioEarth() {
  const earthRef = useRef();
  const cloudsRef = useRef();

  const [colorMap, normalMap, specularMap, cloudsMap] = useTexture([
    '/assets/earth/earth_atmos_2048.jpg',
    '/assets/earth/earth_normal_2048.jpg',
    '/assets/earth/earth_specular_2048.jpg',
    '/assets/earth/earth_clouds_1024.png'
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.015;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.02;
  });

  return (
    <group>
      {/* Earth sphere */}
      <Sphere args={[6.371, 48, 48]} ref={earthRef}>
        <meshPhongMaterial
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          color={colorMap ? '#ffffff' : '#003366'}
          shininess={15}
        />
      </Sphere>
      {/* Clouds */}
      {cloudsMap && (
        <Sphere args={[6.42, 48, 48]} ref={cloudsRef}>
          <meshPhongMaterial
            map={cloudsMap}
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </Sphere>
      )}
      {/* Atmosphere glow */}
      <Sphere args={[6.55, 48, 48]}>
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </Sphere>
      {/* Earth label */}
      <Html position={[0, -7.5, 0]} center>
        <div className="text-[10px] text-blue-300 bg-black/60 px-2 py-0.5 rounded border border-blue-800 font-mono tracking-widest">
          🌍 EARTH
        </div>
      </Html>
    </group>
  );
}

// =====================================================================
// SATELLITE A — transmitter with gimbal and optical terminal
// =====================================================================
export function SatelliteA() {
  const groupRef = useRef();
  const gimbalRef = useRef();
  const terminalRef = useRef();

  useFrame(() => {
    const eng = scenarioLabEngine;
    if (groupRef.current) {
      groupRef.current.position.copy(eng.satAPos);
      // Orient satellite body to face direction of travel (tangent to orbit)
      groupRef.current.lookAt(0, 0, 0);
    }
    if (gimbalRef.current) {
      gimbalRef.current.quaternion.copy(eng.gimbalQuat);
    }
    // Update terminal world position back to engine
    if (terminalRef.current) {
      terminalRef.current.getWorldPosition(eng.satATerminalPos);
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshStandardMaterial color="#c0c8d8" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0.7, 0, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.4]} />
        <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.7, 0, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.4]} />
        <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Gimbal mount */}
      <group ref={gimbalRef} position={[0, 0, 0.3]}>
        {/* Optical terminal */}
        <mesh ref={terminalRef} position={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.06, 0.08, 0.12, 12]} />
          <meshStandardMaterial color="#333" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Gimbal ring */}
        <mesh>
          <torusGeometry args={[0.1, 0.015, 8, 16]} />
          <meshStandardMaterial color="#555" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>
      {/* LiDAR sensor (separate from optical terminal) */}
      <mesh position={[0.15, 0.18, 0.2]}>
        <boxGeometry args={[0.08, 0.08, 0.12]} />
        <meshStandardMaterial color="#00bbff" emissive="#00bbff" emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Label */}
      <Html position={[0, -0.6, 0]} center distanceFactor={15} zIndexRange={[100, 0]}>
        <div className="flex flex-col items-center bg-black/70 p-1 rounded border border-cyan-800/50 pointer-events-none">
          <span className="text-[9px] font-bold text-white tracking-widest">SATELLITE A</span>
          <span className="text-[8px] font-bold text-cyan-400">🛰️ TRANSMITTER</span>
        </div>
      </Html>
    </group>
  );
}

// =====================================================================
// SATELLITE B — receiver with tracking beacon
// =====================================================================
export function SatelliteB() {
  const groupRef = useRef();
  const beaconRef = useRef();
  const beaconMatRef = useRef();

  useFrame((state) => {
    const eng = scenarioLabEngine;
    if (groupRef.current) {
      groupRef.current.position.copy(eng.satBPos);
      groupRef.current.lookAt(0, 0, 0);
    }
    // Update beacon world position back to engine
    if (beaconRef.current) {
      beaconRef.current.getWorldPosition(eng.satBBeaconPos);
      const pulse = (Math.sin(state.clock.elapsedTime * 12) + 1) * 0.5;
      beaconRef.current.scale.setScalar(1 + pulse * 0.6);
      if (beaconMatRef.current) {
        beaconMatRef.current.opacity = 0.4 + pulse * 0.6;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {/* Body */}
      <mesh>
        <cylinderGeometry args={[0.2, 0.2, 0.4, 16]} />
        <meshStandardMaterial color="#8892b0" metalness={0.9} roughness={0.3} />
      </mesh>
      {/* Solar panels */}
      <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 5]}>
        <boxGeometry args={[0.6, 0.02, 0.5]} />
        <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[-0.5, 0, 0]} rotation={[0, 0, -Math.PI / 5]}>
        <boxGeometry args={[0.6, 0.02, 0.5]} />
        <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Tracking beacon */}
      <mesh ref={beaconRef} position={[0, 0, 0.22]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial
          ref={beaconMatRef}
          color="#00ff66"
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* Label */}
      <Html position={[0, 0.7, 0]} center distanceFactor={15} zIndexRange={[100, 0]}>
        <div className="flex flex-col items-center bg-black/70 p-1 rounded border border-emerald-800/50 pointer-events-none">
          <span className="text-[9px] font-bold text-white tracking-widest">SATELLITE B</span>
          <span className="text-[8px] font-bold text-gray-400">RECEIVER</span>
          <span className="text-[8px] font-bold text-emerald-400">🟢 TRACKING BEACON</span>
        </div>
      </Html>
    </group>
  );
}

// =====================================================================
// FSOC LASER BEAM — 1550 nm, dynamically tracks between terminals
// =====================================================================
export function LaserBeam() {
  const meshRef = useRef();
  const matRef = useRef();
  const glowMeshRef = useRef();
  const glowMatRef = useRef();

  useFrame((state) => {
    const eng = scenarioLabEngine;
    if (!eng.laserEnabled) {
      if (meshRef.current) meshRef.current.visible = false;
      if (glowMeshRef.current) glowMeshRef.current.visible = false;
      return;
    }

    const start = eng.satATerminalPos;
    const end = eng.satBBeaconPos;
    const distance = start.distanceTo(end);
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    if (meshRef.current) {
      meshRef.current.visible = true;
      meshRef.current.position.copy(midPoint);
      meshRef.current.scale.set(1, distance, 1);
      meshRef.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(end, start).normalize());
    }

    if (glowMeshRef.current) {
      glowMeshRef.current.visible = true;
      glowMeshRef.current.position.copy(midPoint);
      glowMeshRef.current.scale.set(1, distance, 1);
      glowMeshRef.current.quaternion.copy(meshRef.current.quaternion);
    }

    if (matRef.current) {
      if (eng.obstructed) {
        matRef.current.color.setHex(0xff2200);
        matRef.current.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 15) * 0.15;
      } else {
        matRef.current.color.setHex(0xff0055);
        const dustFade = Math.max(0.2, 1.0 - eng.spaceDustDensity * 0.6);
        matRef.current.opacity = 0.85 * dustFade;
      }
    }
    if (glowMatRef.current) {
      glowMatRef.current.opacity = eng.obstructed ? 0.05 : 0.25;
    }
  });

  return (
    <group>
      {/* Core laser cylinder */}
      <mesh ref={meshRef}>
        <cylinderGeometry args={[0.08, 0.08, 1, 8]} />
        <meshBasicMaterial ref={matRef} color="#ff0055" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      {/* Glow cylinder */}
      <mesh ref={glowMeshRef}>
        <cylinderGeometry args={[0.25, 0.25, 1, 8]} />
        <meshBasicMaterial ref={glowMatRef} color="#ff0055" transparent opacity={0.25} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function AimingBeam() {
  const lineRef = useRef();
  
  const [geo] = useState(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    return g;
  });

  useFrame(() => {
    const eng = scenarioLabEngine;
    if (eng.laserEnabled || eng.linkState === 'EARTH_OCCULTED' || eng.linkState === 'INITIALIZATION' || eng.navState === 'INITIALIZATION') {
      if (lineRef.current) lineRef.current.visible = false;
      return;
    }
    
    if (lineRef.current) {
      lineRef.current.visible = true;
      const positions = geo.attributes.position.array;
      const start = eng.satATerminalPos;
      const end = eng.satBBeaconPos;
      positions[0] = start.x; positions[1] = start.y; positions[2] = start.z;
      positions[3] = end.x;   positions[4] = end.y;   positions[5] = end.z;
      geo.attributes.position.needsUpdate = true;
      lineRef.current.computeLineDistances();
    }
  });

  return (
    <line ref={lineRef} geometry={geo}>
      <lineDashedMaterial color="#ffcc00" dashSize={1} gapSize={0.5} transparent opacity={0.6} />
    </line>
  );
}

// =====================================================================
// INSTANCED ASTEROIDS — GPU-efficient
// =====================================================================
export function ScenarioAsteroids() {
  const meshRef = useRef();
  const MAX_ASTEROIDS = 20;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    const eng = scenarioLabEngine;
    if (!meshRef.current) return;

    const count = Math.min(eng.asteroids.length, MAX_ASTEROIDS);
    meshRef.current.count = count;

    for (let i = 0; i < count; i++) {
      const ast = eng.asteroids[i];
      dummy.position.copy(ast.position);
      dummy.rotation.copy(ast.rotation);
      dummy.scale.setScalar(ast.radius * 2);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, MAX_ASTEROIDS]} frustumCulled={false}>
      <dodecahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#7a6e5a" roughness={0.9} metalness={0.1} />
    </instancedMesh>
  );
}

// =====================================================================
// SPACE DUST — GPU-efficient THREE.Points
// =====================================================================
export function SpaceDustField() {
  const pointsRef = useRef();
  const matRef = useRef();

  const PARTICLE_COUNT = 400;

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const phases = new Float32Array(PARTICLE_COUNT);
    const rand = () => Math.random();

    // Distribute dust in a large sphere around the scene
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      const r = 5 + rand() * 20;
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
      positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      positions[i * 3 + 2] = Math.cos(phi) * r;
      phases[i] = rand() * Math.PI * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geo.userData.originalPositions = new Float32Array(positions);
    return geo;
  }, []);

  useFrame((state) => {
    const eng = scenarioLabEngine;
    const density = eng.spaceDustDensity;

    if (matRef.current) {
      matRef.current.opacity = density * 0.7;
      matRef.current.size = 0.06 + density * 0.08;
    }

    if (pointsRef.current && density > 0.01) {
      const time = state.clock.elapsedTime * 0.15;
      const positions = geometry.attributes.position.array;
      const original = geometry.userData.originalPositions;
      const phases = geometry.attributes.phase.array;

      // Animate visible portion based on density
      const visibleCount = Math.floor(PARTICLE_COUNT * density);
      for (let i = 0; i < visibleCount; i++) {
        const idx = i * 3;
        const phase = phases[i];
        positions[idx] = original[idx] + Math.sin(time + phase) * 0.3;
        positions[idx + 1] = original[idx + 1] + Math.cos(time * 0.7 + phase) * 0.3;
        positions[idx + 2] = original[idx + 2] + Math.sin(time * 0.4 + phase) * 0.2;
      }
      // Hide particles beyond visible count
      for (let i = visibleCount; i < PARTICLE_COUNT; i++) {
        const idx = i * 3;
        positions[idx] = 99999;
        positions[idx + 1] = 99999;
        positions[idx + 2] = 99999;
      }
      geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={matRef}
        color="#b0c4de"
        size={0.1}
        transparent
        opacity={0}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

// =====================================================================
// LIDAR SCANNER VISUALIZATION — performance-efficient rays
// =====================================================================
export function LidarVisualization() {
  const groupRef = useRef();
  const RAY_COUNT = 12;
  const rayRefs = useRef([]);
  const rayPositions = useMemo(() => {
    return Array.from({ length: RAY_COUNT }, () => new Float32Array(6));
  }, []);

  useFrame((state) => {
    const eng = scenarioLabEngine;
    if (!eng.lidarEnabled || !eng.running) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;

    const origin = eng.satAPos;
    const time = state.clock.elapsedTime;

    // Sweep rays in a cone pattern
    for (let i = 0; i < RAY_COUNT; i++) {
      const angle = (i / RAY_COUNT) * Math.PI * 2 + time * 0.5;
      const elevation = Math.sin(time * 0.3 + i * 0.5) * 0.3;
      const rayLen = 8;

      const dir = new THREE.Vector3(
        Math.cos(angle) * Math.cos(elevation),
        Math.sin(elevation),
        Math.sin(angle) * Math.cos(elevation)
      ).normalize().multiplyScalar(rayLen);

      const end = new THREE.Vector3().copy(origin).add(dir);

      const ref = rayRefs.current[i];
      if (ref) {
        const arr = ref.geometry.attributes.position.array;
        arr[0] = origin.x; arr[1] = origin.y; arr[2] = origin.z;
        arr[3] = end.x; arr[4] = end.y; arr[5] = end.z;
        ref.geometry.attributes.position.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: RAY_COUNT }, (_, i) => (
        <line
          key={`lidar-ray-${i}`}
          ref={(el) => { rayRefs.current[i] = el; }}
        >
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={rayPositions[i]}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial
            color="#00ddff"
            transparent
            opacity={0.25}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
    </group>
  );
}

// =====================================================================
// LIDAR TARGET HIGHLIGHTS — wireframe spheres on detected objects
// =====================================================================
export function LidarTargetHighlights() {
  const [targets, setTargets] = React.useState([]);
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    // Throttle React state updates to every 10 frames
    if (frameCount.current % 10 === 0) {
      const eng = scenarioLabEngine;
      if (eng.lidarEnabled && eng.lidarDetected.length > 0) {
        setTargets(eng.lidarDetected.filter(t => t.id !== 'DUST-CLOUD').slice(0, 5));
      } else {
        setTargets([]);
      }
    }
  });

  return (
    <group>
      {targets.map((t) => (
        <group key={`highlight-${t.id}`}>
          <mesh position={t.position}>
            <sphereGeometry args={[0.6, 12, 12]} />
            <meshBasicMaterial
              color={t.risk === 'CRITICAL' ? '#ff0000' : t.risk === 'HIGH' ? '#ff8800' : '#00ffff'}
              wireframe
              transparent
              opacity={0.4}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// =====================================================================
// ENGINE UPDATER — drives the engine each frame
// =====================================================================
export function ScenarioEngineUpdater() {
  useFrame((_, delta) => {
    scenarioLabEngine.update(delta);
  });
  return null;
}

// =====================================================================
// CAMERA CONTROLLER — with focus presets
// =====================================================================
export function ScenarioCameraController({ focusTarget }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const transitionProgress = useRef(0);
  const targetPosition = useRef(new THREE.Vector3());
  const cameraTarget = useRef(new THREE.Vector3(20, 12, 25));

  useEffect(() => {
    transitionProgress.current = 1.0;

    const eng = scenarioLabEngine;
    switch (focusTarget) {
      case 'EARTH':
        targetPosition.current.set(0, 0, 0);
        cameraTarget.current.set(15, 8, 15);
        break;
      case 'LINK': {
        const mid = new THREE.Vector3().addVectors(eng.satAPos, eng.satBPos).multiplyScalar(0.5);
        targetPosition.current.copy(mid);
        cameraTarget.current.copy(mid).add(new THREE.Vector3(5, 3, 8));
        break;
      }
      case 'SATA':
        targetPosition.current.copy(eng.satAPos);
        cameraTarget.current.copy(eng.satAPos).add(new THREE.Vector3(2, 1.5, 3));
        break;
      case 'SATB':
        targetPosition.current.copy(eng.satBPos);
        cameraTarget.current.copy(eng.satBPos).add(new THREE.Vector3(2, 1.5, 3));
        break;
      case 'RESET':
      default:
        targetPosition.current.set(0, 0, 0);
        cameraTarget.current.set(20, 12, 25);
        break;
    }
  }, [focusTarget]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    if (transitionProgress.current > 0) {
      const lerp = Math.min(1, delta * 2);
      controlsRef.current.target.lerp(targetPosition.current, lerp);
      camera.position.lerp(cameraTarget.current, lerp);
      transitionProgress.current -= delta * 1.5;
    }
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enableRotate
      enableZoom
      enablePan
      enableDamping
      dampingFactor={0.08}
      maxDistance={80}
      minDistance={3}
    />
  );
}

// =====================================================================
// ORBIT RINGS — visual reference for satellite orbits
// =====================================================================
export function OrbitRing({ radius, inclination, color }) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i < 128; i++) {
      const phase = (i / 128) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.cos(phase) * radius,
          Math.sin(phase) * radius * inclination,
          Math.sin(phase) * radius
        )
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius, inclination]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.2} />
    </lineLoop>
  );
}

// =====================================================================
// PREDICTED TRAJECTORY — displays avoidance path
// =====================================================================
export function PredictedTrajectory() {
  const avoidRef = useRef();
  const avoidPositions = useMemo(() => new Float32Array(90), []); // 30 points

  useFrame(() => {
    const eng = scenarioLabEngine;
    if (!eng.running) return;

    if (avoidRef.current) {
      if (eng.navState !== 'NORMAL') {
        avoidRef.current.visible = true;
        const pos = avoidRef.current.geometry.attributes.position.array;
        const oA = eng.orbits.satA;
        
        for (let i = 0; i < 30; i++) {
           const phase = oA.phase + i * 0.015;
           // fade out the offset over distance to rejoin the nominal path visually
           const fade = Math.max(0, 1 - (i / 29));
           pos[i*3] = Math.cos(phase) * oA.radius + eng.avoidanceOffset.x * fade;
           pos[i*3+1] = Math.sin(phase) * oA.radius * oA.inclination + eng.avoidanceOffset.y * fade;
           pos[i*3+2] = Math.sin(phase) * oA.radius + eng.avoidanceOffset.z * fade;
        }
        avoidRef.current.geometry.attributes.position.needsUpdate = true;
      } else {
        avoidRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      <line ref={avoidRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={30} array={avoidPositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#ffaa00" transparent opacity={0.8} />
      </line>
    </group>
  );
}
