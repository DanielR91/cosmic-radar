import React, { useRef, useEffect, useState } from 'react';
import { twoline2satrec } from '../../node_modules/satellite.js/dist/io.js';
import { propagate, gstime } from '../../node_modules/satellite.js/dist/propagation.js';
import { eciToGeodetic, degreesLat, degreesLong } from '../../node_modules/satellite.js/dist/transforms.js';

export default function RadarCanvas({
  viewMode,
  satellites,
  simSpeed,
  isPaused,
  onHoverSatellite,
  selectedSatId,
  onSelectSatellite
}) {
  const canvasRef = useRef(null);
  const [pitch, setPitch] = useState(0.4); // rotation around X axis
  const [yaw, setYaw] = useState(0.8);   // rotation around Y axis
  const [scale, setScale] = useState(1);  // Zoom scale
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const pitchStart = useRef(0);
  const yawStart = useRef(0);
  
  // Animation state time
  const simTimeRef = useRef(Date.now());
  const lastFrameTime = useRef(Date.now());

  // Planet definitions for Orrery
  const planets = [
    { name: 'MERCURY', dist: 50, radius: 3, speed: 4.15, color: '#888888', label: 'MER' },
    { name: 'VENUS', dist: 75, radius: 5, speed: 1.62, color: '#e3bb76', label: 'VEN' },
    { name: 'EARTH', dist: 110, radius: 6, speed: 1.0, color: '#00a3ff', label: 'EAR' },
    { name: 'MARS', dist: 145, radius: 4, speed: 0.53, color: '#ff5e3a', label: 'MAR' },
    { name: 'JUPITER', dist: 200, radius: 11, speed: 0.084, color: '#dca376', label: 'JUP' },
    { name: 'SATURN', dist: 260, radius: 9, speed: 0.034, color: '#e2bf7d', hasRings: true, label: 'SAT' },
    { name: 'URANUS', dist: 310, radius: 7, speed: 0.012, color: '#70d1e3', label: 'URA' },
    { name: 'NEPTUNE', dist: 360, radius: 7, speed: 0.006, color: '#3f5efb', label: 'NEP' },
  ];

  // Orbit lines and hover interaction refs
  const projectedSatsRef = useRef([]);

  // Mouse Interaction: Click/Drag vs Hover
  const handleMouseDown = (e) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    pitchStart.current = pitch;
    yawStart.current = yaw;
  };

  const handleMouseMove = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x;
      const dy = e.clientY - dragStart.current.y;
      setYaw(yawStart.current + dx * 0.007);
      setPitch(Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitchStart.current + dy * 0.007)));
    } else {
      // Perform hover tracking
      if (viewMode === 'earth') {
        let minDistance = 12;
        let closestSat = null;

        projectedSatsRef.current.forEach((sat) => {
          const dx = sat.x - mx;
          const dy = sat.y - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestSat = sat;
          }
        });

        if (closestSat) {
          onHoverSatellite(closestSat.satData);
        } else {
          onHoverSatellite(null);
        }
      } else {
        // Orrery Hover detection
        let minDistance = 15;
        let closestPlanet = null;
        const width = canvas.width;
        const height = canvas.height;
        const cx = width / 2;
        const cy = height / 2;

        planets.forEach((p) => {
          // Kepler angle based on current time
          const t = simTimeRef.current * 0.0001 * simSpeed;
          const angle = t * p.speed;
          const px = cx + Math.cos(angle) * p.dist * scale;
          const py = cy + Math.sin(angle) * p.dist * scale;

          const dx = px - mx;
          const dy = py - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDistance) {
            minDistance = dist;
            closestPlanet = p;
          }
        });

        if (closestPlanet) {
          // Simulated telemetry for planet
          onHoverSatellite({
            name: closestPlanet.name,
            operationalStatus: 'OPERATIONAL',
            altitude: Math.round(closestPlanet.dist * 149597.87), // simulated relative scale in 1000s km
            velocity: (closestPlanet.speed * 29.78).toFixed(2), // earth is ~29.78 km/s
            isPlanet: true,
            color: closestPlanet.color
          });
        } else {
          onHoverSatellite(null);
        }
      }
    }
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    setScale((prev) => Math.max(0.3, Math.min(4, prev - e.deltaY * 0.001)));
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.parentElement.clientWidth * dpr;
      canvas.height = canvas.parentElement.clientHeight * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = '100%';
      canvas.style.height = '100%';
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Render step
    const render = () => {
      const now = Date.now();
      const elapsed = now - lastFrameTime.current;
      lastFrameTime.current = now;

      // Update simulation clock
      if (!isPaused) {
        simTimeRef.current += elapsed * simSpeed;
      }

      const width = canvas.width / (window.devicePixelRatio || 1);
      const height = canvas.height / (window.devicePixelRatio || 1);
      const cx = width / 2;
      const cy = height / 2;

      // Clear canvas with tactical dark background
      ctx.fillStyle = '#030508';
      ctx.fillRect(0, 0, width, height);

      // Draw vector radar sweep scanner grid lines
      ctx.strokeStyle = 'rgba(15, 35, 48, 0.4)';
      ctx.lineWidth = 1;
      
      // Grid Matrix
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      if (viewMode === 'earth') {
        drawEarthOrbit(ctx, cx, cy, width, height);
      } else {
        drawSolarSystem(ctx, cx, cy, width, height);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // --- Helper Drawing: Earth view ---
    const drawEarthOrbit = (ctx, cx, cy, width, height) => {
      const baseEarthRadius = Math.min(width, height) * 0.18;
      const r = baseEarthRadius * scale;

      // 3D rotation projection helper
      const project = (x, y, z) => {
        // Pitch (rotate around X axis)
        const y1 = y * Math.cos(pitch) - z * Math.sin(pitch);
        const z1 = y * Math.sin(pitch) + z * Math.cos(pitch);

        // Yaw (rotate around Y axis)
        const x2 = x * Math.cos(yaw) + z1 * Math.sin(yaw);
        const z2 = -x * Math.sin(yaw) + z1 * Math.cos(yaw);

        return {
          x: cx + x2,
          y: cy - y1,
          z: z2 // used for front/back rendering
        };
      };

      // Draw Back Half of Earth Grid (z < 0)
      ctx.lineWidth = 1;
      drawEarthGrid(ctx, r, project, false);

      // Draw Earth Outer Ring/Horizon Glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = 'rgba(0, 5, 12, 0.6)';
      ctx.fill();

      // Draw Front Half of Earth Grid (z >= 0)
      drawEarthGrid(ctx, r, project, true);

      // Draw Earth equator / compass points
      ctx.font = '10px monospace';
      ctx.fillStyle = 'rgba(0, 240, 255, 0.6)';
      ctx.fillText('N', cx - 3, cy - r - 8);
      ctx.fillText('S', cx - 3, cy + r + 14);
      ctx.fillText('W', cx - r - 16, cy + 4);
      ctx.fillText('E', cx + r + 8, cy + 4);

      // Calculate and Draw Satellites
      const date = new Date(simTimeRef.current);
      const gmst = gstime(date);
      const projectedSats = [];

      satellites.forEach((sat, idx) => {
        try {
          if (!sat.satrec) {
            sat.satrec = twoline2satrec(sat.TLE_LINE1, sat.TLE_LINE2);
          }
          const posVel = propagate(sat.satrec, date);
          if (posVel && posVel.position) {
            const posEci = posVel.position;
            const velEci = posVel.velocity;

            // Earth radius approx 6378.137 km
            const earthRadiusKm = 6378.137;
            const satScale = r / earthRadiusKm;

            // Convert to 3D pixels coordinates
            const sx = posEci.x * satScale;
            const sy = posEci.y * satScale;
            const sz = posEci.z * satScale;

            const pt = project(sx, sy, sz);

            // Classify category by name to assign distinct glowing colors
            let color = '#ff3b30'; // Red for Space Debris/Other
            if (sat.OBJECT_NAME.includes('STARLINK') || sat.OBJECT_NAME.includes('ONEWEB') || sat.OBJECT_NAME.includes('GLOBSTAR')) {
              color = '#00f0ff'; // Cyan for Communication
            } else if (sat.OBJECT_NAME.includes('GPS') || sat.OBJECT_NAME.includes('GLONASS') || sat.OBJECT_NAME.includes('GALILEO') || sat.OBJECT_NAME.includes('BEIDOU')) {
              color = '#00ff66'; // Green for Navigation
            } else if (sat.OBJECT_NAME.includes('NOAA') || sat.OBJECT_NAME.includes('METEOR') || sat.OBJECT_NAME.includes('ISS')) {
              color = '#ffb300'; // Yellow for Science / Space station
            }

            projectedSats.push({
              x: pt.x,
              y: pt.y,
              z: pt.z,
              color,
              satData: {
                name: sat.OBJECT_NAME,
                operationalStatus: sat.OBJECT_NAME.includes('DEB') ? 'DEBRIS' : 'OPERATIONAL',
                altitude: Math.round(Math.sqrt(posEci.x * posEci.x + posEci.y * posEci.y + posEci.z * posEci.z) - earthRadiusKm),
                velocity: Math.sqrt(velEci.x * velEci.x + velEci.y * velEci.y + velEci.z * velEci.z).toFixed(2),
                lat: degreesLat(eciToGeodetic(posEci, gmst).latitude).toFixed(4),
                lon: degreesLong(eciToGeodetic(posEci, gmst).longitude).toFixed(4),
                color
              }
            });
          }
        } catch (e) {
          // Skip erroneous calculations
        }
      });

      projectedSatsRef.current = projectedSats;

      // Draw all satellites
      projectedSats.forEach((sat) => {
        const size = sat.z >= 0 ? 3.5 : 2; // larger/brighter on the front side
        ctx.fillStyle = sat.color;
        
        if (sat.z < 0) {
          ctx.globalAlpha = 0.4;
        } else {
          ctx.globalAlpha = 0.95;
          // Subtly glow front ones
          ctx.shadowBlur = 4;
          ctx.shadowColor = sat.color;
        }

        ctx.beginPath();
        ctx.arc(sat.x, sat.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Reset shadow & alpha
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1.0;
      });

      // Highlight selected satellite if any
      if (selectedSatId) {
        const match = projectedSats.find(s => s.satData.name === selectedSatId);
        if (match) {
          // Lock-on Target crosshair strobe circle
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(match.x, match.y, 10 + Math.sin(Date.now() * 0.01) * 3, 0, Math.PI * 2);
          ctx.stroke();

          // Reticle lines
          ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
          ctx.beginPath();
          // Horizontal crosshair line
          ctx.moveTo(match.x - 20, match.y);
          ctx.lineTo(match.x + 20, match.y);
          // Vertical crosshair line
          ctx.moveTo(match.x, match.y - 20);
          ctx.lineTo(match.x, match.y + 20);
          ctx.stroke();

          // Telemetry box label
          ctx.font = '9px monospace';
          ctx.fillStyle = '#00ff66';
          ctx.fillText('TRK LOCK', match.x + 15, match.y - 15);
        }
      }
    };

    // Drawing Latitude/Longitude wireframe grid lines
    const drawEarthGrid = (ctx, r, project, drawFront) => {
      ctx.strokeStyle = drawFront ? 'rgba(0, 240, 255, 0.25)' : 'rgba(0, 240, 255, 0.08)';
      ctx.setLineDash(drawFront ? [] : [2, 4]);

      // Latitudinal rings (parallels)
      const latSteps = [-60, -30, 0, 30, 60];
      latSteps.forEach((lat) => {
        const latRad = (lat * Math.PI) / 180;
        const latRadius = r * Math.cos(latRad);
        const yVal = r * Math.sin(latRad);

        ctx.beginPath();
        let first = true;
        for (let lon = -180; lon <= 180; lon += 5) {
          const lonRad = (lon * Math.PI) / 180;
          const xVal = latRadius * Math.sin(lonRad);
          const zVal = latRadius * Math.cos(lonRad);

          const pt = project(xVal, yVal, zVal);

          // Decide to draw based on front/back depth filter
          if ((drawFront && pt.z >= 0) || (!drawFront && pt.z < 0)) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true; // start new subpath if crossing front/back boundary
          }
        }
        ctx.stroke();
      });

      // Longitudinal lines (meridians)
      for (let lon = -180; lon < 180; lon += 30) {
        const lonRad = (lon * Math.PI) / 180;

        ctx.beginPath();
        let first = true;
        for (let lat = -90; lat <= 90; lat += 5) {
          const latRad = (lat * Math.PI) / 180;
          const latRadius = r * Math.cos(latRad);
          const xVal = latRadius * Math.sin(lonRad);
          const yVal = r * Math.sin(latRad);
          const zVal = latRadius * Math.cos(lonRad);

          const pt = project(xVal, yVal, zVal);

          if ((drawFront && pt.z >= 0) || (!drawFront && pt.z < 0)) {
            if (first) {
              ctx.moveTo(pt.x, pt.y);
              first = false;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          } else {
            first = true;
          }
        }
        ctx.stroke();
      }

      ctx.setLineDash([]);
    };

    // --- Helper Drawing: Solar System view ---
    const drawSolarSystem = (ctx, cx, cy, width, height) => {
      // Draw Sun at center
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#ffb300';
      ctx.fillStyle = '#ffb300';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0; // reset

      // Solar HUD ring
      ctx.strokeStyle = 'rgba(255, 179, 0, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 25 * scale, 0, Math.PI * 2);
      ctx.stroke();

      // Sim timer offset
      const t = simTimeRef.current * 0.0001 * simSpeed;

      // Draw Orbit Rings and Planet Nodes
      planets.forEach((p) => {
        const dist = p.dist * scale;

        // Orbit paths
        ctx.strokeStyle = 'rgba(74, 92, 109, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, dist, 0, Math.PI * 2);
        ctx.stroke();

        // Planet coordinate on concentric ring
        const angle = t * p.speed;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;

        // Draw Planet Node
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(px, py, p.radius * Math.max(0.7, scale * 0.8), 0, Math.PI * 2);
        ctx.fill();

        // If Saturn, draw faint custom orbit ring vector
        if (p.hasRings) {
          ctx.strokeStyle = 'rgba(226, 191, 125, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(px, py, p.radius * 1.8 * Math.max(0.7, scale * 0.8), p.radius * 0.6 * Math.max(0.7, scale * 0.8), Math.PI / 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Label details in monospace
        ctx.fillStyle = 'rgba(164, 179, 198, 0.5)';
        ctx.font = '8px monospace';
        ctx.fillText(p.label, px + p.radius + 4, py + 3);
      });
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, [viewMode, satellites, simSpeed, isPaused, pitch, yaw, scale, selectedSatId]);

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ cursor: isDragging.current ? 'grabbing' : 'crosshair' }}>
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      {/* UI Control Overlays inside canvas bottom */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-1 text-[10px] text-terminal-dim font-mono pointer-events-none select-none">
        <div>ORBITAL PROJECTION: ORTHOGRAPHIC VECTORS</div>
        <div>LAT/LONG STEPS: 30° MERIDIANS | 30° PARALLELS</div>
        <div>PITCH: {(pitch * (180 / Math.PI)).toFixed(1)}° | YAW: {(yaw * (180 / Math.PI)).toFixed(1)}°</div>
        <div>ZOOM SCALE: {(scale * 100).toFixed(0)}% (SCROLL TO ZOOM)</div>
      </div>
    </div>
  );
}
