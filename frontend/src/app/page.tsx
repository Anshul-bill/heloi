"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { runSimulation, api } from '@/lib/api';
import { SimulationResult, Coordinates } from '@/types';
import { Sun, Wind, Cloud, Droplets, AlertTriangle, DollarSign, Play, Pause } from 'lucide-react';
import AnalyticsCharts from '@/components/AnalyticsCharts';

// Dynamically import Map to avoid SSR issues with Leaflet
const SiteMap = dynamic(() => import('@/components/SiteMap'), { ssr: false });
const DigitalTwin3D = dynamic(() => import('@/components/DigitalTwin3D'), { ssr: false });
import RLPolicyVisualization from '@/components/RLPolicyVisualization';

export default function Home() {
  const [coords, setCoords] = useState<Coordinates>({ lat: 28.61, lon: 77.21 });
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  
  // Use a ref for precise timestamp tracking in the animation loop
  const requestRef = useRef<number>(null);
  const lastUpdateTimeRef = useRef<number>(0);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data && data.length > 0) {
        setCoords({ lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) });
      } else {
        alert("Location not found");
      }
    } catch (error) {
      console.error("Search failed", error);
      alert("Search failed. Please try again.");
    }
    setSearching(false);
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const data = await runSimulation(coords.lat, coords.lon);
      setResult(data);
      setCurrentStep(24); // Default to noon (sun high in sky)
      setIsPlaying(false);
    } catch (error) {
      console.error("Simulation failed", error);
      alert("Simulation failed. Is the backend running?");
    }
    setLoading(false);
  };

  const handleExport = async () => {
    if (!result) return;
    try {
      const res = await api.post('/export-matlab', result);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'heliosx_simscape_export.json';
      a.click();
    } catch (error) {
      console.error("Export failed", error);
    }
  };

  // Smooth Animation Loop
  useEffect(() => {
    const animate = (time: number) => {
      if (isPlaying && result) {
        if (lastUpdateTimeRef.current !== 0) {
          const deltaTime = time - lastUpdateTimeRef.current;
          
          setCurrentStep((prev) => {
            // One step (30 mins) every 1000ms for smooth observation
            const increment = deltaTime / 1000;
            let next = prev + increment;
            if (next >= 47) {
              setIsPlaying(false);
              return 47;
            }
            return next;
          });
        }
        lastUpdateTimeRef.current = time;
        requestRef.current = requestAnimationFrame(animate);
      }
    };

    if (isPlaying) {
        lastUpdateTimeRef.current = 0; // Reset timer on play to avoid jumps
        requestRef.current = requestAnimationFrame(animate);
    } else {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, result]);

  // Data Interpolation
  const stepIndex = Math.floor(currentStep);
  const nextIndex = Math.min(stepIndex + 1, 47);
  const progress = currentStep - stepIndex;
  
  const currentData = result?.timeseries[stepIndex];
  const nextData = result?.timeseries[nextIndex];
  
  // Smoothly interpolated state for the 3D Engine
  const interpolatedData = currentData && nextData ? {
      ...currentData,
      sun_alt: (currentData.sun_alt ?? 0) + ((nextData.sun_alt ?? 0) - (currentData.sun_alt ?? 0)) * progress,
      sun_az: (currentData.sun_az ?? 0) + ((nextData.sun_az ?? 0) - (currentData.sun_az ?? 0)) * progress,
      tilt_bias: (currentData.tilt_bias ?? 0) + ((nextData.tilt_bias ?? 0) - (currentData.tilt_bias ?? 0)) * progress,
      azimuth_bias: (currentData.azimuth_bias ?? 0) + ((nextData.azimuth_bias ?? 0) - (currentData.azimuth_bias ?? 0)) * progress,
  } : currentData;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <header className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-yellow-200 bg-clip-text text-transparent">
          Helios-X Digital Twin
        </h1>
        {result && (
          <button onClick={handleExport} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg">
            Export to MATLAB
          </button>
        )}
      </header>

      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[calc(100vh-6rem)]">
        
        {/* Left Column: Controls (1/4 width) */}
        <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col h-full">
          <h2 className="text-lg font-semibold mb-4">Location Settings</h2>
          <div className="mb-4 flex-shrink-0">
             <SiteMap position={coords} onPositionChange={setCoords} />
          </div>
          
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Latitude</label>
              <input type="number" value={coords.lat} onChange={(e) => setCoords({...coords, lat: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Longitude</label>
              <input type="number" value={coords.lon} onChange={(e) => setCoords({...coords, lon: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500" />
            </div>
          </div>

          <form onSubmit={handleSearch} className="mb-6 flex gap-2">
            <input 
              type="text" 
              placeholder="Search location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500"
            />
            <button 
              type="submit" 
              disabled={searching}
              className="bg-slate-800 hover:bg-slate-700 text-sm font-bold py-1.5 px-3 rounded-lg disabled:opacity-50"
            >
              {searching ? "..." : "Search"}
            </button>
          </form>

          <button onClick={handleSimulate} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 font-bold py-2.5 rounded-lg mt-auto transition-all shadow-lg shadow-orange-900/20">
            {loading ? "Running Simulation..." : "Run Simulation"}
          </button>
        </section>

        {/* Center Column: 3D Twin (2/4 width) */}
        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
           {result && interpolatedData ? (
             <>
               <div className="relative flex-1 min-h-[40vh] bg-black">
                 <DigitalTwin3D 
                    obstacles={result.obstacles} 
                    sunAlt={interpolatedData.sun_alt} 
                    sunAz={interpolatedData.sun_az} 
                    panelAction={interpolatedData.action} 
                    tiltBias={interpolatedData.tilt_bias}
                    azBias={interpolatedData.azimuth_bias}
                 />
                 {/* Timeline Controls Overlay */}
                 <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur border border-slate-700 p-3 rounded-xl flex items-center gap-4 z-10">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg">
                      {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                    </button>
                    <input 
                      type="range" 
                      min="0" 
                      max="47" 
                      step="0.01"
                      value={currentStep} 
                      onChange={(e) => { setIsPlaying(false); setCurrentStep(parseFloat(e.target.value)); }} 
                      className="flex-1 accent-orange-500 cursor-pointer" 
                    />
                    <span className="font-mono text-sm w-12 text-center">{currentData?.time}</span>
                 </div>
               </div>
               {/* RL Visualizer Overlay / Section */}
               <div className="shrink-0 bg-slate-950 border-t border-slate-800">
                  <RLPolicyVisualization 
                    qValues={interpolatedData.q_values} 
                    actionId={interpolatedData.action_id} 
                    mode={interpolatedData.action} 
                    tiltBias={interpolatedData.tilt_bias} 
                    azBias={interpolatedData.azimuth_bias} 
                  />
               </div>
             </>
           ) : (
             <div className="h-full flex flex-col items-center justify-center text-center p-12">
               <Sun className="w-16 h-16 text-slate-800 mb-4 animate-pulse" />
               <p className="text-slate-500 text-xl font-medium">No Data Loaded</p>
               <p className="text-slate-600 text-sm mt-2">Run a simulation to generate the 3D environment.</p>
             </div>
           )}
        </section>

        {/* Right Column: Analytics (1/4 width) */}
        <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col h-full overflow-y-auto space-y-6">
           
           {/* Weather Panel */}
           <div>
             <h2 className="text-sm font-semibold mb-3 text-slate-400 uppercase tracking-wider">Environment State</h2>
             {interpolatedData ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                    <Sun size={20} className="text-yellow-500" />
                    <div>
                      <p className="text-xs text-slate-500">Temp</p>
                      <p className="font-mono">{interpolatedData.temp_c.toFixed(1)}&deg;C</p>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                    <Wind size={20} className="text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-500">Wind</p>
                      <p className="font-mono">{interpolatedData.wind_speed.toFixed(1)}m/s</p>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                    <Cloud size={20} className="text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">AQI</p>
                      <p className="font-mono">{interpolatedData.aqi}</p>
                    </div>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center gap-3">
                    <Sun size={20} className="text-orange-500" />
                    <div>
                      <p className="text-xs text-slate-500">DNI</p>
                      <p className="font-mono">{interpolatedData.dni.toFixed(0)}W/m&sup2;</p>
                    </div>
                  </div>
                </div>
             ) : (
                <p className="text-xs text-slate-600 italic">Waiting for simulation...</p>
             )}
           </div>

           {/* Charts Panel */}
           <div>
              <h2 className="text-sm font-semibold mb-3 text-slate-400 uppercase tracking-wider">Energy Yield</h2>
              {result ? (
                 <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg">
                    <AnalyticsCharts data={result.timeseries} currentIndex={stepIndex} />
                    <div className="mt-3 flex justify-between text-xs font-mono">
                      <span className="text-slate-400">Fixed: {result.daily_totals.fixed_wh}</span>
                      <span className="text-orange-400">AI: {result.daily_totals.ai_wh}</span>
                    </div>
                 </div>
              ) : (
                 <div className="h-48 border border-dashed border-slate-800 rounded-lg flex items-center justify-center text-slate-600 text-xs">
                    [ Yield Graphs ]
                 </div>
              )}
           </div>

           {/* Diagnostics & Impact */}
           {result && (
              <div className="mt-auto">
                 <h2 className="text-sm font-semibold mb-3 text-slate-400 uppercase tracking-wider">Diagnostics</h2>
                 
                 <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-slate-500">Commercial Impact</p>
                      <p className="text-lg font-bold text-red-400">${result.commercial_impact.financial_loss_usd.toFixed(2)}/day</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                      result.commercial_impact.urgency.includes("Schedule") ? "bg-red-950 text-red-400 border border-red-900" : "bg-green-950 text-green-400 border border-green-900"
                    }`}>
                      {result.commercial_impact.urgency}
                    </span>
                 </div>

                 <div className="space-y-2">
                    {result.faults.length > 0 ? result.faults.map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-yellow-950/30 p-3 rounded-lg border border-yellow-900/50">
                        <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs capitalize text-yellow-500">{f.type.replace('_', ' ')}</p>
                          <p className="text-slate-400 text-[10px] leading-tight">{f.message}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-green-400 text-xs bg-green-950/30 p-3 rounded-lg border border-green-900/50">
                        All systems operating within nominal parameters.
                      </p>
                    )}
                 </div>
              </div>
           )}
        </section>

      </div>
    </main>
  );
}
