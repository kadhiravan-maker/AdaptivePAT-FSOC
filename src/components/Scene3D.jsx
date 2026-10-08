import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { Satellites } from './Satellites';
import { PerformanceMonitor } from './PerformanceMonitor';

function Earth({ quality }) {
  const earthRef = useRef();
  
  const [colorMap, normalMap, specularMap, cloudsMap] = useTexture([
    '/assets/earth/earth_atmos_2048.jpg',
    '/assets/earth/earth_normal_2048.jpg',
    '/assets/earth/earth_specular_2048.jpg',
    '/assets/earth/earth_clouds_1024.png'
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  
  const segments = quality === 'LOW' ? 32 : (quality === 'HIGH' ? 64 : 48);
  const showAtmosphere = quality !== 'LOW';
  
  useFrame((state, delta) => {
    if (earthRef.current) {
      earthRef.current.rotation.y += delta * 0.02;
    }
  });

  return (
    <group ref={earthRef}>
      <Sphere args={[6.371, segments, segments]}>
        <meshPhongMaterial 
          map={colorMap}
          normalMap={normalMap}
          specularMap={specularMap}
          color={colorMap ? "#ffffff" : "#003366"} 
          shininess={15}
        />
      </Sphere>
      
      {showAtmosphere && cloudsMap && (
        <Sphere args={[6.42, segments, segments]}>
          <meshPhongMaterial 
            map={cloudsMap}
            transparent 
            opacity={0.8}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </Sphere>
      )}
      
      {showAtmosphere && (
        <Sphere args={[6.55, segments, segments]}>
          <meshBasicMaterial 
            color="#00aaff" 
            transparent 
            opacity={0.15} 
            side={THREE.BackSide} 
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </Sphere>
      )}
    </group>
  );
}

import { engine, SCENE_SCALE } from '../simulation/physicsEngine';

function CameraController({ mode }) {
  const controlsRef = useRef();
  const [transition, setTransition] = useState(0);
  const targetPos = useRef(new THREE.Vector3());
  
  useEffect(() => {
    setTransition(1.0);
  }, [mode]);
  
  useFrame((state, delta) => {
    if (!controlsRef.current) return;
    
    if (transition > 0) {
      const physicsState = engine.getState();
      const scale = SCENE_SCALE;
      
      const posA = new THREE.Vector3(
        physicsState.satA.position.x * scale,
        physicsState.satA.position.y * scale,
        physicsState.satA.position.z * scale
      );
      const posB = new THREE.Vector3(
        physicsState.satB.position.x * scale,
        physicsState.satB.position.y * scale,
        physicsState.satB.position.z * scale
      );

      if (mode.mode === 'SATA') {
        targetPos.current.copy(posA);
      } else if (mode.mode === 'SATB') {
        targetPos.current.copy(posB);
      } else if (mode.mode === 'LINK') {
        targetPos.current.copy(posA).add(posB).multiplyScalar(0.5);
      } else if (mode.mode === 'ORBIT') {
        targetPos.current.set(0, 0, 0); // Earth center
        state.camera.position.lerp(new THREE.Vector3(12, 10, 15), 0.1);
      } else {
        targetPos.current.set(0, 0, 0); // RESET
        state.camera.position.lerp(new THREE.Vector3(4, 8, 25), 0.1);
      }

      controlsRef.current.target.lerp(targetPos.current, 0.1);
      
      setTransition(prev => Math.max(0, prev - delta * 1.5));
    }

    controlsRef.current.update();
  });

  return (
    <OrbitControls 
      ref={controlsRef}
      enableRotate={true}
      enableZoom={true}
      enablePan={true}
      enableDamping={true}
      dampingFactor={0.08}
      maxDistance={40}
      minDistance={2}
    />
  );
}

export function Scene3D({ quality, cameraMode }) {
  const dpr = quality === 'LOW' ? [1, 1] : (quality === 'HIGH' ? [1, 2] : [1, 1.5]);
  const starCount = quality === 'LOW' ? 1000 : (quality === 'HIGH' ? 5000 : 3000);
  return (
    <div className="absolute inset-0 z-0 bg-[#04060a]">
      {/* Performance optimizations: dpr capped based on quality, standard antialiasing */}
      <Canvas camera={{ position: [4, 8, 25], fov: 40 }} dpr={dpr} performance={{ min: 0.5 }}>
        {/* Deep space background */}
        <color attach="background" args={['#020305']} />
        <fog attach="fog" args={['#020305', 10, 50]} />
        
        <ambientLight intensity={0.2} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} color="#ffffff" />
        
        <Stars radius={100} depth={50} count={starCount} factor={4} saturation={0} fade speed={1} />
        
        <Earth quality={quality} />
        <Satellites quality={quality} />
        
        <CameraController mode={cameraMode} />
        <PerformanceMonitor />
      </Canvas>
    </div>
  );
}
