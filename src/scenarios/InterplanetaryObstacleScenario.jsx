import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { obstacleEngine, LINK_STATES } from './obstacleEngine';
import { ArrowLeft, Play, Pause, RotateCcw, AlertTriangle, Crosshair, Activity, Link2, Wind, Eye, Target } from 'lucide-react';

// === HUD COMPONENTS ===
function formatBer(ber) {
  if (ber === 0.5) return '5.0 × 10⁻¹';
  if (ber < 1e-10) return `1.0 × 10⁻¹⁵`;
  const exponent = Math.floor(Math.log10(ber));
  const mantissa = ber / Math.pow(10, exponent);
  return `${mantissa.toFixed(1)} × 10${exponent}`;
}

const TelemetryRow = ({ label, value, color = "text-white" }) => (
  <div className="flex justify-between items-center text-[10px] py-1 border-b border-[#1a365d]/50 last:border-0">
    <span className="text-gray-400">{label}</span>
    <span className={`font-mono font-bold ${color}`}>{value}</span>
  </div>
);

// === 3D COMPONENTS ===

function EarthAndMars() {
  const earthRef = useRef();
  const marsRef = useRef();
  
  // Use simple materials, or if textures load, use them. Since this is an independent component, we use standard mats.
  return (
    <group>
      <group position={[-1000, 0, -200]}>
        <Sphere args={[40, 32, 32]} ref={earthRef}>
          <meshStandardMaterial color="#0044ff" roughness={0.6} />
        </Sphere>
        <Html position={[0, -50, 0]} center>
          <div className="text-[10px] text-blue-300 bg-black/50 px-2 py-0.5 rounded border border-blue-800">EARTH</div>
        </Html>
      </group>
      
      <group position={[1000, 0, 200]}>
        <Sphere args={[20, 32, 32]} ref={marsRef}>
          <meshStandardMaterial color="#ff4400" roughness={0.8} />
        </Sphere>
        <Html position={[0, -30, 0]} center>
          <div className="text-[10px] text-red-300 bg-black/50 px-2 py-0.5 rounded border border-red-800">MARS</div>
        </Html>
      </group>
    </group>
  );
}

function SatellitesAndLaser() {
  const laserRef = useRef();
  const satARef = useRef();
  const satBRef = useRef();
  const beamMatRef = useRef();

  useFrame(() => {
    const st = obstacleEngine.getState();
    if (satARef.current) satARef.current.position.copy(st.satA.position);
    if (satBRef.current) satBRef.current.position.copy(st.satB.position);
    
    if (laserRef.current) {
      const positions = laserRef.current.geometry.attributes.position.array;
      positions[0] = st.satA.position.x;
      positions[1] = st.satA.position.y;
      positions[2] = st.satA.position.z;
      
      // Target direction could be sat B or safe offset
      const dist = st.distance;
      const target = new THREE.Vector3().copy(st.satA.position).addScaledVector(st.targetDirectionA, dist);
      
      positions[3] = target.x;
      positions[4] = target.y;
      positions[5] = target.z;
      
      laserRef.current.geometry.attributes.position.needsUpdate = true;
      laserRef.current.visible = st.laserActive;
      
      if (beamMatRef.current) {
        beamMatRef.current.opacity = st.linkState === LINK_STATES.BLOCKED ? 0.2 : 0.8;
        beamMatRef.current.color.setHex(st.linkState === LINK_STATES.BLOCKED ? 0xff0000 : 0xff0055);
      }
    }
  });

  return (
    <group>
      <mesh ref={satARef}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.5} />
        <Html position={[0, 10, 0]} center>
           <div className="text-[9px] text-[#00ffcc] font-mono whitespace-nowrap bg-black/70 px-1 rounded">SAT A</div>
        </Html>
      </mesh>
      
      <mesh ref={satBRef}>
        <boxGeometry args={[4, 4, 4]} />
        <meshStandardMaterial color="#00ffcc" emissive="#00ffcc" emissiveIntensity={0.5} />
        <Html position={[0, 10, 0]} center>
           <div className="text-[9px] text-[#00ffcc] font-mono whitespace-nowrap bg-black/70 px-1 rounded">SAT B</div>
        </Html>
      </mesh>
      
      <line ref={laserRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={2} array={new Float32Array(6)} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial ref={beamMatRef} color="#ff0055" linewidth={2} transparent opacity={0.8} />
      </line>
    </group>
  );
}

function Asteroids() {
  const groupRef = useRef();
  const [asteroids, setAsteroids] = useState([]);

  useFrame(() => {
    setAsteroids([...obstacleEngine.getState().asteroids]);
  });

  return (
    <group ref={groupRef}>
      {asteroids.map(ast => (
        <mesh key={ast.id} position={ast.position}>
          <dodecahedronGeometry args={[ast.radius, 1]} />
          <meshStandardMaterial color="#666666" roughness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

function LidarScanner() {
  const [targets, setTargets] = useState([]);
  
  useFrame(() => {
    setTargets([...obstacleEngine.getState().detectedAsteroids]);
  });

  return (
    <group>
      {targets.map(t => (
        <group key={`lidar-${t.id}`}>
          {/* Target highlight */}
          <mesh position={t.position}>
             <sphereGeometry args={[t.radius + 2, 16, 16]} />
             <meshBasicMaterial color={t.risk === 'CRITICAL' ? "#ff0000" : "#00ffff"} wireframe transparent opacity={0.5} />
          </mesh>
          <Html position={[t.position.x, t.position.y + t.radius + 10, t.position.z]} center>
             <div className="bg-[#020305]/80 border border-cyan-500/50 p-2 rounded text-[10px] font-mono w-40 pointer-events-none">
               <div className="text-cyan-400 font-bold border-b border-cyan-500/30 pb-1 mb-1">{t.id} TARGET</div>
               <div className="flex justify-between"><span>Dist:</span> <span>{t.distToSatA.toFixed(0)} km</span></div>
               <div className="flex justify-between"><span>Risk:</span> <span className={t.risk === 'CRITICAL' ? 'text-red-500' : 'text-yellow-400'}>{t.risk}</span></div>
               <div className="flex justify-between"><span>Clearance:</span> <span>{t.predictedClearance.toFixed(1)} m</span></div>
               {t.risk === 'CRITICAL' && <div className="text-red-500 font-bold mt-1 animate-pulse">INTERSECTION PREDICTED</div>}
             </div>
          </Html>
        </group>
      ))}
    </group>
  );
}

function EngineUpdater() {
  useFrame((state, delta) => {
    obstacleEngine.update(delta);
  });
  return null;
}

// === MAIN SCENARIO COMPONENT ===

export default function InterplanetaryObstacleScenario({ quality, onExit }) {
  const [hudState, setHudState] = useState(obstacleEngine.getState());

  useEffect(() => {
    const interval = setInterval(() => {
      setHudState({ ...obstacleEngine.getState() });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020305] font-sans text-white flex flex-col">
      {/* 3D Viewport */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 200, 600], fov: 45 }}>
          <color attach="background" args={['#010204']} />
          <ambientLight intensity={0.1} />
          <directionalLight position={[10, 10, 5]} intensity={1} color="#ffffff" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          
          <EngineUpdater />
          <EarthAndMars />
          <SatellitesAndLaser />
          <Asteroids />
          <LidarScanner />
          
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} maxDistance={3000} />
        </Canvas>
      </div>

      {/* TOP BANNER */}
      <div className="absolute top-0 left-0 w-full z-10 flex flex-col items-center pt-2 pointer-events-none">
        <h1 className="text-xs tracking-[0.3em] text-cyan-500 font-bold mb-1 opacity-80">FSOC INTERPLANETARY OBSTACLE AVOIDANCE</h1>
        <div className={`px-6 py-1.5 rounded-full border border-current bg-black/60 font-mono text-[11px] font-bold tracking-widest ${hudState.missionStatusColor} backdrop-blur-md shadow-[0_0_15px_currentColor]`}>
          {hudState.missionStatus}
        </div>
      </div>

      {/* LEFT PANEL - CONTROLS */}
      <div className="absolute top-20 left-4 w-60 z-10 flex flex-col gap-2">
        <button onClick={onExit} className="flex items-center gap-2 text-[11px] text-gray-400 hover:text-white mb-2 transition bg-black/40 px-3 py-1.5 rounded border border-gray-700 w-fit">
          <ArrowLeft size={14} /> Back to Simulator
        </button>
        
        <div className="bg-[#020305]/80 backdrop-blur-md border border-[#1a365d] rounded-lg p-3">
          <h2 className="text-[10px] text-cyan-500 tracking-widest font-bold mb-3 border-b border-[#1a365d] pb-1">SCENARIO CONTROLS</h2>
          
          <div className="flex flex-col gap-2">
            <button onClick={() => obstacleEngine.runDemo()} className="bg-[#101b33] border border-cyan-500/50 hover:bg-[#1a365d] text-cyan-400 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-2">
              <Play size={12} /> RUN FULL DEMO
            </button>
            
            <button onClick={() => obstacleEngine.reset()} className="bg-[#101b33] border border-gray-600 hover:bg-[#1a365d] text-gray-300 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-2">
              <RotateCcw size={12} /> RESET SCENARIO
            </button>
            
            <div className="h-px bg-[#1a365d] my-1"></div>
            
            <button onClick={() => obstacleEngine.triggerAsteroid()} className="bg-[#101b33] border border-orange-500/50 hover:bg-[#1a365d] text-orange-400 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-2">
              <AlertTriangle size={12} /> TRIGGER ASTEROID
            </button>
            
            <button 
              onClick={() => {
                obstacleEngine.state.avoidanceActive = !obstacleEngine.state.avoidanceActive;
              }} 
              className={`text-[10px] py-1.5 rounded transition flex items-center justify-center gap-2 border ${hudState.avoidanceActive ? 'bg-cyan-900/40 border-cyan-400 text-cyan-400' : 'bg-[#101b33] border-gray-600 text-gray-400'}`}
            >
              <Target size={12} /> {hudState.avoidanceActive ? 'AVOIDANCE ACTIVE' : 'ENABLE AUTO AVOIDANCE'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - TELEMETRY & ANALYSIS */}
      <div className="absolute top-20 right-4 w-64 z-10 flex flex-col gap-2 max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar">
        <div className="bg-[#020305]/80 backdrop-blur-md border border-[#1a365d] rounded-lg p-3">
          <h2 className="text-[10px] text-cyan-500 tracking-widest font-bold mb-2 border-b border-[#1a365d] pb-1 flex items-center gap-2">
            <Link2 size={12} /> LINK STATUS
          </h2>
          <TelemetryRow label="Link State" value={hudState.linkState} color={hudState.linkState === LINK_STATES.BLOCKED ? 'text-red-500' : 'text-green-400'} />
          <TelemetryRow label="Distance" value={`${(hudState.distance * 1000).toFixed(0)} km`} />
          <TelemetryRow label="Pointing Error" value={`${hudState.pointingError.toFixed(1)} µrad`} color={hudState.pointingError > 50 ? 'text-orange-400' : 'text-green-400'} />
          <TelemetryRow label="Received Power" value={`${hudState.receivedPower.toFixed(1)} dBm`} />
          <TelemetryRow label="SNR" value={`${hudState.snr.toFixed(1)} dB`} />
          <TelemetryRow label="BER" value={formatBer(hudState.ber)} />
          <TelemetryRow label="Data Rate" value={`${hudState.dataRateGbps.toFixed(1)} Gbps`} color={hudState.dataRateGbps > 0 ? 'text-cyan-400' : 'text-red-500'} />
        </div>

        <div className="bg-[#020305]/80 backdrop-blur-md border border-[#1a365d] rounded-lg p-3">
          <h2 className="text-[10px] text-orange-500 tracking-widest font-bold mb-2 border-b border-[#1a365d] pb-1 flex items-center gap-2">
            <AlertTriangle size={12} /> DISTURBANCE ANALYSIS
          </h2>
          <TelemetryRow label="Asteroid Interference" value={`${hudState.disturbances.asteroidInterference}%`} color={hudState.disturbances.asteroidInterference > 0 ? 'text-red-500' : 'text-white'} />
          <TelemetryRow label="Space Dust" value={`${hudState.disturbances.spaceDust}%`} />
        </div>
      </div>

      {/* BOTTOM PANEL - TIMELINE */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[800px] max-w-[90vw] z-10">
        <div className="bg-[#020305]/80 backdrop-blur-md border border-[#1a365d] rounded-lg p-3">
           <h2 className="text-[10px] text-cyan-500 tracking-widest font-bold mb-3 border-b border-[#1a365d] pb-1 text-center">SCENARIO TIMELINE</h2>
           <div className="flex justify-between items-center px-4">
             {hudState.timeline.map((item, idx) => (
               <div key={item.id} className="flex flex-col items-center flex-1 relative group">
                 {idx < hudState.timeline.length - 1 && (
                   <div className={`absolute top-2 left-1/2 w-full h-[1px] ${item.status === 'done' ? 'bg-cyan-500' : 'bg-[#1a365d]'}`}></div>
                 )}
                 <div className={`w-4 h-4 rounded-full z-10 flex items-center justify-center border-2 text-[8px] 
                    ${item.status === 'active' ? 'bg-cyan-900 border-cyan-400 text-cyan-400 animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]' : 
                      item.status === 'done' ? 'bg-cyan-500 border-cyan-500 text-black' : 'bg-[#020305] border-[#1a365d] text-transparent'}`}
                 >
                    {item.status === 'done' ? '✓' : ''}
                 </div>
                 <div className={`text-[8px] mt-2 text-center whitespace-nowrap w-full ${item.status === 'active' ? 'text-cyan-400 font-bold' : item.status === 'done' ? 'text-gray-300' : 'text-gray-600'}`}>
                   {item.label}
                 </div>
               </div>
             ))}
           </div>
        </div>
      </div>

    </div>
  );
}
