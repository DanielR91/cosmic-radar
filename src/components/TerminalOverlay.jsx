import React, { useEffect, useState } from 'react';
import { Terminal, Shield, Wifi, Radio, Cpu } from 'lucide-react';

export default function TerminalOverlay({ logMessages, activeCount, viewMode }) {
  const [diagnostics, setDiagnostics] = useState({
    coreTemp: 32.5,
    cpuUsage: 12,
    memUsage: 45.2,
    downlinkRate: 142.4
  });

  // Small background variations in systems diagnostics to make it look active/alive
  useEffect(() => {
    const interval = setInterval(() => {
      setDiagnostics({
        coreTemp: parseFloat((32.0 + Math.random() * 2.5).toFixed(1)),
        cpuUsage: Math.floor(8 + Math.random() * 15),
        memUsage: parseFloat((45.0 + Math.random() * 0.8).toFixed(2)),
        downlinkRate: parseFloat((135.0 + Math.random() * 18.2).toFixed(1))
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full pointer-events-none select-none font-mono">
      {/* Top Banner Ticker */}
      <div className="flex justify-between items-center bg-[#070b12]/90 border-b border-terminal-border px-4 py-2 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-terminal-green terminal-blink neon-glow-green" />
          <span className="font-bold text-sm tracking-widest text-white">COSMICRADAR // MAIN_TERMINAL</span>
        </div>
        <div className="flex items-center gap-6 text-[11px]">
          <div className="flex items-center gap-1.5 text-terminal-green">
            <Radio size={12} className="terminal-blink" />
            <span>DOWNLINK: {diagnostics.downlinkRate} KB/S</span>
          </div>
          <div className="flex items-center gap-1.5 text-terminal-cyan">
            <Cpu size={12} />
            <span>SYS CORE TEMP: {diagnostics.coreTemp}°C</span>
          </div>
          <div className="text-terminal-dim hidden sm:block">SECURE SHIELD PROT: ON</div>
        </div>
      </div>

      {/* Main console layout */}
      <div className="flex-1 flex flex-col justify-between p-4 overflow-hidden">
        
        {/* Subsystem status matrices */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pointer-events-auto">
          <div className="bg-[#070b12]/85 border border-terminal-border p-3 flex flex-col gap-1 rounded-sm">
            <span className="text-[10px] text-terminal-dim">TELEMETRY SOURCES</span>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-xl text-white font-bold">{activeCount}</span>
              <span className="text-[10px] text-terminal-green">CELESTRAK JSON</span>
            </div>
            <div className="w-full bg-[#142834]/40 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-terminal-green h-full w-[85%]" />
            </div>
          </div>

          <div className="bg-[#070b12]/85 border border-terminal-border p-3 flex flex-col gap-1 rounded-sm">
            <span className="text-[10px] text-terminal-dim">SGP4 PROPAGATOR</span>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-xl text-terminal-cyan font-bold">ACTIVE</span>
              <span className="text-[10px] text-terminal-cyan">SOLVER: OK</span>
            </div>
            <div className="w-full bg-[#142834]/40 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-terminal-cyan h-full w-[95%]" />
            </div>
          </div>

          <div className="bg-[#070b12]/85 border border-terminal-border p-3 flex flex-col gap-1 rounded-sm">
            <span className="text-[10px] text-terminal-dim">SYSTEM LOAD</span>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-xl text-white font-bold">{diagnostics.cpuUsage}%</span>
              <span className="text-[10px] text-terminal-dim">RAM: {diagnostics.memUsage}%</span>
            </div>
            <div className="w-full bg-[#142834]/40 h-1 mt-2 rounded-full overflow-hidden">
              <div 
                className="bg-terminal-green h-full transition-all duration-1000" 
                style={{ width: `${diagnostics.cpuUsage * 2}%` }}
              />
            </div>
          </div>

          <div className="bg-[#070b12]/85 border border-terminal-border p-3 flex flex-col gap-1 rounded-sm">
            <span className="text-[10px] text-terminal-dim">OPERATING MODE</span>
            <div className="flex justify-between items-baseline mt-1">
              <span className="text-sm text-terminal-yellow font-bold uppercase tracking-wider">
                {viewMode === 'earth' ? 'GEO TRACKER' : 'ORRERY SIM'}
              </span>
              <span className="text-[10px] text-terminal-yellow">VECTOR: ON</span>
            </div>
            <div className="w-full bg-[#142834]/40 h-1 mt-2 rounded-full overflow-hidden">
              <div className="bg-terminal-yellow h-full w-full" />
            </div>
          </div>
        </div>

        {/* Floating tactical coordinates grid (bottom layout) */}
        <div className="flex justify-between items-end mt-4">
          
          {/* Neon terminal logging feed */}
          <div className="w-full max-w-md bg-[#070b12]/90 border border-terminal-border p-3 rounded-sm pointer-events-auto shadow-xl">
            <div className="flex items-center gap-2 border-b border-terminal-border pb-1.5 mb-2">
              <Terminal size={12} className="text-terminal-green" />
              <span className="text-[11px] font-bold text-white tracking-widest uppercase">TACTICAL LOG_FEED</span>
            </div>
            <div className="h-24 overflow-y-auto flex flex-col gap-1 text-[11px] leading-tight select-text scrollbar-thin">
              {logMessages.map((msg, index) => (
                <div key={index} className="flex gap-2">
                  <span className="text-terminal-dim">[{msg.time}]</span>
                  <span className={
                    msg.type === 'error' ? 'text-terminal-red' : 
                    msg.type === 'warning' ? 'text-terminal-yellow' : 
                    msg.type === 'success' ? 'text-terminal-green' : 'text-terminal-cyan'
                  }>
                    {msg.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Simple Vector Compass Graph */}
          <div className="hidden sm:flex flex-col items-center gap-1.5 bg-[#070b12]/80 border border-terminal-border p-3 rounded-sm pointer-events-auto">
            <div className="relative w-16 h-16 rounded-full border border-terminal-border flex items-center justify-center">
              <div className="absolute w-full h-[1px] bg-terminal-border/60" />
              <div className="absolute h-full w-[1px] bg-terminal-border/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-terminal-cyan" />
              {/* Rotating radar sweeping line */}
              <div className="absolute w-8 h-[1.5px] bg-terminal-green origin-left left-1/2 top-1/2 animate-[spin_4s_linear_infinite]" />
            </div>
            <span className="text-[9px] text-terminal-dim">AZIMUTH DETECTOR</span>
          </div>

        </div>
      </div>
    </div>
  );
}
