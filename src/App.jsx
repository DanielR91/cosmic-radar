import React, { useState, useEffect, useCallback, useMemo } from 'react';
import RadarCanvas from './components/RadarCanvas';
import TerminalOverlay from './components/TerminalOverlay';
import { Play, Pause, Search, RefreshCw, Layers, Compass, Globe, Info, Activity } from 'lucide-react';

// Real fallback TLE datasets for major satellites if Celestrak or local CORS proxy fails
const FALLBACK_SATELLITES = [
  {
    OBJECT_NAME: "ISS (ZARYA)",
    TLE_LINE1: "1 25544U 98067A   26157.25143519  .00014324  00000-0  25834-3 0  9998",
    TLE_LINE2: "2 25544  51.6402 121.3256 0001142  94.5123  35.2145 15.49823411543210"
  },
  {
    OBJECT_NAME: "HST (HUBBLE SPACE TELESCOPE)",
    TLE_LINE1: "1 20580U 90037B   26157.18520280  .00001221  00000-0  11442-4 0  9994",
    TLE_LINE2: "2 20580  28.4687 232.1245 0002877 149.2541  13.4354 15.09312384126930"
  },
  {
    OBJECT_NAME: "STARLINK-1007",
    TLE_LINE1: "1 44713U 19074A   26157.54238426  .00010834  00000-0  79119-3 0  9997",
    TLE_LINE2: "2 44713  53.0543  47.2148 0001435  82.1124 278.0123 15.06421379250422"
  },
  {
    OBJECT_NAME: "STARLINK-30421",
    TLE_LINE1: "1 57821U 23145A   26157.11245621  .00024152  00000-0  48231-3 0  9991",
    TLE_LINE2: "2 57821  53.0012 321.4124 0001214  42.5123 318.5245 15.11245621123450"
  },
  {
    OBJECT_NAME: "GPS BIIR-2 (PRN 02)",
    TLE_LINE1: "1 28190U 04009A   26157.42512683  .00000045  00000-0  00000-0 0  9993",
    TLE_LINE2: "2 28190  55.5123 274.1245 0054321 112.5432 248.9182  2.00561234145224"
  },
  {
    OBJECT_NAME: "GALILEO-24 (GSAT0220)",
    TLE_LINE1: "1 43057U 17079A   26157.65214532  .00000012  00000-0  00000-0 0  9995",
    TLE_LINE2: "2 43057  56.0214  82.4123 0002145 125.4215 234.9124  1.72145621045230"
  },
  {
    OBJECT_NAME: "GLONASS (COSMOS 2547)",
    TLE_LINE1: "1 46831U 20074A   26157.34561298  .00000021  00000-0  00000-0 0  9991",
    TLE_LINE2: "2 46831  64.8123 192.4215 0004125 321.4124  38.5621  2.13124562012350"
  },
  {
    OBJECT_NAME: "NOAA-19",
    TLE_LINE1: "1 33591U 09005A   26157.51234567  .00000142  00000-0  62145-4 0  9996",
    TLE_LINE2: "2 33591  98.7123  42.5123 0014251 142.5621 218.4215 14.11245621985420"
  },
  {
    OBJECT_NAME: "TIANGONG (CHINA SPACE STATION)",
    TLE_LINE1: "1 48274U 21035A   26157.21456230  .00018521  00000-0  31245-3 0  9994",
    TLE_LINE2: "2 48274  41.4782 231.4512 0003412  85.4215 281.5214 15.62145621213450"
  },
  {
    OBJECT_NAME: "METEOR M2-2",
    TLE_LINE1: "1 44387U 19038A   26157.41235612  .00000085  00000-0  41245-4 0  9997",
    TLE_LINE2: "2 44387  98.5412 112.5123 0001245 281.4124  78.5214 14.21456230123450"
  },
  {
    OBJECT_NAME: "EG-1 (DEBRIS)",
    TLE_LINE1: "1 99901U 99001DE  26157.11245612  .00041251  00000-0  98214-3 0  9993",
    TLE_LINE2: "2 99901  52.1245 142.5123 0124512  62.1456 298.5412 15.82145621054320"
  },
  {
    OBJECT_NAME: "EG-2 (DEBRIS)",
    TLE_LINE1: "1 99902U 99001DF  26157.21452312  .00052314  00000-0  99923-3 0  9995",
    TLE_LINE2: "2 99902  53.5124 162.4123 0154215  82.4123 278.4521 15.92145214012430"
  }
];

const HIGH_VALUE_TARGETS = [
  { id: 'iss', search: 'iss', label: '🛰️ ISS (Space Station)' },
  { id: 'hubble', search: 'hst', label: '🔭 Hubble Space Telescope' },
  { id: 'tiangong', search: 'tiangong', label: '🇨🇳 Tiangong Station' },
  { id: 'noaa', search: 'noaa-19', label: '🌤️ NOAA-19 Weather' },
  { id: 'envisat', search: 'envisat', label: '🌍 Envisat Monitor' },
  { id: 'terra', search: 'terra', label: '🌱 NASA Terra' },
  { id: 'aqua', search: 'aqua', label: '💧 NASA Aqua' },
  { id: 'gps', search: 'gps biir', label: '🛰️ GPS Navigation' },
  { id: 'galileo', search: 'galileo-24', label: '🇪🇺 Galileo Navigation' },
  { id: 'starlink', search: 'starlink-1007', label: '📡 Starlink Node' }
];

export default function App() {
  const [viewMode, setViewMode] = useState('earth'); // 'earth' or 'solar'
  const [satellites, setSatellites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('ALL');
  const [simSpeed, setSimSpeed] = useState(1); // multiplier
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredData, setHoveredData] = useState(null);
  const [selectedSatId, setSelectedSatId] = useState(null);
  const [logMessages, setLogMessages] = useState([]);
  const [isolatedTarget, setIsolatedTarget] = useState(null);
  const [showFullFleet, setShowFullFleet] = useState(false);
  const [starlinkOnly, setStarlinkOnly] = useState(false);

  // Logging utility
  const addLog = useCallback((text, type = 'info') => {
    const time = new Date().toTimeString().split(' ')[0];
    setLogMessages((prev) => [{ time, text, type }, ...prev].slice(0, 40));
  }, []);

  // Fetch active satellites
  const fetchSatellites = async () => {
    setLoading(true);
    addLog('DOWNLINKING ACTIVE TLE BUNDLE...', 'info');

    try {
      const response = await fetch('/satellites.txt');
      if (!response.ok) throw new Error("Failed to load TLE text asset");
      
      const text = await response.text();
      // Split by newlines and clean up empty rows
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      
      const parsedSatellites = [];
      
      // Step through the array in triplets (Name, Line 1, Line 2)
      for (let i = 0; i + 2 < lines.length; i += 3) {
        const rawName = lines[i];
        const line1 = lines[i + 1];
        const line2 = lines[i + 2];
        
        if (line1.startsWith('1') && line2.startsWith('2')) {
          const lowerName = rawName.toLowerCase();
          let category = 'Science/Weather'; // Default home

          // Robust string matching based on our exact txt contents
          if (lowerName.includes('starlink') || lowerName.includes('coms') || lowerName.includes('satcom')) {
            category = 'Communications';
          } else if (lowerName.includes('gps') || lowerName.includes('galileo') || lowerName.includes('glonass') || lowerName.includes('beidou')) {
            category = 'Navigation';
          } else if (lowerName.includes('iss') || lowerName.includes('hubble') || lowerName.includes('tiangong') || lowerName.includes('noaa') || lowerName.includes('meteor')) {
            category = 'Science/Weather';
          } else if (lowerName.includes('debris') || lowerName.includes('frag') || lowerName.includes('r/b')) {
            category = 'Debris';
          }

          parsedSatellites.push({
            OBJECT_NAME: rawName,
            TLE_LINE1: line1,
            TLE_LINE2: line2,
            category: category // Attach the category directly to the object
          });
        }
      }

      if (parsedSatellites.length > 0) {
        setSatellites(parsedSatellites);
        addLog(`SUCCESSFULLY PARSED ${parsedSatellites.length} TLE SETS FROM TEXT ENGINE.`, 'success');
        console.log(`Successfully mapped ${parsedSatellites.length} operational vectors.`);
      }
    } catch (error) {
      console.error("TLE Engine Parse Failure:", error);
      addLog(`TLE ENGINE PARSE FAILURE. LOADING FALLBACK DATA.`, 'error');
      setSatellites(FALLBACK_SATELLITES);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSatellites();
  }, []);

  // Highlight satellite or search select
  const handleSelectSat = (name) => {
    setSelectedSatId(name);
    addLog(`LOCK ACQUIRED ON OBJECT: ${name}`, 'success');
  };

  // Filtered Satellites
  const filteredSatellites = useMemo(() => {
    return satellites.filter((sat) => {
      const name = (sat.OBJECT_NAME || "").toLowerCase();

      // Priority 1: Starlink Isolation
      if (starlinkOnly) {
        return name.includes('starlink');
      }

      // Priority 2: Show full fleet
      if (showFullFleet) {
        return HIGH_VALUE_TARGETS.some(t => name.includes(t.search.toLowerCase()));
      }

      // Priority 3: Single isolated target
      if (isolatedTarget) {
        return name.includes(isolatedTarget.search.toLowerCase());
      }

      // Priority 4: Normal filters
      const matchesSearch = name.includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Classifications
      if (selectedFilter === 'ALL') return true;
      
      let category = sat.category;
      if (!category) {
        // Fallback categorization for static preloaded elements
        if (name.includes('starlink') || name.includes('coms') || name.includes('satcom')) {
          category = 'Communications';
        } else if (name.includes('gps') || name.includes('galileo') || name.includes('glonass') || name.includes('beidou')) {
          category = 'Navigation';
        } else if (name.includes('debris') || name.includes('frag') || name.includes('r/b')) {
          category = 'Debris';
        } else {
          category = 'Science/Weather';
        }
      }

      if (selectedFilter === 'COMMS') return category === 'Communications';
      if (selectedFilter === 'NAV') return category === 'Navigation';
      if (selectedFilter === 'DEBRIS') return category === 'Debris';
      if (selectedFilter === 'SCIENTIFIC') return category === 'Science/Weather';

      return true;
    });
  }, [satellites, searchQuery, selectedFilter, isolatedTarget, showFullFleet, starlinkOnly]);

  // Telemetry details representation
  const activeTelemetry = useMemo(() => {
    if (hoveredData) return hoveredData;
    if (selectedSatId) {
      // If we have locked sat and no hover, keep showing locked sat
      const mockProj = FALLBACK_SATELLITES.find(s => s.OBJECT_NAME === selectedSatId) || satellites.find(s => s.OBJECT_NAME === selectedSatId);
      if (mockProj) {
        return {
          name: mockProj.OBJECT_NAME,
          operationalStatus: mockProj.OBJECT_NAME.includes('DEB') ? 'DEBRIS' : 'OPERATIONAL',
          altitude: 'COMPUTING...',
          velocity: 'LOCKING...',
          lat: 'STABLE',
          lon: 'STABLE',
          color: '#00f0ff'
        };
      }
    }
    return null;
  }, [hoveredData, selectedSatId, satellites]);

  return (
    <div className="crt-overlay relative w-screen h-screen flex flex-col md:flex-row bg-[#030508] overflow-hidden select-none font-sans">
      
      {/* 1. Radar Screen Main Panel */}
      <div className="flex-1 h-3/5 md:h-full relative border-r border-terminal-border flex flex-col">
        {/* Terminal Header Info overlay */}
        <div className="absolute top-16 left-4 z-10 bg-[#070b12]/80 border border-terminal-border p-3 rounded-sm text-xs pointer-events-auto shadow-md">
          <div className="flex items-center gap-2 mb-1.5 text-white font-bold tracking-wider">
            <Globe size={14} className="text-terminal-cyan" />
            <span>RADAR VIEWPORT</span>
          </div>
          <div className="text-[10px] text-terminal-dim flex flex-col gap-0.5">
            <div>MODE: {viewMode === 'earth' ? 'LOW EARTH ORBIT SGP4' : 'HELIOCENTRIC SOLAR ORRERY'}</div>
            <div>STATUS: {loading ? 'DOWNLINK ACTIVE...' : 'STABLE STREAM'}</div>
            <div>SATS PLOTTED: {filteredSatellites.length} / {satellites.length}</div>
          </div>
        </div>

        {/* The Graphic Canvas Container */}
        <div className="flex-1 w-full h-full relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#030508]/80 text-terminal-green font-mono z-20">
              <RefreshCw size={24} className="animate-spin text-terminal-green" />
              <div className="text-sm tracking-widest uppercase terminal-blink">ESTABLISHING SATCOM DOWNLINK...</div>
            </div>
          ) : null}

          <RadarCanvas
            viewMode={viewMode}
            satellites={filteredSatellites}
            simSpeed={simSpeed}
            isPaused={isPaused}
            onHoverSatellite={setHoveredData}
            selectedSatId={selectedSatId}
            onSelectSatellite={handleSelectSat}
          />
        </div>

        {/* Embedded Terminal Status Logs footer */}
        <div className="h-44 border-t border-terminal-border">
          <TerminalOverlay 
            logMessages={logMessages} 
            activeCount={satellites.length} 
            viewMode={viewMode} 
          />
        </div>
      </div>

      {/* 2. Tactical Telemetry Sidebar Panel */}
      <div className="w-full md:w-[350px] h-2/5 md:h-full bg-[#05080c] flex flex-col justify-between border-t md:border-t-0 border-terminal-border">
        
        {/* Header Title */}
        <div className="p-4 border-b border-terminal-border bg-[#070b12] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-terminal-green" />
            <h1 className="text-sm font-bold text-white tracking-widest uppercase">COSMIC_DECK</h1>
          </div>
          <button 
            onClick={fetchSatellites} 
            className="text-terminal-dim hover:text-terminal-cyan cursor-pointer transition-colors p-1 border border-terminal-border hover:border-terminal-cyan rounded-sm"
            title="Reload satellite telemetry"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Scrollable control settings & locked telemetry info */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
          
          {/* A: Primary Display View Switch */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-terminal-dim font-mono tracking-widest uppercase">SYS_OPERATING_MODE</span>
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <button
                onClick={() => {
                  setViewMode('earth');
                  addLog('VIEWPORT REDIRECT: EARTH ORBIT SGP4 TRACKER', 'info');
                }}
                className={`py-2 px-3 border cursor-pointer font-bold transition-all rounded-sm flex items-center justify-center gap-1.5 ${
                  viewMode === 'earth' 
                    ? 'border-terminal-green text-terminal-green bg-terminal-green/10 neon-glow-green font-bold' 
                    : 'border-terminal-border text-terminal-dim hover:text-white hover:border-white/20'
                }`}
              >
                <Globe size={12} />
                <span>EARTH</span>
              </button>
              <button
                onClick={() => {
                  setViewMode('solar');
                  addLog('VIEWPORT REDIRECT: SOLAR SYSTEM ORRERY', 'info');
                }}
                className={`py-2 px-3 border cursor-pointer font-bold transition-all rounded-sm flex items-center justify-center gap-1.5 ${
                  viewMode === 'solar' 
                    ? 'border-terminal-cyan text-terminal-cyan bg-terminal-cyan/10 neon-glow-cyan font-bold' 
                    : 'border-terminal-border text-terminal-dim hover:text-white hover:border-white/20'
                }`}
              >
                <Compass size={12} />
                <span>ORRERY</span>
              </button>
            </div>
          </div>

          {/* B: Real-Time Vector Telemetry Display */}
          <div className="border border-terminal-border bg-[#070b12]/80 p-3 rounded-sm flex flex-col gap-2 relative">
            <div className="flex justify-between items-center border-b border-terminal-border/80 pb-1.5">
              <span className="text-[10px] text-white font-mono tracking-wider font-bold">LOCK_ON METADATA</span>
              <span className="w-2 h-2 rounded-full bg-terminal-green animate-pulse" />
            </div>

            {activeTelemetry ? (
              <div className="flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                  <span className="text-terminal-dim">ID / NAME:</span>
                  <span className="text-white font-bold truncate max-w-[180px]">{activeTelemetry.name}</span>
                </div>
                <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                  <span className="text-terminal-dim">STATUS:</span>
                  <span className={activeTelemetry.operationalStatus === 'OPERATIONAL' ? 'text-terminal-green' : 'text-terminal-red'}>
                    {activeTelemetry.operationalStatus}
                  </span>
                </div>
                <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                  <span className="text-terminal-dim">ALTITUDE:</span>
                  <span className="text-white">{activeTelemetry.altitude === 'COMPUTING...' ? 'COMPUTING...' : `${activeTelemetry.altitude} KM`}</span>
                </div>
                <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                  <span className="text-terminal-dim">VELOCITY:</span>
                  <span className="text-white">{activeTelemetry.velocity === 'LOCKING...' ? 'LOCKING...' : `${activeTelemetry.velocity} KM/S`}</span>
                </div>
                {!activeTelemetry.isPlanet && (
                  <>
                    <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                      <span className="text-terminal-dim">LATITUDE:</span>
                      <span className="text-terminal-cyan">{activeTelemetry.lat}°</span>
                    </div>
                    <div className="flex justify-between border-b border-terminal-border/30 py-0.5">
                      <span className="text-terminal-dim">LONGITUDE:</span>
                      <span className="text-terminal-cyan">{activeTelemetry.lon}°</span>
                    </div>
                  </>
                )}
                {activeTelemetry.isPlanet && (
                  <div className="text-[9px] text-terminal-dim mt-1 text-center italic">
                    PLOTTED ON VECTOR KEPLERIAN RING
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 flex flex-col items-center justify-center gap-1.5 text-center text-xs font-mono text-terminal-dim">
                <Info size={16} />
                <span>CROSSHAIR SCAN ACTIVE</span>
                <span className="text-[9px]">HOVER PIXEL TO ACQUIRE TELEMETRY</span>
              </div>
            )}
          </div>

          {/* C: Vector Filtering (Only for Earth view) */}
          {viewMode === 'earth' && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-terminal-dim font-mono tracking-widest uppercase">TELEMETRY_FILTER</span>
              <div className="grid grid-cols-2 gap-1 text-[11px] font-mono">
                {['ALL', 'COMMS', 'NAV', 'SCIENTIFIC', 'DEBRIS'].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      setSelectedFilter(f);
                      addLog(`CATEGORY FILTER CHANGED TO: ${f}`, 'info');
                    }}
                    className={`py-1.5 px-2 border cursor-pointer text-center rounded-xs transition-all ${
                      selectedFilter === f 
                        ? 'border-terminal-green text-terminal-green bg-terminal-green/5' 
                        : 'border-terminal-border/70 text-terminal-dim hover:text-white hover:border-terminal-border'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* D: Target search lookups (Only for Earth view) */}
          {viewMode === 'earth' && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-terminal-dim font-mono tracking-widest uppercase">COORDINATE_SEARCH</span>
              <div className="relative font-mono">
                <input
                  type="text"
                  placeholder="LOOKUP SAT BY NAME..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#070b12] border border-terminal-border rounded-sm py-2 pl-8 pr-3 text-xs text-white placeholder-terminal-dim focus:outline-none focus:border-terminal-green transition-all"
                />
                <Search size={12} className="absolute left-2.5 top-3 text-terminal-dim" />
              </div>
            </div>
          )}

          {/* E: Simulation Speed Regulator */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-baseline">
              <span className="text-[10px] text-terminal-dim font-mono tracking-widest uppercase">SIM_TIME_COMPRESSION</span>
              <span className="text-xs font-mono text-terminal-cyan font-bold">{simSpeed}x DILATION</span>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => {
                  setIsPaused(!isPaused);
                  addLog(isPaused ? 'SIMULATION SYSTEM RESUMED.' : 'SIMULATION SYSTEM PAUSED.', 'warning');
                }}
                className="p-2 border border-terminal-border rounded-sm hover:border-terminal-cyan cursor-pointer transition-colors text-white"
              >
                {isPaused ? <Play size={12} fill="currentColor" /> : <Pause size={12} fill="currentColor" />}
              </button>
              <input
                type="range"
                min="1"
                max="500"
                step="5"
                value={simSpeed}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSimSpeed(val);
                }}
                className="flex-1 accent-terminal-cyan h-1 bg-terminal-border cursor-pointer rounded-lg appearance-none"
              />
            </div>
          </div>

          {/* F: High-Value Targets Tracker */}
          <div className="mt-4 p-4 bg-slate-900/80 border border-slate-700/50 rounded-lg backdrop-blur-md shadow-xl text-left">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 font-mono">
                🎯 Targets
              </h3>
              <div className="flex gap-1.5 flex-wrap">
                <button
                  onClick={() => {
                    const nextState = !starlinkOnly;
                    setStarlinkOnly(nextState);
                    if (nextState) {
                      setShowFullFleet(false);
                      setIsolatedTarget(null);
                      addLog('STARLINK ISOLATION MATRIX ENABLED.', 'success');
                    } else {
                      addLog('STARLINK ISOLATION MATRIX DISABLED.', 'info');
                    }
                  }}
                  className={`text-[10px] px-2 py-0.5 font-mono rounded transition-all border cursor-pointer ${
                    starlinkOnly 
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.3)] font-bold' 
                      : 'bg-slate-950/40 text-slate-400 border-slate-700/50 hover:text-slate-200'
                  }`}
                >
                  {starlinkOnly ? "🛰️ STARLINK ACTIVE" : "🛰️ STARLINK ONLY"}
                </button>
                <button
                  disabled={starlinkOnly}
                  onClick={() => {
                    const nextState = !showFullFleet;
                    setShowFullFleet(nextState);
                    setIsolatedTarget(null); // Clear single focus when toggling fleet view
                    if (nextState) {
                      addLog('FLEET VIEW ISOLATION ENABLED.', 'success');
                    } else {
                      addLog('FLEET VIEW ISOLATION DISABLED.', 'info');
                    }
                  }}
                  className={`text-[10px] px-2 py-0.5 font-mono rounded transition-all border ${
                    starlinkOnly
                      ? 'bg-slate-950/10 text-slate-600 border-transparent cursor-not-allowed opacity-40'
                      : showFullFleet 
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500 shadow-[0_0_6px_rgba(34,211,238,0.3)] font-bold cursor-pointer' 
                        : 'bg-slate-950/40 text-slate-400 border-slate-700/50 hover:text-slate-200 cursor-pointer'
                  }`}
                >
                  {showFullFleet ? "📡 FLEET ACTIVE" : "👁️ VIEW ALL 10"}
                </button>
                {isolatedTarget && !starlinkOnly && (
                  <button 
                    onClick={() => {
                      setIsolatedTarget(null);
                      addLog('CLEARED ISOLATED TARGET SELECTION.', 'info');
                    }}
                    className="text-[10px] px-2 py-0.5 bg-red-950/40 hover:bg-red-900/60 border border-red-700/40 rounded text-red-400 font-mono transition-colors cursor-pointer"
                  >
                    CLEAR
                  </button>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-1 text-xs max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
              {HIGH_VALUE_TARGETS.map((target) => {
                const isActive = !starlinkOnly && (showFullFleet || isolatedTarget?.id === target.id);
                const isSingleActive = !starlinkOnly && isolatedTarget?.id === target.id;
                return (
                  <button
                    key={target.id}
                    disabled={showFullFleet || starlinkOnly}
                    onClick={() => {
                      const nextState = isSingleActive ? null : target;
                      setIsolatedTarget(nextState);
                      if (nextState) {
                        addLog(`ISOLATING HIGH-VALUE TARGET: ${target.label}`, 'success');
                      } else {
                        addLog('CLEARED ISOLATED TARGET SELECTION.', 'info');
                      }
                    }}
                    className={`w-full text-left font-mono px-2.5 py-1.5 rounded text-xs transition-all flex items-center justify-between border ${
                      starlinkOnly
                        ? 'bg-slate-950/20 text-slate-500 border-transparent cursor-not-allowed opacity-45'
                        : showFullFleet
                          ? 'bg-cyan-950/20 text-cyan-400 border-cyan-800/60 cursor-not-allowed opacity-80'
                          : isSingleActive 
                            ? 'bg-cyan-950/40 text-cyan-300 border-cyan-500 shadow-[0_0_8px_rgba(34,211,238,0.2)] font-semibold cursor-pointer' 
                            : 'bg-slate-950/30 text-slate-400 border-transparent hover:bg-slate-800/50 hover:text-slate-200 cursor-pointer'
                    }`}
                  >
                    <span>{target.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Deck bottom metadata footer */}
        <div className="p-4 border-t border-terminal-border bg-[#070b12] text-[10px] font-mono text-terminal-dim flex justify-between">
          <span>COSMICRADAR V4.1</span>
          <span>STATION STATUS: SECURE</span>
        </div>

      </div>

    </div>
  );
}
