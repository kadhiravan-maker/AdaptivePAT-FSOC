import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import {
  ArrowLeft, Play, Pause, RotateCcw, Crosshair, Eye,
  Activity, Radio, Zap, Cloud, Thermometer, Target,
  AlertTriangle, Navigation, Aperture
} from 'lucide-react';
import { scenarioLabEngine, SCENARIO_PRESETS } from './scenarioLabEngine';
import {
  ScenarioEarth,
  SatelliteA,
  SatelliteB,
  LaserBeam,
  ScenarioAsteroids,
  SpaceDustField,
  LidarVisualization,
  LidarTargetHighlights,
  ScenarioEngineUpdater,
  ScenarioCameraController,
  OrbitRing,
  PredictedTrajectory,
  AimingBeam,
} from './ScenarioScene3D';

// =====================================================================
// HELPERS
// =====================================================================
function formatBer(ber) {
  if (ber >= 0.5) return '5.0 × 10⁻¹';
  if (ber < 1e-14) return '< 10⁻¹⁵';
  const exp = Math.floor(Math.log10(ber));
  const man = ber / Math.pow(10, exp);
  const superscripts = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '-': '⁻' };
  const supStr = String(exp).split('').map(c => superscripts[c] || c).join('');
  return `${man.toFixed(1)} × 10${supStr}`;
}

function TelemetryRow({ label, value, color = 'text-white' }) {
  return (
    <div className="flex justify-between items-center text-[10px] py-0.5 border-b border-[#1a365d]/30 last:border-0">
      <span className="text-gray-500">{label}</span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function PanelHeader({ icon: Icon, title, color = 'text-cyan-500' }) {
  return (
    <h2 className={`text-[10px] ${color} tracking-[0.2em] font-bold mb-2 border-b border-[#1a365d] pb-1 flex items-center gap-1.5`}>
      {Icon && <Icon size={11} />}
      {title}
    </h2>
  );
}

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-[#020305]/85 backdrop-blur-md border border-[#1a365d] rounded-lg p-3 ${className}`}>
      {children}
    </div>
  );
}

function SliderControl({ label, value, onChange, min = 0, max = 100, unit = '%' }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[9px]">
        <span className="text-gray-400">{label}</span>
        <span className="text-white font-mono">{typeof value === 'number' ? (unit === '%' ? `${Math.round(value * 100)}%` : value.toFixed(1)) : value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={unit === '%' ? Math.round(value * 100) : value}
        onChange={(e) => onChange(unit === '%' ? parseInt(e.target.value) / 100 : parseFloat(e.target.value))}
        className="w-full h-1 bg-[#1a365d] rounded-lg appearance-none cursor-pointer accent-cyan-500"
      />
    </div>
  );
}

function ToggleControl({ label, active, onToggle, icon: Icon }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full text-[10px] py-1.5 rounded transition flex items-center justify-center gap-1.5 border ${
        active
          ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-400'
          : 'bg-[#101b33] border-gray-700 text-gray-500'
      }`}
    >
      {Icon && <Icon size={11} />}
      {label}: <span className="font-bold">{active ? 'ON' : 'OFF'}</span>
    </button>
  );
}

// =====================================================================
// MAIN SCENARIO LAB COMPONENT
// =====================================================================
export default function ScenarioLab({ onExit }) {
  const [snapshot, setSnapshot] = useState(scenarioLabEngine.getSnapshot());
  const [focusTarget, setFocusTarget] = useState('RESET');
  const [selectedPreset, setSelectedPreset] = useState('NOMINAL');
  const intervalRef = useRef(null);

  // Throttled state sync (10 Hz)
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSnapshot(scenarioLabEngine.getSnapshot());
    }, 100);
    return () => {
      clearInterval(intervalRef.current);
      // Clean up engine when leaving
      scenarioLabEngine.stop();
      scenarioLabEngine.reset();
    };
  }, []);

  const handleStart = useCallback(() => {
    scenarioLabEngine.start();
    setSnapshot(scenarioLabEngine.getSnapshot());
  }, []);

  const handlePause = useCallback(() => {
    scenarioLabEngine.pause();
    setSnapshot(scenarioLabEngine.getSnapshot());
  }, []);

  const handleRestart = useCallback(() => {
    scenarioLabEngine.reset();
    scenarioLabEngine.applyPreset(selectedPreset);
    setSnapshot(scenarioLabEngine.getSnapshot());
  }, [selectedPreset]);

  const handlePresetChange = useCallback((key) => {
    setSelectedPreset(key);
    scenarioLabEngine.applyPreset(key);
    if (scenarioLabEngine.running) {
      scenarioLabEngine.start();
    }
    setSnapshot(scenarioLabEngine.getSnapshot());
  }, []);

  // Status badge color
  const statusColor =
    snapshot.linkState === 'TRANSMISSION' ? 'text-green-400 border-green-400 shadow-[0_0_12px_rgba(0,255,100,0.3)]' :
    snapshot.linkState === 'DISTURBANCE' ? 'text-yellow-400 border-yellow-400 shadow-[0_0_12px_rgba(255,200,0,0.3)]' :
    snapshot.linkState === 'OBSTRUCTION_DETECTED' ? 'text-orange-500 border-orange-500 shadow-[0_0_12px_rgba(255,100,0,0.3)]' :
    snapshot.linkState === 'LASER_SAFE_SHUTDOWN' ? 'text-red-500 border-red-500 shadow-[0_0_12px_rgba(255,0,0,0.3)] animate-pulse' :
    snapshot.linkState === 'EARTH_OCCULTED' ? 'text-red-500 border-red-500 shadow-[0_0_12px_rgba(255,0,0,0.3)]' :
    snapshot.linkState === 'PATH_CLEAR' ? 'text-green-400 border-green-400 shadow-[0_0_12px_rgba(0,255,100,0.3)]' :
    snapshot.linkState === 'REACQUIRING' ? 'text-orange-400 border-orange-400 shadow-[0_0_12px_rgba(255,150,0,0.3)]' :
    snapshot.linkState === 'TRACKING' || snapshot.linkState === 'ALIGNMENT' ? 'text-orange-400 border-orange-400 shadow-[0_0_12px_rgba(255,150,0,0.3)]' :
    'text-gray-400 border-gray-600';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#020305] font-sans text-white">
      {/* ======================== 3D VIEWPORT ======================== */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [20, 12, 25], fov: 40 }} dpr={[1, 1.5]} performance={{ min: 0.5 }}>
          <color attach="background" args={['#010204']} />
          <fog attach="fog" args={['#010204', 40, 100]} />

          <ambientLight intensity={0.15} />
          <directionalLight position={[15, 10, 8]} intensity={1.5} color="#ffffff" />
          <pointLight position={[0, 0, 0]} intensity={0.3} color="#4488ff" />

          <Stars radius={120} depth={60} count={4000} factor={4} saturation={0} fade speed={0.5} />

          <ScenarioEngineUpdater />
          <ScenarioEarth />
          <SatelliteA />
          <SatelliteB />
          <LaserBeam />
          <AimingBeam />
          <ScenarioAsteroids />
          <SpaceDustField />
          <LidarVisualization />
          <LidarTargetHighlights />
          <PredictedTrajectory />

          {/* Orbit rings */}
          <OrbitRing radius={11.0} inclination={0.15} color="#00aaff" />
          <OrbitRing radius={26.0} inclination={0.3} color="#00ff88" />

          <ScenarioCameraController focusTarget={focusTarget} />
        </Canvas>
      </div>

      {/* ======================== TOP BANNER ======================== */}
      <div className="absolute top-0 left-0 w-full z-10 flex flex-col items-center pt-3 pointer-events-none">
        <h1 className="text-[11px] tracking-[0.35em] text-cyan-500/80 font-bold mb-1.5 flex gap-4">
          <span>SCENARIO: {SCENARIO_PRESETS[selectedPreset]?.name || 'UNKNOWN'}</span>
          <span>STATUS: {snapshot.running && !snapshot.paused ? 'RUNNING' : snapshot.paused ? 'PAUSED' : 'IDLE'}</span>
          <span>TIME: {Math.floor(snapshot.time / 60).toString().padStart(2, '0')}:{Math.floor(snapshot.time % 60).toString().padStart(2, '0')}</span>
        </h1>
        <div className={`px-5 py-1 rounded-full border bg-black/70 font-mono text-[11px] font-bold tracking-widest ${statusColor}`}>
          LINK: {snapshot.linkState}
          {snapshot.laserEnabled && ' • 1550 nm LASER ON'}
        </div>
      </div>

      {/* ======================== LEFT PANEL — CONTROLS ======================== */}
      <div className="absolute top-14 left-3 w-56 z-10 flex flex-col gap-2 max-h-[calc(100vh-80px)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {/* Back button */}
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white transition bg-black/50 px-2.5 py-1 rounded border border-gray-700/50 w-fit"
        >
          <ArrowLeft size={12} /> Back to Home
        </button>

        {/* Playback Controls */}
        <Panel>
          <PanelHeader icon={Activity} title="SCENARIO CONTROLS" />
          <div className="flex gap-1.5 mb-2">
            <button
              onClick={handleStart}
              className="flex-1 bg-cyan-900/30 border border-cyan-500/50 hover:bg-cyan-800/40 text-cyan-400 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-1"
            >
              <Play size={10} /> START
            </button>
            <button
              onClick={handlePause}
              className="flex-1 bg-[#101b33] border border-gray-600 hover:bg-[#1a365d] text-gray-300 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-1"
            >
              <Pause size={10} /> PAUSE
            </button>
            <button
              onClick={handleRestart}
              className="flex-[1.2] bg-orange-900/30 border border-orange-500/50 hover:bg-orange-800/40 text-orange-400 text-[10px] py-1.5 rounded transition flex items-center justify-center gap-1 font-bold"
            >
              <RotateCcw size={10} /> RESTART SCENARIO
            </button>
          </div>

          {/* Preset selector */}
          <div className="text-[9px] text-gray-500 mb-1 tracking-widest">SCENARIO PRESET</div>
          <div className="flex flex-col gap-1">
            {Object.entries(SCENARIO_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => handlePresetChange(key)}
                className={`text-[9px] py-1 px-2 rounded border transition text-left ${
                  selectedPreset === key
                    ? 'bg-cyan-900/40 border-cyan-500/60 text-cyan-400'
                    : 'bg-[#101b33] border-gray-700/50 text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </Panel>

        {/* Environment Controls */}
        <Panel>
          <PanelHeader icon={Cloud} title="ENVIRONMENT" color="text-orange-400" />

          <SliderControl
            label="SPACE DUST DENSITY"
            value={snapshot.spaceDustDensity}
            onChange={(v) => { scenarioLabEngine.spaceDustDensity = v; }}
          />

          <div className="mt-2 flex flex-col gap-1">
            <ToggleControl
              label="LiDAR"
              icon={Eye}
              active={snapshot.lidarEnabled}
              onToggle={() => { scenarioLabEngine.lidarEnabled = !scenarioLabEngine.lidarEnabled; }}
            />
            <ToggleControl
              label="ATM TURBULENCE"
              icon={Zap}
              active={snapshot.atmosphericTurbulence}
              onToggle={() => { scenarioLabEngine.atmosphericTurbulence = !scenarioLabEngine.atmosphericTurbulence; }}
            />
            <ToggleControl
              label="THERMAL DRIFT"
              icon={Thermometer}
              active={snapshot.thermalDrift}
              onToggle={() => { scenarioLabEngine.thermalDrift = !scenarioLabEngine.thermalDrift; }}
            />
          </div>
        </Panel>

        {/* Camera Controls */}
        <Panel>
          <PanelHeader icon={Navigation} title="CAMERA" color="text-purple-400" />
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: 'EARTH', label: 'FOCUS EARTH' },
              { key: 'LINK', label: 'FOCUS LINK' },
              { key: 'SATA', label: 'FOCUS SAT A' },
              { key: 'SATB', label: 'FOCUS SAT B' },
              { key: 'RESET', label: 'RESET CAMERA' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFocusTarget(key)}
                className={`text-[9px] py-1 rounded border transition ${
                  focusTarget === key
                    ? 'bg-purple-900/30 border-purple-500/50 text-purple-400'
                    : 'bg-[#101b33] border-gray-700/50 text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Panel>

        {/* Event Log */}
        <Panel className="flex-1 min-h-[150px] flex flex-col">
          <PanelHeader icon={Activity} title="EVENT LOG" color="text-green-400" />
          <div className="flex-1 overflow-y-auto flex flex-col gap-1 font-mono text-[9px] pr-1">
            {snapshot.eventLog?.map((log, i) => (
              <div key={i} className="flex gap-2">
                <span className="text-gray-500 shrink-0">{log.time}</span>
                <span className={log.msg.includes('BLOCKED') || log.msg.includes('DEGRADED') ? 'text-red-400' : 'text-gray-300'}>{log.msg}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ======================== RIGHT PANEL — TELEMETRY ======================== */}
      <div className="absolute top-14 right-3 w-60 z-10 flex flex-col gap-2 max-h-[calc(100vh-80px)] overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

        {/* Optical Data Link */}
        <Panel>
          <PanelHeader icon={Radio} title="OPTICAL DATA LINK" />
          <TelemetryRow
            label="LASER"
            value={snapshot.laserEnabled ? '● ON' : '● OFF'}
            color={snapshot.laserEnabled ? 'text-green-400' : 'text-red-500'}
          />
          <TelemetryRow
            label="OPTICAL LOCK"
            value={snapshot.linkState === 'LASER_SAFE_SHUTDOWN' ? 'BLOCKED' : snapshot.linkState === 'OBSTRUCTION_DETECTED' ? 'WARNING' : (snapshot.linkState === 'TRANSMISSION' || snapshot.linkState === 'DISTURBANCE') ? '● LOCKED' : snapshot.linkState}
            color={snapshot.laserEnabled ? 'text-green-400' : 'text-orange-400'}
          />
          <TelemetryRow
            label="DATA TRANSFER"
            value={snapshot.dataTransfer ? '● ACTIVE' : '● STOPPED'}
            color={snapshot.dataTransfer ? 'text-cyan-400' : 'text-red-500'}
          />
          <TelemetryRow
            label="DATA RATE"
            value={`${snapshot.dataRate.toFixed(1)} Gbps`}
            color={snapshot.dataTransfer ? 'text-cyan-400' : 'text-red-500'}
          />
          {(!snapshot.dataTransfer && snapshot.linkState === 'LASER_SAFE_SHUTDOWN') && (
            <div className="text-red-500 text-[10px] mt-1 bg-red-950/40 p-1 border border-red-900/50 rounded">
              REASON: LiDAR obstruction predicted
            </div>
          )}
          {(!snapshot.dataTransfer && snapshot.linkState === 'EARTH_OCCULTED') && (
            <div className="text-red-500 text-[10px] mt-1 bg-red-950/40 p-1 border border-red-900/50 rounded">
              REASON: EARTH OCCULTATION
            </div>
          )}
          <TelemetryRow
            label="RECEIVED POWER"
            value={`${snapshot.receivedPower.toFixed(1)} dBm`}
            color={snapshot.receivedPower < -60 ? 'text-red-500' : 'text-green-400'}
          />
          <TelemetryRow
            label="SNR"
            value={`${snapshot.snr.toFixed(1)} dB`}
            color={snapshot.snr < 10 ? 'text-red-500' : snapshot.snr < 20 ? 'text-yellow-400' : 'text-green-400'}
          />
          <TelemetryRow label="BER" value={formatBer(snapshot.ber)} color={snapshot.ber > 1e-6 ? 'text-red-500' : 'text-green-400'} />
          <TelemetryRow
            label="LINK MARGIN"
            value={`${snapshot.linkMargin.toFixed(1)} dB`}
            color={snapshot.linkMargin < 5 ? 'text-red-500' : snapshot.linkMargin < 15 ? 'text-yellow-400' : 'text-green-400'}
          />
        </Panel>

        {/* Orbit / Navigation */}
        <Panel>
          <PanelHeader icon={Navigation} title="NAVIGATION" color="text-purple-400" />
          <TelemetryRow
            label="Sat A Velocity"
            value={`${(snapshot.satAVelocity * 10).toFixed(1)} km/s`}
          />
          <TelemetryRow
            label="Sat B Velocity"
            value={`${(snapshot.satBVelocity * 10).toFixed(1)} km/s`}
          />
          <TelemetryRow
            label="Nav State"
            value={snapshot.navState}
            color={
              snapshot.navState === 'AVOIDANCE_MANEUVER' ? 'text-orange-500 font-bold' :
              snapshot.navState === 'RETURNING' ? 'text-yellow-400' : 'text-green-400'
            }
          />
        </Panel>

        {/* Tracking / Gimbal */}
        <Panel>
          <PanelHeader icon={Crosshair} title="TRACKING" color="text-yellow-400" />
          <TelemetryRow
            label="Status"
            value={snapshot.linkStatus === 'LOCKED' ? 'TRACKING' : snapshot.linkStatus}
            color={snapshot.linkStatus === 'LOCKED' ? 'text-green-400' : 'text-yellow-400'}
          />
          <TelemetryRow
            label="Pointing Error"
            value={`${snapshot.pointingError.toFixed(1)} µrad`}
            color={snapshot.pointingError > 20 ? 'text-orange-400' : 'text-green-400'}
          />
          <TelemetryRow label="Gimbal AZ" value={`${snapshot.gimbalAz.toFixed(1)}°`} />
          <TelemetryRow label="Gimbal EL" value={`${snapshot.gimbalEl.toFixed(1)}°`} />
        </Panel>

        {/* LiDAR Status */}
        <Panel>
          <PanelHeader icon={Aperture} title="LIDAR STATUS" color="text-cyan-400" />
          <TelemetryRow
            label="Scan"
            value={snapshot.lidarEnabled ? 'ACTIVE' : 'DISABLED'}
            color={snapshot.lidarEnabled ? 'text-green-400' : 'text-gray-500'}
          />
          <TelemetryRow label="Objects Detected" value={String(snapshot.lidarDetected.length)} />
          <TelemetryRow label="Nearest Object" value={snapshot.lidarNearestObj || '---'} />
          <TelemetryRow
            label="Distance"
            value={snapshot.lidarNearestDist < 999 ? `${(snapshot.lidarNearestDist * 100).toFixed(0)} km` : '---'}
          />
          <TelemetryRow
            label="Relative Velocity"
            value={snapshot.lidarNearestVelocity > 0 ? `${(snapshot.lidarNearestVelocity * 10).toFixed(1)} km/s` : '---'}
          />
          <TelemetryRow
            label="Time to Approach"
            value={
              snapshot.lidarDetected.length > 0 && snapshot.lidarDetected[0].tca > 0
                ? `${snapshot.lidarDetected[0].tca.toFixed(1)} s`
                : '---'
            }
          />
          <TelemetryRow
            label="Obstruction Risk"
            value={snapshot.lidarObstructionRisk}
            color={
              snapshot.lidarObstructionRisk === 'CRITICAL' || snapshot.lidarObstructionRisk === 'HIGH' ? 'text-red-500 font-bold animate-pulse' :
              snapshot.lidarObstructionRisk === 'MEDIUM' ? 'text-orange-400' :
              snapshot.lidarObstructionRisk === 'LOW' ? 'text-yellow-400' :
              'text-green-400'
            }
          />
        </Panel>

        {/* Environment */}
        <Panel>
          <PanelHeader icon={AlertTriangle} title="ENVIRONMENT" color="text-orange-500" />
          <TelemetryRow label="Asteroid Density" value={`${snapshot.asteroidCount} objects`} />
          <TelemetryRow
            label="Space Dust"
            value={`${Math.round(snapshot.spaceDustDensity * 100)}%`}
            color={snapshot.spaceDustDensity > 0.5 ? 'text-orange-400' : 'text-white'}
          />
          <TelemetryRow
            label="Atm. Turbulence"
            value={snapshot.atmosphericTurbulence ? 'ACTIVE' : 'OFF'}
            color={snapshot.atmosphericTurbulence ? 'text-orange-400' : 'text-gray-500'}
          />
          <TelemetryRow
            label="Thermal Drift"
            value={snapshot.thermalDrift ? 'ACTIVE' : 'OFF'}
            color={snapshot.thermalDrift ? 'text-orange-400' : 'text-gray-500'}
          />
          <div className="mt-1 pt-1 border-t border-[#1a365d]/30">
            <TelemetryRow label="Dust Loss" value={`${snapshot.dustAttenuation.toFixed(1)} dB`} color="text-gray-400" />
            <TelemetryRow label="Atm. Loss" value={`${snapshot.atmTurbulenceLoss.toFixed(1)} dB`} color="text-gray-400" />
            <TelemetryRow label="Thermal Loss" value={`${snapshot.thermalDriftLoss.toFixed(1)} dB`} color="text-gray-400" />
            <TelemetryRow label="Pointing Loss" value={`${snapshot.pointingLoss.toFixed(1)} dB`} color="text-gray-400" />
          </div>
        </Panel>
      </div>

      {/* ======================== BOTTOM CENTER — TIMELINE ======================== */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-4xl px-4 pointer-events-none">
        <Panel className="bg-[#020305]/95 border-cyan-900 shadow-[0_0_20px_rgba(0,170,255,0.1)] pointer-events-auto">
          <div className="flex items-center justify-between">
            {[
              { id: 1, label: 'INITIALIZATION' },
              { id: 2, label: 'BEACON DETECTION' },
              { id: 3, label: 'TRACKING' },
              { id: 4, label: 'ALIGNMENT' },
              { id: 5, label: 'OPTICAL LOCK' },
              { id: 6, label: 'LASER TRANSMISSION' },
              { id: 7, label: 'DISTURBANCE' },
              { id: 8, label: 'LINK RESPONSE' },
            ].map((phase, i, arr) => (
              <React.Fragment key={phase.id}>
                <div className="flex flex-col items-center gap-1 w-24">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border transition-colors ${
                    snapshot.timelinePhase === phase.id
                      ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_#00aaff]'
                      : snapshot.timelinePhase > phase.id
                      ? 'bg-cyan-900/40 text-cyan-500 border-cyan-800'
                      : 'bg-[#101b33] text-gray-600 border-gray-800'
                  }`}>
                    {String(phase.id).padStart(2, '0')}
                  </div>
                  <span className={`text-[8px] text-center font-bold tracking-widest ${
                    snapshot.timelinePhase === phase.id ? 'text-white' : 'text-gray-500'
                  }`}>
                    {phase.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div className="flex-1 h-px bg-gray-800 mx-2 relative -mt-4">
                     {snapshot.timelinePhase > phase.id && (
                       <div className="absolute top-0 left-0 h-full bg-cyan-600 shadow-[0_0_5px_#00aaff] w-full" />
                     )}
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
