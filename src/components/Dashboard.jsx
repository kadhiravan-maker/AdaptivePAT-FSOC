import React, { useEffect, useState } from 'react';
import { 
  Box, Orbit, LineChart as ChartIcon, Wind, Settings, 
  Layers, ShieldAlert, Cloud, Radio, Zap, 
  Crosshair, Sun, Move, Activity, AlertTriangle, Disc, Home
} from 'lucide-react';
import { engine } from '../simulation/physicsEngine';
import { Charts } from './Charts';
import { motion, useDragControls } from 'framer-motion';

let topZIndex = 50;

function DraggablePanel({ title, children, initialStyle, width = 280, collapsible = false, constraintsRef }) {
  const [zIndex, setZIndex] = useState(topZIndex);
  const [collapsed, setCollapsed] = useState(false);
  const controls = useDragControls();

  const bringToFront = () => {
    topZIndex += 1;
    setZIndex(topZIndex);
  };

  return (
    <motion.div
      drag
      dragControls={controls}
      dragListener={false}
      dragMomentum={false}
      dragConstraints={constraintsRef || { left: -2000, right: 2000, top: -1500, bottom: 1500 }}
      onPointerDown={bringToFront}
      style={{ position: 'absolute', width, zIndex, ...initialStyle }}
      className="glass-panel flex flex-col pointer-events-auto"
    >
      <div 
        className="glass-panel-header px-4 py-2 flex justify-between items-center cursor-move"
        onPointerDown={(e) => controls.start(e)}
        style={{ touchAction: 'none' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-500">⋮⋮</span>
          <h2 className="text-xs font-bold text-gray-300 uppercase">{title}</h2>
        </div>
        {collapsible && (
          <button 
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); setCollapsed(!collapsed); }}
            className="text-gray-400 hover:text-white px-2 cursor-pointer font-bold"
          >
            {collapsed ? '[+]' : '[−]'}
          </button>
        )}
      </div>
      {!collapsed && (
        <div className="p-3 flex flex-col gap-3 pointer-events-auto max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      )}
    </motion.div>
  );
}

export function Dashboard({ quality, setQuality, cameraMode, setCameraMode, onNavigate }) {
  const containerRef = React.useRef(null);
  // Static state for initial render, except time and disturbances which we'll handle gracefully.
  const initEngineDists = engine.getDisturbances();
  const [disturbances, setDisturbances] = useState({
    turbulence: initEngineDists.turbulence * 100,
    cloudInterference: initEngineDists.cloudInterference * 100,
    vibration: initEngineDists.vibration * 100,
    thermalDrift: initEngineDists.thermalDrift * 100,
    spaceDust: initEngineDists.spaceDust * 100,
  });
  const [diag, setDiag] = useState({ active: false, charts: true, heatmap: true, camera: true });

  const [activeTab, setActiveTab] = useState('Simulation');
  const [demoMode, setDemoMode] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [autoTrack, setAutoTrack] = useState(true);
  const [showPosDebug, setShowPosDebug] = useState(false);
  const [showDistDebug, setShowDistDebug] = useState(true);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === 'Orbit View') {
      setCameraMode({ mode: 'ORBIT', ts: Date.now() });
    } else if (tab === 'Simulation') {
      setCameraMode({ mode: 'LINK', ts: Date.now() });
    }
  };

  useEffect(() => {
    if (diag.active) {
      // Allow a tiny delay for React to render the panel into the DOM
      setTimeout(() => {
        const el = document.getElementById('diagnostics-panel');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  }, [diag.active]);

  useEffect(() => {
    if (!demoMode) return;
    
    // DEMO MODE Sequence
    let step = 0;
    const seq = setInterval(() => {
      step++;
      if (step === 2) triggerEvent('clear'); // Search/Detect/Align
      if (step === 8) triggerEvent('critical'); // Introduce Disturbance -> Loss of Lock
      if (step === 12) triggerEvent('clear'); // Recover
      if (step > 15) setDemoMode(false);
    }, 2000);
    
    return () => clearInterval(seq);
  }, [demoMode]);

  const handleSliderChange = (e) => {
    const { name, value } = e.target;
    const numValue = parseFloat(value);
    const newDists = { ...disturbances, [name]: numValue };
    setDisturbances(newDists);
    // Explicit conversion for physics engine: 0-100 UI -> 0.0-1.0 Physics
    engine.setDisturbances({
      turbulence: newDists.turbulence / 100,
      cloudInterference: newDists.cloudInterference / 100,
      vibration: newDists.vibration / 100,
      thermalDrift: newDists.thermalDrift / 100,
      spaceDust: newDists.spaceDust / 100
    });
  };

  const triggerEvent = (preset) => {
    let target = { vibration: 0, thermalDrift: 0, spaceDust: 0, turbulence: 0, cloudInterference: 0 };
    switch (preset) {
      case 'clear': break;
      case 'turbulence': target = { ...target, turbulence: 80 }; break;
      case 'cloud': target = { ...target, cloudInterference: 90 }; break;
      case 'vibration': target = { ...target, vibration: 90 }; break;
      case 'thermal': target = { ...target, thermalDrift: 90 }; break;
      case 'dust': target = { ...target, spaceDust: 90 }; break;
      case 'severe': 
        target = { vibration: 60, thermalDrift: 60, spaceDust: 50, turbulence: 80, cloudInterference: 85 }; 
        break;
      case 'scripted':
        // A temporary script to slowly ramp up the disturbance
        let step = 0;
        const seq = setInterval(() => {
          step++;
          setDisturbances(prev => {
            const next = {
              vibration: Math.min(80, prev.vibration + 5),
              turbulence: Math.min(80, prev.turbulence + 5),
              cloudInterference: 0,
              thermalDrift: Math.min(50, prev.thermalDrift + 3),
              spaceDust: 0
            };
            engine.setDisturbances({
              turbulence: next.turbulence / 100,
              cloudInterference: next.cloudInterference / 100,
              vibration: next.vibration / 100,
              thermalDrift: next.thermalDrift / 100,
              spaceDust: next.spaceDust / 100
            });
            return next;
          });
          if (step > 15) {
            clearInterval(seq);
            // Then let auto-tracking "recover" by clearing them out slowly
            let rec = 0;
            const seq2 = setInterval(() => {
              rec++;
              setDisturbances(prev => {
                const next = {
                  vibration: Math.max(0, prev.vibration - 5),
                  turbulence: Math.max(0, prev.turbulence - 5),
                  cloudInterference: 0,
                  thermalDrift: Math.max(0, prev.thermalDrift - 5),
                  spaceDust: 0
                };
                engine.setDisturbances({
                  turbulence: next.turbulence / 100,
                  cloudInterference: next.cloudInterference / 100,
                  vibration: next.vibration / 100,
                  thermalDrift: next.thermalDrift / 100,
                  spaceDust: next.spaceDust / 100
                });
                return next;
              });
              if (rec > 20) clearInterval(seq2);
            }, 300);
          }
        }, 300);
        return;
    }
    setDisturbances(target);
    engine.setDisturbances({
      turbulence: target.turbulence / 100,
      cloudInterference: target.cloudInterference / 100,
      vibration: target.vibration / 100,
      thermalDrift: target.thermalDrift / 100,
      spaceDust: target.spaceDust / 100
    });
  };
  const statesList = [
    { id: 'SEARCH', label: 'Search' },
    { id: 'BEACON_DETECTION', label: 'Beacon Detection' },
    { id: 'TRACKING', label: 'Tracking' },
    { id: 'ALIGNMENT', label: 'Alignment' },
    { id: 'LOCKED', label: 'Lock' },
    { id: 'TRANSMITTING', label: 'Laser Transmission' }
  ];
  
  const formatBer = (ber) => {
    return ber.toExponential(1).replace('e', ' × 10').replace('+', '');
  };

  return (
    <div ref={containerRef} className="absolute inset-0 z-10 pointer-events-none p-4 flex flex-col justify-between overflow-hidden">
      
      {/* HEADER */}
      <header className="flex justify-between items-center w-full pointer-events-none">
        <div className="flex items-center gap-3 w-1/4 pointer-events-auto">
          <div className="w-10 h-10 bg-aerospace-cyan/20 rounded flex items-center justify-center border border-aerospace-cyan shadow-[0_0_15px_rgba(0,170,255,0.3)]">
            <Box className="text-aerospace-cyan" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-widest text-white neon-text-cyan">FSOC 3D SIMULATOR</h1>
            <p className="text-[9px] text-gray-400 tracking-[0.1em] mt-0.5">Free Space Optical Communication • Moving Beacon Tracking • Real-time Simulation</p>
          </div>
        </div>

        {/* State Machine Flow */}
        <div className="pointer-events-auto">
          <DynamicStateMachine statesList={statesList} />
        </div>

        <div className="flex items-center justify-end gap-4 w-1/4 pointer-events-auto">
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-500 mb-0.5">Graphics Quality</span>
            <select 
              value={quality} 
              onChange={(e) => setQuality(e.target.value)}
              className="bg-[#101b33] border border-[#1a365d] text-xs px-2 py-0.5 rounded text-white outline-none cursor-pointer hover:border-aerospace-cyan transition-colors"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-gray-500">Simulation Time</div>
            <div className="font-mono text-xl font-bold text-aerospace-cyan">
               <DynamicValue getter={() => new Date().toTimeString().split(' ')[0]} />
            </div>
          </div>
          <button className="bg-aerospace-beacon/20 border border-aerospace-beacon text-aerospace-beacon px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-aerospace-beacon animate-pulse" />
            Auto Track: ON
          </button>
        </div>
      </header>

      {/* MIDDLE SECTION */}
      <div className="flex-1 flex justify-between items-stretch my-4 w-full relative min-h-0">
        
        {/* LEFT SIDEBAR (Nav) */}
        <div className="w-40 flex flex-col gap-2 pointer-events-auto overflow-y-auto h-full pr-2 pb-4 scrollbar-hide" style={{ minHeight: 0 }}>
          <NavButton icon={<Home size={16}/>} label="Home Menu" active={false} onClick={() => onNavigate && onNavigate('/')} />
          <NavButton icon={<Box size={16}/>} label="Simulation" active={activeTab === 'Simulation'} onClick={() => handleTabChange('Simulation')} />
          <NavButton icon={<Disc size={16}/>} label="Orbit View" active={activeTab === 'Orbit View'} onClick={() => handleTabChange('Orbit View')} />
          <NavButton icon={<ChartIcon size={16}/>} label="Link Analysis" active={activeTab === 'Link Analysis'} onClick={() => handleTabChange('Link Analysis')} />
          <NavButton icon={<Wind size={16}/>} label="Disturbances" active={activeTab === 'Disturbances'} onClick={() => handleTabChange('Disturbances')} />
          <NavButton icon={<Settings size={16}/>} label="System Control" active={activeTab === 'System Control'} onClick={() => handleTabChange('System Control')} />
          <NavButton icon={<Zap size={16}/>} label="Scenarios" active={window.location.pathname === '/scenarios'} onClick={() => onNavigate && onNavigate('/scenarios')} />
          <NavButton icon={<Layers size={16}/>} label="Reports" active={activeTab === 'Reports'} onClick={() => handleTabChange('Reports')} />
          
          <button 
            onClick={() => setDemoMode(!demoMode)}
            className={`mt-4 flex items-center justify-center gap-2 px-3 py-2 rounded text-[10px] font-bold border transition-colors shrink-0 ${
              demoMode ? 'bg-aerospace-beacon/20 text-aerospace-beacon border-aerospace-beacon shadow-[0_0_10px_rgba(0,255,102,0.5)] animate-pulse' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
            }`}
          >
            {demoMode ? 'DEMO MODE ON' : 'DEMO MODE'}
          </button>
          
          <div className="mt-4 flex flex-col gap-1 shrink-0">
            <span className="text-[8px] text-gray-500 font-bold tracking-wider mb-1">CAMERA CONTROL</span>
            <button 
              onClick={() => setCameraMode({ mode: 'LINK', ts: Date.now() })}
              className={`px-3 py-1.5 rounded text-[9px] font-bold border transition-colors text-left ${
                cameraMode.mode === 'LINK' ? 'bg-aerospace-cyan/20 text-aerospace-cyan border-aerospace-cyan' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
              }`}
            >FOCUS LINK</button>
            <button 
              onClick={() => setCameraMode({ mode: 'SATA', ts: Date.now() })}
              className={`px-3 py-1.5 rounded text-[9px] font-bold border transition-colors text-left ${
                cameraMode.mode === 'SATA' ? 'bg-aerospace-cyan/20 text-aerospace-cyan border-aerospace-cyan' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
              }`}
            >FOCUS SAT A</button>
            <button 
              onClick={() => setCameraMode({ mode: 'SATB', ts: Date.now() })}
              className={`px-3 py-1.5 rounded text-[9px] font-bold border transition-colors text-left ${
                cameraMode.mode === 'SATB' ? 'bg-aerospace-cyan/20 text-aerospace-cyan border-aerospace-cyan' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
              }`}
            >FOCUS SAT B</button>
            <button 
              onClick={() => setCameraMode({ mode: 'RESET', ts: Date.now() })}
              className={`px-3 py-1.5 rounded text-[9px] font-bold border transition-colors text-left ${
                cameraMode.mode === 'RESET' ? 'bg-aerospace-cyan/20 text-aerospace-cyan border-aerospace-cyan' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
              }`}
            >RESET CAMERA</button>
          </div>
          
          <div className="shrink-0 mt-4">
            <button 
              onClick={() => setDiag({...diag, active: !diag.active})}
              className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-[10px] font-bold border transition-colors ${
                diag.active ? 'bg-red-500/20 text-red-400 border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-transparent text-gray-500 border-gray-700 hover:border-gray-500'
              }`}
            >
              DIAGNOSTICS
            </button>
            
            {diag.active && (
              <div id="diagnostics-panel" className="flex flex-col gap-1 mt-2 p-2 glass-panel border-red-500/30">
                <div className="text-[8px] text-red-400 mb-1 font-bold">DISABLE EXPENSIVE FEATURES</div>
                {Object.keys(diag).map(key => key !== 'active' && (
                  <label key={key} className="flex items-center justify-between text-[9px] text-gray-300 cursor-pointer">
                    <span className="capitalize">{key}</span>
                    <input type="checkbox" checked={diag[key]} onChange={() => setDiag({...diag, [key]: !diag[key]})} className="accent-red-500" />
                  </label>
                ))}
                <div className="text-[8px] text-red-400 mt-2 mb-1 font-bold">DEVELOPMENT TOOLS</div>
                <label className="flex items-center justify-between text-[9px] text-gray-300 cursor-pointer">
                  <span>POSITION DEBUG</span>
                  <input type="checkbox" checked={showPosDebug} onChange={() => setShowPosDebug(!showPosDebug)} className="accent-red-500" />
                </label>
                <label className="flex items-center justify-between text-[9px] text-gray-300 cursor-pointer">
                  <span>DISTURBANCE DEBUG</span>
                  <input type="checkbox" checked={showDistDebug} onChange={() => setShowDistDebug(!showDistDebug)} className="accent-red-500" />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* CENTER OVERLAYS */}
        {activeTab === 'Orbit View' && (
          <DraggablePanel title="Top View (Orbit Plane)" initialStyle={{ right: 320, top: 80 }} width={240} constraintsRef={containerRef}>
            <DynamicTopView />
          </DraggablePanel>
        )}

        <DynamicHUD constraintsRef={containerRef} />

        {/* DRAGGABLE PANELS (Right Side Default) */}
        {(activeTab === 'Simulation' || activeTab === 'Link Analysis') && (
          <DraggablePanel title="Link Status" initialStyle={{ right: 20, top: 80 }} constraintsRef={containerRef}>
            <div className="flex flex-col gap-2">
              <StatusRow label="Distance" value={<DynamicValue getter={() => `${engine.getState().distance.toFixed(0)} km`} />} />
              <StatusRow label="Pointing Error" value={<DynamicValue getter={() => `${engine.getState().pointingError.toFixed(1)} µrad`} />} />
              <StatusRow label="Link Margin" value={<DynamicValue getter={() => `${Math.max(0, engine.getState().snr - 12).toFixed(1)} dB`} />} />
              <StatusRow label="Data Rate" value={<DynamicValue getter={() => engine.getState().linkState === 'TRANSMITTING' ? "10 Gbps" : "0 Gbps"} />} />
              <StatusRow label="BER" value={<DynamicValue getter={() => formatBer(engine.getState().ber)} />} />
            </div>
          </DraggablePanel>
        )}

        {(activeTab === 'Disturbances' || activeTab === 'Simulation') && (
          <DraggablePanel title="Disturbances" initialStyle={{ right: 20, top: 300 }} constraintsRef={containerRef}>
            <SliderRow icon={<Wind size={12}/>} label="Atmospheric Turbulence" name="turbulence" value={disturbances.turbulence} onChange={handleSliderChange} />
            <SliderRow icon={<Cloud size={12}/>} label="Cloud Interference" name="cloudInterference" value={disturbances.cloudInterference} onChange={handleSliderChange} />
            <SliderRow icon={<Activity size={12}/>} label="Satellite Vibration" name="vibration" value={disturbances.vibration} onChange={handleSliderChange} />
            <SliderRow icon={<Sun size={12}/>} label="Thermal Drift" name="thermalDrift" value={disturbances.thermalDrift} onChange={handleSliderChange} />
            <SliderRow icon={<Crosshair size={12}/>} label="Space Dust" name="spaceDust" value={disturbances.spaceDust || 0} onChange={handleSliderChange} />
          </DraggablePanel>
        )}



        {activeTab === 'System Control' && (
          <DraggablePanel title="System Control" initialStyle={{ right: 20, top: 80 }} constraintsRef={containerRef}>
            <div className="flex flex-col gap-4">
              <div>
                <div className="text-[10px] text-gray-500 mb-1">SIMULATION</div>
                <button 
                  onClick={() => { engine.isPaused = !engine.isPaused; setIsPaused(engine.isPaused); }}
                  className="w-full bg-[#101b33] border border-[#1a365d] hover:bg-[#1a365d] text-white text-xs py-1.5 rounded transition"
                >
                  {isPaused ? 'Resume' : 'Pause'}
                </button>
              </div>
              
              <div>
                <div className="text-[10px] text-gray-500 mb-1">AUTO TRACK</div>
                <button 
                  onClick={() => { engine.autoTrack = !engine.autoTrack; setAutoTrack(engine.autoTrack); }}
                  className={`w-full text-xs py-1.5 rounded transition font-bold border ${
                    autoTrack 
                      ? 'bg-aerospace-beacon/20 border-aerospace-beacon text-aerospace-beacon shadow-[0_0_10px_rgba(0,255,102,0.5)]'
                      : 'bg-[#101b33] border-gray-600 text-gray-500 hover:text-gray-300'
                  }`}
                >
                  {autoTrack ? 'ON' : 'OFF'}
                </button>
              </div>
              
              <div>
                <div className="text-[10px] text-gray-500 mb-1">SIMULATION SPEED</div>
                <div className="flex gap-1">
                  {[0.25, 0.5, 1, 2].map(speed => (
                    <button 
                      key={speed}
                      onClick={() => { engine.simSpeed = speed; setSimSpeed(speed); }}
                      className={`flex-1 text-[10px] py-1 rounded transition border ${simSpeed === speed ? 'bg-[#1a365d] border-aerospace-blue text-white' : 'bg-[#101b33] border-[#1a365d] text-gray-400'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
              
              <div>
                <div className="text-[10px] text-gray-500 mb-1">GRAPHICS QUALITY</div>
                <div className="flex gap-1">
                  {['LOW', 'MEDIUM', 'HIGH'].map(q => (
                    <button 
                      key={q}
                      onClick={() => setQuality(q)}
                      className={`flex-1 text-[10px] py-1 rounded transition border ${quality === q ? 'bg-[#1a365d] border-aerospace-blue text-white' : 'bg-[#101b33] border-[#1a365d] text-gray-400'}`}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-gray-500 mb-1">CAMERA</div>
                <div className="flex gap-1">
                  <button onClick={() => setCameraMode({ mode: 'RESET', ts: Date.now() })} className="flex-1 bg-[#101b33] border border-[#1a365d] hover:bg-[#1a365d] text-white text-[10px] py-1.5 rounded transition">Reset Camera</button>
                  <button onClick={() => setCameraMode({ mode: 'LINK', ts: Date.now() })} className="flex-1 bg-[#101b33] border border-[#1a365d] hover:bg-[#1a365d] text-white text-[10px] py-1.5 rounded transition">Focus Link</button>
                </div>
              </div>
            </div>
          </DraggablePanel>
        )}

        {activeTab === 'Reports' && (
          <DraggablePanel title="Simulation Report" initialStyle={{ right: 20, top: 80 }} width={300} constraintsRef={containerRef}>
            <DynamicReport />
          </DraggablePanel>
        )}
      </div>

      {/* BOTTOM SECTION: Charts & Diagnostics */}
      {activeTab === 'Link Analysis' && (
      <DraggablePanel title="Link Analysis Charts" initialStyle={{ left: '10vw', top: '50vh' }} width={800} constraintsRef={containerRef}>
        <div className="w-full">
          <Charts />
        </div>
      </DraggablePanel>
      )}

      {/* TRACKING CAMERA (Always in bottom right if not disabled) */}
      <DraggablePanel title="Tracking Camera View (Sat A)" initialStyle={{ right: 320, top: '65vh' }} width={256} constraintsRef={containerRef}>
         <div className="relative overflow-hidden w-full h-48">
           <DynamicTrackingCameraView />
         </div>
      </DraggablePanel>

      {/* DEVELOPER DEBUG OVERLAY */}
    </div>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-3 px-3 py-2 rounded transition-colors text-[12px] ${
      active 
        ? 'bg-aerospace-blue/20 border border-aerospace-blue text-white shadow-[inset_0_0_10px_rgba(59,130,246,0.2)]' 
        : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
    }`}>
      {icon} {label}
    </button>
  );
}

function StatusRow({ label, value }) {
  return (
    <div className="flex justify-between items-center text-[11px]">
      <span className="text-gray-400">{label}</span>
      <span className="font-mono text-white">{value}</span>
    </div>
  );
}

function SliderRow({ icon, label, name, value, onChange }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-gray-300 flex items-center gap-1.5">{icon} {label}</span>
        <span className="font-mono text-gray-400">{value.toFixed(0)}%</span>
      </div>
      <input 
        type="range" 
        name={name} 
        min="0" 
        max="100" 
        value={value} 
        onChange={onChange}
        className="w-full h-1 bg-[#1a365d] rounded-lg appearance-none cursor-pointer accent-aerospace-blue"
      />
    </div>
  );
}

function ScenarioBtn({ icon, label, onClick, active }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[9px] transition-colors border ${
        active 
          ? 'bg-[#1a365d] border-aerospace-blue text-white' 
          : 'bg-[#101b33] border-[#1a365d] text-gray-400 hover:border-gray-500 hover:text-white'
      }`}
    >
      <span className={active ? 'text-yellow-500' : 'text-gray-500'}>{icon}</span>
      {label}
    </button>
  );
}

// -----------------------------------------------------
// OPTIMIZATION: Small isolated components for high-freq updates
// -----------------------------------------------------

function DynamicValue({ getter }) {
  const [val, setVal] = useState(getter());
  useEffect(() => {
    const int = setInterval(() => setVal(getter()), 100);
    return () => clearInterval(int);
  }, []);
  return <>{val}</>;
}

function DynamicLinkStatusIndicator() {
  const [linkState, setLinkState] = useState(engine.getState().linkState);
  useEffect(() => {
    const int = setInterval(() => setLinkState(engine.getState().linkState), 100);
    return () => clearInterval(int);
  }, []);
  
  return (
    <>
      <div className={`w-3 h-3 rounded-full ${linkState === 'TRANSMITTING' ? 'bg-aerospace-beacon shadow-[0_0_10px_#00ff66]' : 'bg-gray-600'}`} />
      <span className={`text-[13px] font-bold tracking-wider ${linkState === 'TRANSMITTING' ? 'text-aerospace-beacon neon-text-beacon' : 'text-gray-400'}`}>
        {linkState === 'TRANSMITTING' ? 'LOCKED & TRANSMITTING' : linkState}
      </span>
    </>
  );
}

function DynamicStateMachine({ statesList }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const int = setInterval(() => {
      setIdx(statesList.findIndex(s => s.id === engine.getState().linkState));
    }, 100);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="flex items-center gap-2 flex-1 justify-center">
      {statesList.map((st, i) => {
        const isActive = i <= idx;
        return (
          <React.Fragment key={st.id}>
            <div className="flex flex-col items-center justify-center relative w-16">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold z-10 border transition-all duration-300 ${
                isActive ? 'bg-aerospace-cyan text-black border-aerospace-cyan shadow-[0_0_10px_#00aaff]' : 'bg-[#101b33] text-gray-500 border-[#1a365d]'
              }`}>
                {i + 1}
              </div>
              <span className={`text-[9px] mt-1 whitespace-nowrap transition-colors duration-300 ${isActive ? 'text-white' : 'text-gray-500'}`}>{st.label}</span>
            </div>
            {i < statesList.length - 1 && (
              <div className="relative w-8 -mt-4">
                 <div className={`absolute top-1/2 left-0 right-0 h-px transition-colors duration-300 ${i < idx ? 'bg-aerospace-cyan shadow-[0_0_5px_#00aaff]' : 'bg-[#1a365d]'}`} />
                 {i < idx && <div className="absolute top-1/2 right-0 w-1.5 h-1.5 border-t border-r border-aerospace-cyan rotate-45 -mt-[3px]" />}
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function DynamicTrackingCameraView() {
  const [st, setSt] = useState({ err: 0, el: 0, tel: 0, az: 0, taz: 0 });
  useEffect(() => {
    const int = setInterval(() => {
      const state = engine.getState();
      setSt({ 
        err: state.pointingError, 
        el: state.gimbal.el, tel: state.gimbal.targetEl, 
        az: state.gimbal.az, taz: state.gimbal.targetAz 
      });
    }, 100);
    return () => clearInterval(int);
  }, []);

  return (
    <>
      {/* Simulated Earth Horizon Background */}
      <div className="absolute inset-0 top-7 bg-gradient-to-b from-[#02050a] to-[#04122b] z-0" />
      <div className="absolute bottom-0 w-full h-[40%] border-t border-aerospace-blue/30 rounded-t-[100%] bg-blue-900/10 z-0" />

      <div className="absolute top-9 left-3 flex items-center gap-1 z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-aerospace-beacon shadow-[0_0_5px_#00ff66]" />
        <span className="text-[9px] text-aerospace-beacon">Beacon Detected</span>
      </div>
      <div className="absolute top-9 right-3 text-[9px] text-aerospace-beacon z-10">Tracking...</div>
      <div className="absolute bottom-2 right-3 text-[9px] text-aerospace-beacon z-10">Tracking Error: {st.err.toFixed(1)} µrad</div>

      {/* Crosshair */}
      <div className="absolute inset-0 top-7 flex items-center justify-center z-10">
        <div className="w-14 h-14 border border-aerospace-beacon/60 relative">
          <div className="absolute top-1/2 left-1/2 w-20 h-px bg-aerospace-beacon/40 -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 h-20 w-px bg-aerospace-beacon/40 -translate-x-1/2 -translate-y-1/2" />
          
          {/* Target Dot */}
          <div 
            className="absolute w-2 h-2 bg-white rounded-full shadow-[0_0_8px_#fff]"
            style={{
              top: `calc(50% - 4px + ${(st.tel - st.el) * 150}px)`,
              left: `calc(50% - 4px + ${(st.taz - st.az) * 150}px)`,
            }}
          />
        </div>
      </div>
    </>
  );
}

function DynamicHeatmap() {
  const [st, setSt] = useState({ ls: '', err: 0 });
  useEffect(() => {
    const int = setInterval(() => {
      const state = engine.getState();
      setSt({ ls: state.linkState, err: state.pointingError });
    }, 100);
    return () => clearInterval(int);
  }, []);

  return (
    <div 
      className="w-[70px] h-[70px] rounded-full"
      style={{
        background: `radial-gradient(circle at center, #fff 0%, #ff0055 20%, #7000aa 50%, #000 80%)`,
        opacity: st.ls === 'TRANSMITTING' ? 1 : 0.3,
        boxShadow: st.ls === 'TRANSMITTING' ? '0 0 20px rgba(255,0,85,0.5)' : 'none',
        transform: `scale(${1 + Math.min(1, st.err / 20)})`
      }}
    />
  );
}

function DynamicDataTransmission() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const int = setInterval(() => setTick(t => t + 1), 100);
    return () => clearInterval(int);
  }, []);

  return (
    <div className="font-mono text-[7px] text-aerospace-cyan leading-[1.2] opacity-70 overflow-hidden h-[35px] break-all select-none">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="whitespace-nowrap">
          {Array.from({ length: 12 }).map((_, j) => ((i * 12 + j + tick) % 3 === 0) ? '101' : '010').join(' ')}
        </div>
      ))}
    </div>
  );
}

function DynamicDebugOverlay({ constraintsRef }) {
  const [debug, setDebug] = useState(engine.getState());
  useEffect(() => {
    const int = setInterval(() => setDebug({...engine.getState()}), 100);
    return () => clearInterval(int);
  }, []);

  const formatAngle = (rad) => (rad * 180 / Math.PI).toFixed(4) + '°';
  const formatVec = (v) => v ? `${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}` : '';
  
  const targetAz = debug.gimbal?.targetAz || 0;
  const targetEl = debug.gimbal?.targetEl || 0;
  const gimbalAz = debug.gimbal?.az || 0;
  const gimbalEl = debug.gimbal?.el || 0;
  const azError = targetAz - gimbalAz;
  const elError = targetEl - gimbalEl;

  return (
    <DraggablePanel title="RAW PHYSICS" initialStyle={{ left: 200, top: '55vh' }} collapsible={true} constraintsRef={constraintsRef}>
      <div className="font-mono text-[9px] text-green-400">
        <table className="w-full text-left border-collapse">
          <tbody>
            <tr><td className="pr-2 py-0.5 text-gray-400">Target AZ</td><td>{formatAngle(targetAz)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Target EL</td><td>{formatAngle(targetEl)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Gimbal AZ</td><td>{formatAngle(gimbalAz)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Gimbal EL</td><td>{formatAngle(gimbalEl)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">AZ Error</td><td>{formatAngle(azError)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">EL Error</td><td>{formatAngle(elError)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">3D Ang Err</td><td>{debug.pointingError?.toFixed(1)} µrad</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Optical XYZ</td><td>{formatVec(debug.opticalAxis)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Target XYZ</td><td>{formatVec(debug.targetDirObj)}</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">Distance</td><td>{debug.distance?.toFixed(1)} km</td></tr>
            <tr><td className="pr-2 py-0.5 text-gray-400">State</td><td>{debug.linkState}</td></tr>
          </tbody>
        </table>
      </div>
    </DraggablePanel>
  );
}

function DynamicHUD({ constraintsRef }) {
  const [st, setSt] = useState({ ls: '', err: 0 });
  useEffect(() => {
    const int = setInterval(() => {
      const state = engine.getState();
      setSt({ ls: state.linkState, err: state.pointingError });
    }, 100);
    return () => clearInterval(int);
  }, []);

  const locked = st.ls === 'TRANSMITTING' || st.ls === 'LOCK';

  return (
    <DraggablePanel title="Optical Link Status" initialStyle={{ right: 320, top: 80 }} width={224} constraintsRef={constraintsRef}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-3 h-3 rounded-full ${locked ? 'bg-aerospace-beacon shadow-[0_0_8px_#00ff66]' : 'bg-red-500'}`} />
        <h3 className={`text-[13px] font-bold ${locked ? 'text-aerospace-beacon' : 'text-red-500'}`}>
          {locked ? '🔒 LOCKED' : '○ NOT LOCKED'}
        </h3>
      </div>
      <div className="flex flex-col gap-1 text-[10px] font-mono text-gray-300">
        <div>1550 nm LASER: <span className={st.ls === 'TRANSMITTING' ? 'text-aerospace-beacon' : 'text-gray-500'}>{st.ls === 'TRANSMITTING' ? 'ON' : 'OFF'}</span></div>
        <div>POINTING ERROR: {st.err.toFixed(1)} µrad</div>
        <div className="mt-2 text-aerospace-cyan">STATE: {st.ls}</div>
      </div>
    </DraggablePanel>
  );
}

function DynamicReport() {
  const [st, setSt] = useState(engine.getState());
  const [frames, setFrames] = useState(0);
  useEffect(() => {
    let f = 0;
    const count = () => { f++; requestAnimationFrame(count); };
    const af = requestAnimationFrame(count);
    const int = setInterval(() => {
      setSt({...engine.getState()});
      setFrames(f * 2); // roughly FPS if half second
      f = 0;
    }, 500);
    return () => { clearInterval(int); cancelAnimationFrame(af); };
  }, []);

  const formatAngle = (rad) => (rad * 180 / Math.PI).toFixed(4) + '°';
  const formatVec = (v) => v ? `${v.x.toFixed(4)}, ${v.y.toFixed(4)}, ${v.z.toFixed(4)}` : '';
  const d = st.effectiveDisturbances;

  return (
    <div className="flex flex-col gap-3 text-xs text-gray-300 font-mono h-full overflow-y-auto pb-8">
      <div className="text-center font-bold text-white border-b border-gray-600 pb-2 mb-2">FSOC ENGINEERING REPORT</div>
      
      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">SIMULATION HEALTH</div>
        <div className="flex justify-between"><span>Physics:</span> <span className="text-white">{window.simHealthStats?.physicsTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>Satellites:</span> <span className="text-white">{window.simHealthStats?.satelliteTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>Gimbal:</span> <span className="text-white">{window.simHealthStats?.gimbalTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>Laser:</span> <span className="text-white">{window.simHealthStats?.laserTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>State Machine:</span> <span className="text-white">{window.simHealthStats?.stateMachineTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>Telemetry:</span> <span className="text-white">{window.simHealthStats?.telemetryTick < 1000 ? 'RUNNING' : 'STOPPED'}</span></div>
        <div className="flex justify-between"><span>FPS:</span> <span className="text-white">{window.simHealthStats?.fps || 0}</span></div>
        <div className="flex justify-between"><span>Last Physics Update:</span> <span className="text-white">{window.simHealthStats?.physicsTick || 0} ms ago</span></div>
      </div>

      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">LINK PHYSICS (TELEMETRY)</div>
        <div className="flex justify-between"><span>Distance:</span> <span className="text-white">{st.distance?.toFixed(1)} km</span></div>
        <div className="flex justify-between"><span>Target Vector:</span> <span className="text-white">{formatVec(st.targetDirObj)}</span></div>
        <div className="flex justify-between"><span>Optical Axis:</span> <span className="text-white">{formatVec(st.opticalAxis)}</span></div>
        <div className="flex justify-between"><span>Laser Direction:</span> <span className="text-white">{formatVec(st.opticalAxis)}</span></div>
        <div className="flex justify-between"><span>Dot Product:</span> <span className="text-white">{st.dotProduct?.toFixed(9)}</span></div>
        <div className="flex justify-between"><span>Target AZ:</span> <span className="text-white">{formatAngle(st.gimbal?.targetAz || 0)}</span></div>
        <div className="flex justify-between"><span>Target EL:</span> <span className="text-white">{formatAngle(st.gimbal?.targetEl || 0)}</span></div>
        <div className="flex justify-between"><span>Gimbal AZ:</span> <span className="text-white">{formatAngle(st.gimbal?.az || 0)}</span></div>
        <div className="flex justify-between"><span>Gimbal EL:</span> <span className="text-white">{formatAngle(st.gimbal?.el || 0)}</span></div>
        <div className="flex justify-between"><span>Pointing Error:</span> <span className="text-white">{st.pointingError?.toFixed(1)} µrad</span></div>
      </div>

      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">OPTICAL LINK</div>
        <div className="flex justify-between"><span>Received Power:</span> <span className="text-white">{st.receivedPower?.toFixed(1)} dBm</span></div>
        <div className="flex justify-between"><span>SNR:</span> <span className="text-white">{st.snr?.toFixed(1)} dB</span></div>
        <div className="flex justify-between"><span>BER:</span> <span className="text-white">{st.ber?.toExponential(2)}</span></div>
        <div className="flex justify-between"><span>Link Margin:</span> <span className="text-white">{st.linkMargin?.toFixed(1)} dB</span></div>
        <div className="flex justify-between"><span>Data Rate:</span> <span className="text-white">{st.dataRateGbps?.toFixed(1)} Gbps</span></div>
      </div>

      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">DISTURBANCES</div>
        <div className="flex justify-between"><span>Atmospheric Turbulence:</span> <span className="text-white">{(d?.turbulence * 100 || 0).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Cloud Interference:</span> <span className="text-white">{(d?.cloudInterference * 100 || 0).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Satellite Vibration:</span> <span className="text-white">{(d?.vibration * 100 || 0).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Thermal Drift:</span> <span className="text-white">{(d?.thermalDrift * 100 || 0).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Space Dust:</span> <span className="text-white">{(d?.spaceDust * 100 || 0).toFixed(0)}%</span></div>
      </div>

      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">SYSTEM STATE</div>
        <div className="flex justify-between"><span>Current State:</span> <span className="text-white">{st.linkState}</span></div>
        <div className="flex justify-between"><span>Beacon Detection:</span> <span className="text-white">{st.losBlocked ? 'NO' : 'YES'}</span></div>
        <div className="flex justify-between"><span>Servo Active:</span> <span className="text-white">{st.servoActive ? 'YES' : 'NO'}</span></div>
        <div className="flex justify-between"><span>Auto Track:</span> <span className="text-white">{st.autoTrack ? 'ON' : 'OFF'}</span></div>
        <div className="flex justify-between"><span>Laser State:</span> <span className="text-white">{st.laserActive ? 'ON' : 'OFF'}</span></div>
      </div>
      
      <div>
        <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/20 pb-1">PERFORMANCE</div>
        <div className="flex justify-between"><span>FPS:</span> <span className="text-white">{frames}</span></div>
        <div className="flex justify-between"><span>Physics Tick:</span> <span className="text-white">16ms (60Hz)</span></div>
        <div className="flex justify-between"><span>Telemetry Update Rate:</span> <span className="text-white">500ms (2Hz)</span></div>
      </div>
    </div>
  );
}

function DynamicTopView() {
  const [st, setSt] = useState(engine.getState());
  useEffect(() => {
    const int = setInterval(() => setSt({...engine.getState()}), 100);
    return () => clearInterval(int);
  }, []);

  const A = st.satA.position;
  const B = st.satB.position;
  const rA = Math.sqrt(A.x*A.x + A.y*A.y + A.z*A.z);
  const rB = Math.sqrt(B.x*B.x + B.y*B.y + B.z*B.z);

  return (
    <div className="w-full">
      <div className="bg-[#101b33]/50 border border-[#1a365d] rounded p-2 overflow-hidden flex items-center justify-center">
        <svg viewBox="-9000 -9000 18000 18000" className="w-full max-h-48 drop-shadow-[0_0_15px_rgba(0,170,255,0.2)]">
          {/* Earth */}
          <circle cx="0" cy="0" r="6371" fill="#1e3a8a" opacity="0.6" stroke="#3b82f6" strokeWidth="50" />
          
          {/* Orbit Paths */}
          <circle cx="0" cy="0" r={rA} fill="none" stroke="#00aaff" strokeWidth="60" opacity="0.3" strokeDasharray="300, 300" />
          <ellipse cx="0" cy="0" rx={rB} ry={rB * 0.993} fill="none" stroke="#f97316" strokeWidth="60" opacity="0.3" strokeDasharray="300, 300" />
          
          {/* Laser connection */}
          {st.laserActive && !st.losBlocked && (
             <line x1={A.x} y1={A.z} x2={B.x} y2={B.z} stroke="#00ff66" strokeWidth="150" opacity="0.8" />
          )}
          {st.losBlocked && (
             <line x1={A.x} y1={A.z} x2={B.x} y2={B.z} stroke="#ff0055" strokeWidth="150" opacity="0.5" strokeDasharray="400, 400" />
          )}

          {/* Satellites */}
          <circle cx={A.x} cy={A.z} r="450" fill="#00aaff" stroke="#ffffff" strokeWidth="50" />
          <circle cx={B.x} cy={B.z} r="450" fill="#f97316" stroke="#ffffff" strokeWidth="50" />
        </svg>
      </div>
      <div className="flex justify-between mt-2 text-[9px] text-gray-400">
         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-aerospace-cyan" /> Satellite A</div>
         <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-orange-500" /> Satellite B</div>
      </div>
    </div>
  );
}

function PositionDebug({ constraintsRef }) {
  const [st, setSt] = useState(engine.getState());
  useEffect(() => {
    const int = setInterval(() => setSt({...engine.getState()}), 100);
    return () => clearInterval(int);
  }, []);

  const A = st.satA.position;
  const B = st.satB.position;

  return (
    <DraggablePanel title="POSITION DEBUG" initialStyle={{ left: 20, top: 180 }} width={200} constraintsRef={constraintsRef}>
      <div className="flex flex-col gap-3 text-[10px] font-mono text-gray-300">
        <div>
          <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/30">SAT A (WORLD)</div>
          <div className="flex justify-between"><span>X:</span> <span>{A.x.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Y:</span> <span>{A.y.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Z:</span> <span>{A.z.toFixed(2)}</span></div>
        </div>
        <div>
          <div className="text-orange-500 font-bold mb-1 border-b border-orange-500/30">SAT B (WORLD)</div>
          <div className="flex justify-between"><span>X:</span> <span>{B.x.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Y:</span> <span>{B.y.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>Z:</span> <span>{B.z.toFixed(2)}</span></div>
        </div>
        <div className="bg-white/5 p-1 rounded">
          <div className="text-white font-bold">3D DISTANCE (kinematics)</div>
          <div>{st.distance.toFixed(2)} km</div>
          <div className="text-white font-bold mt-1">3D DISTANCE (measured)</div>
          <div>{A.distanceTo(B).toFixed(2)} km</div>
        </div>
        <div>
          <div className="text-aerospace-cyan font-bold mb-1 border-b border-aerospace-cyan/30">TOP VIEW A (X, Z)</div>
          <div className="flex justify-between"><span>x:</span> <span>{A.x.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>y:</span> <span>{A.z.toFixed(2)}</span></div>
        </div>
        <div>
          <div className="text-orange-500 font-bold mb-1 border-b border-orange-500/30">TOP VIEW B (X, Z)</div>
          <div className="flex justify-between"><span>x:</span> <span>{B.x.toFixed(2)}</span></div>
          <div className="flex justify-between"><span>y:</span> <span>{B.z.toFixed(2)}</span></div>
        </div>
      </div>
    </DraggablePanel>
  );
}

function DisturbanceDiagnostics({ constraintsRef }) {
  const [st, setSt] = useState(engine.getState());
  useEffect(() => {
    const int = setInterval(() => setSt({...engine.getState()}), 100);
    return () => clearInterval(int);
  }, []);

  const d = st.effectiveDisturbances;
  if (!d) return null;
  
  const laserPower = st.laserActive ? Math.max(0, Math.min(100, (1.0 - st.diagnostics.totalLoss / 45) * 100)) : 0;
  const gimbalError = Math.sqrt(st.diagnostics.turbError**2 + st.diagnostics.thermalError**2 + st.diagnostics.vibError**2);

  return (
    <DraggablePanel title="DEBUG TEST" initialStyle={{ left: 240, top: 180 }} width={280} constraintsRef={constraintsRef}>
      <div className="flex flex-col gap-1 text-[11px] font-mono text-green-400">
        <div className="flex justify-between"><span>DISTANCE:</span> <span>{st.distance.toFixed(1)} km</span></div>
        <div className="flex justify-between"><span>LOS:</span> <span>{!st.losBlocked ? 'TRUE' : 'FALSE'}</span></div>
        <div className="flex justify-between"><span>TARGET AZ:</span> <span>{(st.gimbal.targetAz * 180 / Math.PI).toFixed(2)}°</span></div>
        <div className="flex justify-between"><span>TARGET EL:</span> <span>{(st.gimbal.targetEl * 180 / Math.PI).toFixed(2)}°</span></div>
        <div className="flex justify-between"><span>GIMBAL AZ:</span> <span>{(st.gimbal.az * 180 / Math.PI).toFixed(2)}°</span></div>
        <div className="flex justify-between"><span>GIMBAL EL:</span> <span>{(st.gimbal.el * 180 / Math.PI).toFixed(2)}°</span></div>
        <div className="flex justify-between"><span>POINTING ERROR:</span> <span>{st.pointingError.toFixed(1)} µrad</span></div>
        <div className="flex justify-between"><span>SERVO ACTIVE:</span> <span>{st.servoActive ? 'YES' : 'NO'}</span></div>
        <div className="flex justify-between"><span>AUTO TRACK:</span> <span>{st.autoTrack ? 'ON' : 'OFF'}</span></div>
        <div className="flex justify-between"><span>RECEIVED POWER:</span> <span>{st.receivedPower.toFixed(2)} dBm</span></div>
        <div className="flex justify-between"><span>SNR:</span> <span>{st.snr.toFixed(2)} dB</span></div>
        <div className="flex justify-between"><span>BER:</span> <span>{st.ber.toExponential(2)}</span></div>
        <div className="flex justify-between"><span>LINK MARGIN:</span> <span>{st.linkMargin.toFixed(2)} dB</span></div>
        <div className="flex justify-between mb-2"><span>DATA RATE:</span> <span>{st.dataRateGbps.toFixed(2)} Gbps</span></div>
        <div className="flex justify-between mb-2"><span>STATE:</span> <span>{st.linkState}</span></div>

        <div className="text-white border-b border-gray-600 mb-1 pb-1">DISTURBANCES</div>
        <div className="flex justify-between"><span>Turbulence:</span> <span>{(d.turbulence * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Cloud:</span> <span>{(d.cloudInterference * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Vibration:</span> <span>{(d.vibration * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between"><span>Thermal Drift:</span> <span>{(d.thermalDrift * 100).toFixed(0)}%</span></div>
        <div className="flex justify-between mb-2"><span>Space Dust:</span> <span>{(d.spaceDust * 100).toFixed(0)}%</span></div>

        <div className="text-white border-b border-gray-600 mb-1 pb-1">EFFECTS</div>
        <div className="flex justify-between"><span>DUST PARTICLES:</span> <span>{d.spaceDust > 0 ? (d.spaceDust > 0.5 ? 300 : 100) : 0}</span></div>
        <div className="flex justify-between"><span>DUST LOSS:</span> <span>{st.diagnostics.dustLoss.toFixed(1)} dB</span></div>
        <div className="flex justify-between"><span>THERMAL BIAS:</span> <span>{st.diagnostics.thermalError.toFixed(1)} µrad</span></div>
      </div>
    </DraggablePanel>
  );
}
