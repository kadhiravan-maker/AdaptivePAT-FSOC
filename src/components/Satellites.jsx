import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { engine, LINK_STATES, SCENE_SCALE } from '../simulation/physicsEngine';

function SpaceDust({ quality }) {
  const pointsRef = useRef();
  const materialRef = useRef();
  
  const particleCount = quality === 'LOW' ? 100 : (quality === 'HIGH' ? 350 : 200);
  
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const phases = new Float32Array(particleCount);
    
    // Deterministic generation
    let seed = 12345;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    
    for (let i = 0; i < particleCount; i++) {
      // Z goes from 0.05 to 0.95 to stay between satellites
      positions[i * 3 + 2] = 0.05 + rand() * 0.9;
      
      const angle = rand() * Math.PI * 2;
      const radius = rand() * 0.4; // Wider corridor
      positions[i * 3 + 0] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      
      phases[i] = rand() * Math.PI * 2;
    }
    
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
    geo.userData.originalPositions = new Float32Array(positions);
    return geo;
  }, [particleCount]);

  useFrame((state) => {
    const st = engine.getState();
    const dustLevel = st.effectiveDisturbances?.spaceDust || 0;
    
    if (materialRef.current) {
       materialRef.current.opacity = dustLevel * 0.8;
       materialRef.current.size = 0.08 + dustLevel * 0.05;
       // Add a slight emissive glow if laser is active
       const glow = (st.laserActive ? 1.0 : 0.5) * dustLevel;
       materialRef.current.color.setRGB(0.7 + glow * 0.3, 0.7 + glow * 0.25, 0.75 + glow * 0.2);
    }
    
    if (pointsRef.current && dustLevel > 0) {
       const time = state.clock.elapsedTime * 0.2;
       const positions = geometry.attributes.position.array;
       const original = geometry.userData.originalPositions;
       const phases = geometry.attributes.phase.array;
       
       for (let i = 0; i < particleCount; i++) {
         const idx = i * 3;
         const phase = phases[i];
         // Slow drift
         positions[idx] = original[idx] + Math.sin(time + phase) * 0.05;
         positions[idx + 1] = original[idx + 1] + Math.cos(time * 0.8 + phase) * 0.05;
         positions[idx + 2] = original[idx + 2] + Math.sin(time * 0.5 + phase) * 0.02;
       }
       geometry.attributes.position.needsUpdate = true;
       
       // Orient and scale from Sat A to Sat B
       const posA = new THREE.Vector3().copy(st.satA.position).multiplyScalar(SCENE_SCALE);
       const posB = new THREE.Vector3().copy(st.satB.position).multiplyScalar(SCENE_SCALE);
       
       pointsRef.current.position.copy(posA);
       const dir = new THREE.Vector3().subVectors(posB, posA);
       const dist = dir.length();
       
       pointsRef.current.scale.set(1, 1, dist);
       
       if (dist > 0) {
         dir.normalize();
         const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), dir);
         pointsRef.current.quaternion.copy(quat);
       }
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial 
        ref={materialRef} 
        color="#a0aab5" 
        size={0.1} 
        transparent 
        opacity={0} 
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

export function Satellites({ quality, diag = {} }) {
  const satARef = useRef();
  const satBRef = useRef();
  const gimbalRef = useRef();
  const beamRef = useRef();
  const beamMeshRef = useRef();
  const beamGlowRef = useRef();
  const reticleRef = useRef();
  const beaconRef = useRef();

  const beamMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ff0055',
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  }), []);

  const beaconMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#00ff66',
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  }), []);

  // Pre-allocate vectors to avoid GC overhead inside useFrame
  const posA = useMemo(() => new THREE.Vector3(), []);
  const posB = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);

  const [laserUI, setLaserUI] = React.useState({ active: false, state: '', err: 0 });

  useFrame((state, delta) => {
    engine.update(delta);
    const physicsState = engine.getState();
    const scale = SCENE_SCALE;
    
    posA.set(
      physicsState.satA.position.x * scale,
      physicsState.satA.position.y * scale,
      physicsState.satA.position.z * scale
    );
    
    posB.set(
      physicsState.satB.position.x * scale,
      physicsState.satB.position.y * scale,
      physicsState.satB.position.z * scale
    );

    if (satARef.current) satARef.current.position.copy(posA);
    if (satBRef.current) {
      satBRef.current.position.copy(posB);
      satBRef.current.lookAt(posA.clone().add(new THREE.Vector3(0, 0, 0.32)));
      
      const pulse = (Math.sin(state.clock.elapsedTime * 15) + 1) * 0.5;
      if (beaconRef.current) {
        beaconRef.current.scale.setScalar(1 + pulse * 0.8);
        beaconMaterial.opacity = 0.3 + pulse * 0.7;
      }
    }

    if (gimbalRef.current) {
      gimbalRef.current.quaternion.copy(physicsState.gimbalQuat);
      
      // Calculate authoritative pointing error from Three.js scene as requested
      const terminalWorldPos = new THREE.Vector3();
      gimbalRef.current.getWorldPosition(terminalWorldPos);
      
      const beaconWorldPos = new THREE.Vector3();
      if (beaconRef.current) {
        beaconRef.current.getWorldPosition(beaconWorldPos);
      } else {
        beaconWorldPos.copy(posB); // Fallback
      }

      const targetDirection = beaconWorldPos.clone().sub(terminalWorldPos).normalize();
      
      // The laser points along local +Z, so we find the world axis of +Z
      const opticalAxis = new THREE.Vector3(0, 0, 1).applyQuaternion(
        gimbalRef.current.getWorldQuaternion(new THREE.Quaternion())
      ).normalize();
      
      const dot = THREE.MathUtils.clamp(opticalAxis.dot(targetDirection), -1, 1);
      const pointingErrorRad = Math.acos(dot);
      const pointingErrorUrad = pointingErrorRad * 1e6;
      
      engine.setAuthoritativeError(pointingErrorUrad, opticalAxis, targetDirection, dot);
    }

    // Throttle React state updates for the HUD
    if (Math.floor(state.clock.elapsedTime * 10) % 2 === 0) {
      setLaserUI({ 
        active: physicsState.laserActive, 
        state: physicsState.linkState, 
        err: physicsState.pointingError 
      });
    }

    if (beamRef.current && beamMeshRef.current) {
      const { linkState, pointingError, laserActive } = physicsState;
      // Show laser unless in SEARCH or BEACON_DETECTION
      const acquisitionVisible = ![
        LINK_STATES.SEARCH,
        LINK_STATES.BEACON_DETECTION
      ].includes(linkState);
      beamRef.current.visible = acquisitionVisible;


      // The beam is along the gimbal's local +Z axis.
      const targetDistance = physicsState.distance * SCENE_SCALE;
      const beamLength = (laserActive || linkState === LINK_STATES.BLOCKED) ? targetDistance : Math.min(2.8, targetDistance);
      // Make the beam significantly thicker so it's clearly visible
      const radius = laserActive ? 0.04 : 0.015 + Math.min(0.025, pointingError / 1500000);
      beamMeshRef.current.position.set(0, beamLength / 2, 0);
      beamMeshRef.current.scale.set(radius, beamLength, radius);
      if (beamGlowRef.current) {
        beamGlowRef.current.position.copy(beamMeshRef.current.position);
        beamGlowRef.current.scale.set(radius * 4.0, beamLength, radius * 4.0);
        beamGlowRef.current.visible = laserActive && quality !== 'LOW' && diag.laserGlow !== false;
      }

      if (laserActive) {
        beamMaterial.color.setHex(0xff0055);
        
        const d = physicsState.diagnostics;
        const attenuation = Math.max(0.1, 1.0 - (d.totalLoss / 35));
        const shimmer = d.atmLoss > 0 ? (Math.sin(state.clock.elapsedTime * 25) * (d.atmLoss / 8) * 0.2) : 0;
        
        beamMaterial.opacity = Math.max(0.1, Math.min(1.0, 0.95 * attenuation + shimmer));
      } else {
        beamMaterial.color.setHex(0xffaa00);
        beamMaterial.opacity = 0.45 + Math.sin(state.clock.elapsedTime * 12) * 0.15;
      }

      if (reticleRef.current) {
        const showReticle = linkState === LINK_STATES.ALIGNMENT || linkState === LINK_STATES.TRACKING;
        reticleRef.current.visible = showReticle;
        reticleRef.current.scale.setScalar(0.55 + Math.min(1.3, pointingError / 70000));
        reticleRef.current.rotation.z += delta * 1.8;
      }
    }
  });

  return (
    <>
      <OrbitPath radius={6.871} inclination={0} color="#00b8ff" />
      <OrbitPath radius={6.879} inclination={0.12} color="#29e6a7" />
      <group ref={satARef}>
        <mesh>
          <boxGeometry args={[0.3, 0.3, 0.5]} />
          <meshStandardMaterial color="#b8c6db" metalness={0.9} roughness={0.1} />
        </mesh>
        
        {/* Solar Panels */}
        <mesh position={[0.6, 0, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.4]} />
          <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.6, 0, 0]}>
          <boxGeometry args={[0.8, 0.02, 0.4]} />
          <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
        </mesh>
        
        {diag.html !== false && (
          <Html distanceFactor={15} center position={[0, -0.6, 0]} zIndexRange={[100, 0]}>
            <div className="flex flex-col items-center bg-black/60 p-1.5 rounded border border-[#0b2e59]">
               <span className="text-xs font-bold text-white tracking-widest">SATELLITE A</span>
               <span className="text-[9px] font-bold text-cyan-400">TRANSMITTER</span>
            </div>
          </Html>
        )}

        {/* Gimbal & Laser */}
        <group ref={gimbalRef} position={[0, 0, 0.32]}>
          <mesh position={[0, 0, 0.25]}>
            <cylinderGeometry args={[0.08, 0.08, 0.15]} />
            <meshStandardMaterial color="#222" metalness={0.8} />
          </mesh>
          <group ref={beamRef} rotation={[Math.PI / 2, 0, 0]}>
            <mesh ref={beamMeshRef}>
              <cylinderGeometry args={[1, 1, 1, quality === 'LOW' ? 8 : 16, 1, true]} />
              <primitive object={beamMaterial} attach="material" />
            </mesh>
            {quality === 'HIGH' && (
              <mesh ref={beamGlowRef}>
                <cylinderGeometry args={[1, 1, 1, 16, 1, true]} />
                <primitive object={beamMaterial} attach="material" />
              </mesh>
            )}
          </group>
          <mesh ref={reticleRef} position={[0, 0, 2.8]}>
            <ringGeometry args={[0.16, 0.19, 24]} />
            <meshBasicMaterial color="#ffb000" transparent opacity={0.85} side={THREE.DoubleSide} />
          </mesh>

          {/* Laser HUD near the gimbal */}
          {diag.html !== false && laserUI.state && (
            <Html position={[0.2, 0.3, 1.5]} distanceFactor={12} zIndexRange={[90, 0]}>
              <div className="flex flex-col gap-1 text-[9px] font-mono whitespace-nowrap bg-black/70 p-2 rounded border border-gray-800">
                <div className={`font-bold ${laserUI.active ? 'text-aerospace-beacon' : 'text-red-500'}`}>
                  {laserUI.active ? '🔒 LOCKED' : '○ NOT LOCKED'}
                </div>
                <div className="text-gray-300">
                  1550 nm LASER: <span className={laserUI.active ? 'text-aerospace-beacon' : 'text-gray-500'}>{laserUI.active ? 'ON' : 'OFF'}</span>
                </div>
                <div className="text-gray-300">
                  POINTING ERROR: {laserUI.err.toFixed(1)} µrad
                </div>
              </div>
            </Html>
          )}
        </group>
      </group>

      <group ref={satBRef}>
        <mesh>
          <cylinderGeometry args={[0.2, 0.2, 0.5, 16]} />
          <meshStandardMaterial color="#8892b0" metalness={0.9} roughness={0.3} />
        </mesh>
        
        {/* Solar Panels */}
        <mesh position={[0.5, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
          <boxGeometry args={[0.6, 0.02, 0.6]} />
          <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[-0.5, 0, 0]} rotation={[0, 0, -Math.PI / 4]}>
          <boxGeometry args={[0.6, 0.02, 0.6]} />
          <meshStandardMaterial color="#0b2e59" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Beacon */}
        <mesh ref={beaconRef} position={[0, 0, 0.24]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <primitive object={beaconMaterial} attach="material" />
        </mesh>

        {diag.html !== false && (
          <Html distanceFactor={15} center position={[0, 0.8, 0]} zIndexRange={[100, 0]}>
            <div className="flex flex-col items-center bg-black/60 p-1.5 rounded border border-[#0b2e59]">
               <span className="text-xs font-bold text-white tracking-widest">SATELLITE B</span>
               <span className="text-[9px] font-bold text-gray-400">RECEIVER</span>
               <span className="text-[9px] font-bold text-emerald-400 mt-0.5">🟢 TRACKING BEACON</span>
            </div>
          </Html>
        )}
      </group>
      
      <SpaceDust quality={quality} />
    </>
  );
}

function OrbitPath({ radius, inclination, color }) {
  const geometry = useMemo(() => {
    const points = [];
    for (let i = 0; i < 160; i += 1) {
      const phase = (i / 160) * Math.PI * 2;
      points.push(new THREE.Vector3(
        Math.cos(phase) * radius,
        Math.sin(phase) * radius * inclination,
        Math.sin(phase) * radius * 0.993,
      ));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [radius, inclination]);

  return (
    <lineLoop geometry={geometry}>
      <lineBasicMaterial color={color} transparent opacity={0.38} />
    </lineLoop>
  );
}
