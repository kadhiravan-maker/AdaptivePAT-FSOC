import React from 'react';
import { Box, Globe, ArrowRight, ShieldAlert } from 'lucide-react';

export default function Home({ onNavigate }) {
  return (
    <div className="w-screen h-screen bg-[#020305] text-white flex flex-col items-center justify-center p-8 overflow-hidden relative">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
        <div className="absolute top-[20%] left-[20%] w-[40vw] h-[40vw] bg-cyan-900 rounded-full blur-[100px]" />
        <div className="absolute bottom-[20%] right-[20%] w-[40vw] h-[40vw] bg-blue-900 rounded-full blur-[100px]" />
      </div>

      <div className="z-10 flex flex-col items-center mb-16">
        <div className="w-20 h-20 bg-cyan-900/30 rounded-2xl flex items-center justify-center border-2 border-cyan-500 shadow-[0_0_30px_rgba(0,170,255,0.4)] mb-6">
          <Box className="text-cyan-400" size={40} />
        </div>
        <h1 className="text-4xl font-bold tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 mb-2 text-center">
          FSOC 3D SIMULATOR
        </h1>
        <p className="text-gray-400 tracking-widest text-sm text-center">FREE SPACE OPTICAL COMMUNICATION PLATFORM</p>
      </div>

      <div className="z-10 flex flex-col md:flex-row gap-8 w-full max-w-4xl">
        {/* Card 1: Main Simulation */}
        <div 
          onClick={() => onNavigate('/simulation')}
          className="flex-1 bg-black/40 backdrop-blur-xl border border-gray-700 hover:border-cyan-500 rounded-xl p-8 cursor-pointer group transition-all hover:bg-[#0a1526] hover:shadow-[0_0_40px_rgba(0,170,255,0.15)] hover:-translate-y-2"
        >
          <div className="w-12 h-12 bg-blue-900/30 rounded-lg flex items-center justify-center border border-blue-500/50 mb-6 group-hover:bg-blue-500/20 group-hover:border-blue-400 transition-colors">
            <Globe className="text-blue-400" size={24} />
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-wider group-hover:text-cyan-400 transition-colors">MAIN SIMULATION</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            The core FSOC physics engine. Real-time telemetry, auto-tracking gimbal simulation, dynamic link budget analysis, and orbital visualization.
          </p>
          <div className="flex items-center gap-2 text-cyan-500 text-sm font-bold tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
            LAUNCH <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </div>

        {/* Card 2: Scenario Lab */}
        <div 
          onClick={() => onNavigate('/scenarios')}
          className="flex-1 bg-black/40 backdrop-blur-xl border border-gray-700 hover:border-orange-500 rounded-xl p-8 cursor-pointer group transition-all hover:bg-[#1a0f0a] hover:shadow-[0_0_40px_rgba(255,100,0,0.15)] hover:-translate-y-2"
        >
          <div className="w-12 h-12 bg-orange-900/30 rounded-lg flex items-center justify-center border border-orange-500/50 mb-6 group-hover:bg-orange-500/20 group-hover:border-orange-400 transition-colors">
            <ShieldAlert className="text-orange-400" size={24} />
          </div>
          <h2 className="text-2xl font-bold mb-3 tracking-wider group-hover:text-orange-400 transition-colors">SCENARIO LAB</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-8">
            Test the communication link under extreme conditions. Introduce asteroid obstructions, thick space dust clouds, and utilize the LiDAR detection system.
          </p>
          <div className="flex items-center gap-2 text-orange-500 text-sm font-bold tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">
            LAUNCH <ArrowRight size={16} className="group-hover:translate-x-2 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
}
