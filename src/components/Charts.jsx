import React, { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip
} from 'recharts';
import { engine } from '../simulation/physicsEngine';

const ChartWrapper = React.memo(({ title, value, subValue, status, statusColor, unit, color, dataKey, domain, yAxisTicks, data }) => (
  <div className="glass-panel flex flex-col h-full relative overflow-hidden">
    <div className="px-3 pt-2 pb-1 border-b border-aerospace-border/50 flex justify-between items-center">
      <h4 className="text-[11px] text-gray-300 font-medium">{title}</h4>
      {status && <span className="text-[8px] font-bold tracking-wider" style={{ color: statusColor }}>{status}</span>}
    </div>
    <div className="px-3 py-1 flex items-end justify-between">
      <div className="text-xl font-bold font-mono" style={{ color }}>
        {value} <span className="text-sm font-sans">{unit}</span>
      </div>
      {subValue && <div className="text-[10px] text-gray-400 font-mono mb-1">{subValue}</div>}
    </div>
    <div className="flex-1 -ml-6 -mb-2 -mr-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a365d" vertical={false} />
          <XAxis dataKey="time" hide />
          <YAxis domain={domain} ticks={yAxisTicks} stroke="#4b5563" fontSize={9} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0b1426', borderColor: '#1a365d', fontSize: '12px' }}
            itemStyle={{ color: color }}
          />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>
));

const ChartsComponent = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    const interval = setInterval(() => {
      const state = engine.getState();
      const now = new Date();
      
      setData(prev => {
        const next = [...prev, {
          time: now.toLocaleTimeString([], { hour12: false, second: '2-digit', fractionalSecondDigits: 1 }),
          power: parseFloat(state.receivedPower.toFixed(2)),
          snr: parseFloat(state.snr.toFixed(2)),
          berLog: state.ber === 0 ? -12 : Math.max(-12, Math.log10(state.ber)),
          pointingError: parseFloat(state.pointingError.toFixed(2))
        }];
        if (next.length > 100) next.shift();
        return next;
      });
    }, 200);
    return () => clearInterval(interval);
  }, []);

  const lastData = data[data.length - 1] || { power: -120, snr: 0, berLog: 0, pointingError: 0 };
  const formatBer = (berLog) => {
    const pow = Math.pow(10, berLog);
    return pow.toExponential(1).replace('e', ' x 10').replace('+', '');
  };

  const getPowerInfo = (dbm) => {
    if (dbm <= -100) return { subValue: '0.0 nW', status: 'NO RECEIVED SIGNAL', color: '#6b7280' };
    const nw = Math.pow(10, dbm / 10) * 1e6;
    let subValue = `≈ ${nw > 1000 ? (nw/1000).toFixed(1) + ' µW' : nw.toFixed(1) + ' nW'}`;
    if (dbm < -60) return { subValue, status: 'WEAK SIGNAL', color: '#f59e0b' };
    return { subValue, status: 'VALID RECEIVED SIGNAL', color: '#10b981' };
  };
  const pwrInfo = getPowerInfo(lastData.power);

  return (
    <div className="grid grid-cols-4 gap-3 h-40 w-full pointer-events-auto">
      <ChartWrapper 
        title="Received Power" 
        value={lastData.power.toFixed(1)} unit="dBm" 
        subValue={pwrInfo.subValue}
        status={pwrInfo.status}
        statusColor={pwrInfo.color}
        color="#ff0055" dataKey="power" domain={[-120, 0]} 
        yAxisTicks={[-120, -90, -60, -30, 0]}
        data={data}
      />
      <ChartWrapper 
        title="SNR (dB)" 
        value={lastData.snr.toFixed(1)} unit="dB" 
        color="#00aaff" dataKey="snr" domain={[0, 40]} 
        yAxisTicks={[0, 10, 20, 30, 40]}
        data={data}
      />
      <ChartWrapper 
        title="BER" 
        value={formatBer(lastData.berLog)} unit="" 
        color="#00ff66" dataKey="berLog" domain={[-12, 0]} 
        yAxisTicks={[-12, -10, -8, -6, -4]}
        data={data}
      />
      <ChartWrapper 
        title="Pointing Error (µrad)" 
        value={lastData.pointingError.toFixed(1)} unit="µrad" 
        color="#b000ff" dataKey="pointingError" domain={[0, 10]} 
        yAxisTicks={[0, 2, 4, 6, 8, 10]}
        data={data}
      />
    </div>
  );
};

export const Charts = React.memo(ChartsComponent);
