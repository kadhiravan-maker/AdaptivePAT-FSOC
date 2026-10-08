import React, { useEffect, useState, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { engine } from '../simulation/physicsEngine';

window.watchdogTicks = {
  physics: Date.now(),
  satellite: Date.now(),
  gimbal: Date.now(),
  laser: Date.now(),
  telemetry: Date.now(),
  stateMachine: Date.now(),
  reactRender: Date.now()
};

let physicsUpdates = 0;
const originalUpdate = engine.update.bind(engine);
engine.update = (dt) => {
  physicsUpdates++;
  window.watchdogTicks.physics = Date.now();
  window.watchdogTicks.stateMachine = Date.now(); // Physics engine handles state machine
  originalUpdate(dt);
  
  const st = engine.getState();
  if (!Number.isFinite(st.pointingError) || !Number.isFinite(st.distance) || !Number.isFinite(st.gimbal.az)) {
    console.error("[FSOC WATCHDOG] Invalid physics value detected\nValue: pointingError =", st.pointingError);
  }
};

let lastState = '';
let stateTime = 0;

export function PerformanceMonitor() {
  const { gl } = useThree();
  const [stats, setStats] = useState({
    fps: 0,
    physicsTick: 0,
    satelliteTick: 0,
    gimbalTick: 0,
    laserTick: 0,
    telemetryTick: 0,
    stateMachineTick: 0,
    reactRenderCount: 0
  });

  const framesRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const renderCountRef = useRef(0);

  renderCountRef.current++;
  window.watchdogTicks.reactRender = Date.now();

  useEffect(() => {
    const telemetryInterval = setInterval(() => {
      window.watchdogTicks.telemetry = Date.now();
    }, 100);
    
    const watchdogInterval = setInterval(() => {
      const now = Date.now();
      const s = {
        physics: now - window.watchdogTicks.physics,
        satellite: now - window.watchdogTicks.satellite,
        gimbal: now - window.watchdogTicks.gimbal,
        laser: now - window.watchdogTicks.laser,
        telemetry: now - window.watchdogTicks.telemetry,
        stateMachine: now - window.watchdogTicks.stateMachine
      };
      
      Object.keys(s).forEach(k => {
        if (s[k] > 1000) {
          console.error(`[FSOC WATCHDOG]\n${k} stopped\nLast tick: ${s[k]} ms ago`);
        }
      });
      
      const state = engine.getState();
      if (state.linkState !== lastState) {
        console.log(`[STATE]\n${lastState} -> ${state.linkState}`);
        lastState = state.linkState;
        stateTime = now;
      } else if (now - stateTime > 5000) {
        console.warn(`[STATE STUCK]\nCurrent state:\n${state.linkState}\nReason:\nWaiting for error to drop\nActual condition values:\nLOS = ${!state.losBlocked}\npointingError = ${state.pointingError}\nlinkMargin = ${state.linkMargin}\nautoTrack = ${state.autoTrack}`);
        stateTime = now;
      }
      
      console.log(`Target AZ: ${state.gimbal.targetAz}\nTarget EL: ${state.gimbal.targetEl}\nGimbal AZ: ${state.gimbal.az}\nGimbal EL: ${state.gimbal.el}\nPointing Error: ${state.pointingError}\ngimbalServoActive = ${state.servoActive}`);

    }, 1000);
    return () => {
      clearInterval(telemetryInterval);
      clearInterval(watchdogInterval);
    };
  }, []);

  useFrame(() => {
    framesRef.current++;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;
    
    // Satellites, gimbal, laser are updated in useFrame of Satellites.jsx, but we just mark them running if frame runs.
    window.watchdogTicks.satellite = Date.now();
    window.watchdogTicks.gimbal = Date.now();
    window.watchdogTicks.laser = Date.now();
    
    if (elapsed >= 500) {
      const newStats = {
        fps: Math.round((framesRef.current * 1000) / elapsed),
        physicsTick: Date.now() - window.watchdogTicks.physics,
        satelliteTick: Date.now() - window.watchdogTicks.satellite,
        gimbalTick: Date.now() - window.watchdogTicks.gimbal,
        laserTick: Date.now() - window.watchdogTicks.laser,
        telemetryTick: Date.now() - window.watchdogTicks.telemetry,
        stateMachineTick: Date.now() - window.watchdogTicks.stateMachine,
        reactRenderCount: renderCountRef.current
      };
      setStats(newStats);
      window.simHealthStats = newStats;
      framesRef.current = 0;
      lastTimeRef.current = now;
    }
  });

  return null;
}
