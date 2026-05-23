"use client";

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { runSimulation, api } from '@/lib/api';
import { Coordinates } from '@/types';
import { Sun, AlertTriangle, Play, Pause, Activity, Zap, Battery } from 'lucide-react';
import AnalyticsCharts from '@/components/AnalyticsCharts';
import { Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, AreaChart, Area, ComposedChart } from 'recharts';

// Dynamically import Map to avoid SSR issues with Leaflet
const SiteMap = dynamic(() => import('@/components/SiteMap'), { ssr: false });
const DigitalTwin3D = dynamic(() => import('@/components/DigitalTwin3D'), { ssr: false });
const ComparisonDashboard = dynamic(() => import('@/components/ComparisonDashboard'), { ssr: false });
import RLPolicyVisualization from '@/components/RLPolicyVisualization';

export default function Home() {
  const [coords, setCoords] = useState<Coordinates>({ lat: 28.61, lon: 77.21 });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [hwConnected, setHwConnected] = useState(false);
  
  useEffect(() => {
    setMounted(true);
    // Simulate hardware bridge connection
    const timer = setTimeout(() => setHwConnected(true), 1500);
    return () => clearTimeout(timer);
  }, []);
  
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
      setCurrentStep(24);
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

  useEffect(() => {
    const animate = (time: number) => {
      if (isPlaying && result) {
        if (lastUpdateTimeRef.current !== 0) {
          const deltaTime = time - lastUpdateTimeRef.current;
          setCurrentStep((prev) => {
            const increment = deltaTime / 1000;
            const next = prev + increment;
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
        lastUpdateTimeRef.current = 0;
        requestRef.current = requestAnimationFrame(animate);
    } else {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [isPlaying, result]);

  const stepIndex = Math.floor(currentStep);
  const nextIndex = Math.min(stepIndex + 1, 47);
  const progress = currentStep - stepIndex;
  
  const currentData = result?.timeseries[stepIndex];
  const nextData = result?.timeseries[nextIndex];
  
  const interpolatedData = currentData && nextData ? {
      ...currentData,
      sun_alt: (currentData.sun_alt ?? 0) + ((nextData.sun_alt ?? 0) - (currentData.sun_alt ?? 0)) * progress,
      sun_az: (currentData.sun_az ?? 0) + ((nextData.sun_az ?? 0) - (currentData.sun_az ?? 0)) * progress,
      tilt_bias: (currentData.tilt_bias ?? 0) + ((nextData.tilt_bias ?? 0) - (currentData.tilt_bias ?? 0)) * progress,
      azimuth_bias: (currentData.azimuth_bias ?? 0) + ((nextData.azimuth_bias ?? 0) - (currentData.azimuth_bias ?? 0)) * progress,
      energy_fixed: (currentData.energy_fixed ?? 0) + ((nextData.energy_fixed ?? 0) - (currentData.energy_fixed ?? 0)) * progress,
      grid_price: (currentData.grid_price ?? 0) + ((nextData.grid_price ?? 0) - (currentData.grid_price ?? 0)) * progress,
      grid_load: (currentData.grid_load ?? 0) + ((nextData.grid_load ?? 0) - (currentData.grid_load ?? 0)) * progress,
      revenue: (currentData.revenue ?? 0) + ((nextData.revenue ?? 0) - (currentData.revenue ?? 0)) * progress,
      bess_soc: (currentData.bess_soc ?? 0) + ((nextData.bess_soc ?? 0) - (currentData.bess_soc ?? 0)) * progress,
      energy_exported: (currentData.energy_exported ?? 0) + ((nextData.energy_exported ?? 0) - (currentData.energy_exported ?? 0)) * progress,
  } : currentData;

  if (!mounted) return null;

  return (
    <>
      <main className="min-h-screen bg-slate-950 text-slate-50 p-4">
      <header className="max-w-7xl mx-auto mb-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-yellow-200 bg-clip-text text-transparent">
            Helios-X Digital Twin
            </h1>
            <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-tighter transition-all ${
                hwConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}>
                <Activity size={10} className={hwConnected ? "animate-pulse" : ""} />
                {hwConnected ? "HARDWARE: LINKED" : "HARDWARE: OFFLINE"}
            </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setShowComparison(true)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg text-blue-400 transition-colors shadow-lg">
            Compare Micro-Climates
          </button>
          {result && (
            <button onClick={handleExport} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-medium rounded-lg">
              Export to MATLAB
            </button>
          )}
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-8rem)] min-h-0">
        
        <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col h-full shadow-2xl overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 uppercase tracking-tighter">
              <Zap size={18} className="text-orange-400" /> Location Settings
          </h2>
          <div className="mb-4 flex-shrink-0">
             <SiteMap position={coords} onPositionChange={setCoords} />
          </div>
          
          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Latitude</label>
                    <input type="number" value={coords.lat} onChange={(e) => setCoords({...coords, lat: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500 font-mono" />
                </div>
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Longitude</label>
                    <input type="number" value={coords.lon} onChange={(e) => setCoords({...coords, lon: parseFloat(e.target.value)})} className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500 font-mono" />
                </div>
            </div>
          </div>

          <form onSubmit={handleSearch} className="mb-6 flex gap-2">
            <input 
              type="text" 
              placeholder="Search location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-sm outline-none focus:border-orange-500 shadow-inner"
            />
            <button 
              type="submit" 
              disabled={searching}
              className="bg-slate-800 hover:bg-slate-700 text-sm font-bold py-1.5 px-3 rounded-lg disabled:opacity-50 transition-all"
            >
              {searching ? "..." : "Search"}
            </button>
          </form>

          <button onClick={handleSimulate} disabled={loading} className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-slate-700 font-black py-3 rounded-xl mt-auto transition-all shadow-lg shadow-orange-900/20 uppercase tracking-tight text-sm">
            {loading ? "Computing Neural Loop..." : "Run Global Simulation"}
          </button>
        </section>

        <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
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
                 <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur border border-slate-700 p-3 rounded-xl flex items-center gap-4 z-10 shadow-2xl">
                    <button onClick={() => setIsPlaying(!isPlaying)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-orange-400">
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
                    <span className="font-mono text-sm w-12 text-center text-slate-400">{currentData?.time}</span>
                 </div>
               </div>
               <div className="shrink-0 bg-slate-950 border-t border-slate-800 shadow-inner">
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
             <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-950/50">
               <Sun className="w-16 h-16 text-slate-800 mb-4 animate-pulse" />
               <p className="text-slate-500 text-xl font-medium tracking-tight">System Initialization Pending</p>
               <p className="text-slate-700 text-xs mt-2 uppercase tracking-[0.2em]">Run a simulation to generate 3D Twin environment</p>
             </div>
           )}
        </section>

        <section className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col h-full overflow-y-auto space-y-6 shadow-2xl">
           
           <div>
             <h2 className="text-xs font-bold mb-3 text-slate-500 uppercase tracking-widest flex items-center gap-2">
                 <Activity size={14} /> Telemetry State
             </h2>
             {interpolatedData ? (
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Surface Temp</p>
                      <p className="font-mono text-lg">{interpolatedData.temp_c.toFixed(1)}&deg;C</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Wind Velocity</p>
                      <p className="font-mono text-lg text-blue-400">{interpolatedData.wind_speed.toFixed(1)}m/s</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Grid Signal</p>
                      <p className="font-mono text-lg text-emerald-400">{(interpolatedData.grid_load * 100).toFixed(0)}%</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Grid Tariff</p>
                      <p className="font-mono text-lg text-yellow-400">${interpolatedData.grid_price.toFixed(2)}</p>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex flex-col justify-center col-span-2">
                      <div className="flex justify-between items-center mb-1">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter flex items-center gap-1">
                              <Battery size={10} /> Battery Storage (BESS)
                          </p>
                          <span className="text-[10px] font-mono text-emerald-400">{(interpolatedData.bess_soc ?? 0).toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                          <div 
                              className="h-full bg-emerald-500 transition-all duration-500" 
                              style={{ width: `${interpolatedData.bess_soc ?? 0}%` }}
                          />
                      </div>
                  </div>
                  <div className="bg-slate-950 border border-orange-950 p-3 rounded-xl flex items-center gap-3 col-span-2 border-dashed">
                    <Zap size={20} className="text-orange-400" />
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Real-Time Yield</p>
                      <p className="font-mono text-orange-400 font-bold">{interpolatedData.energy_ai.toFixed(2)} W</p>
                    </div>
                  </div>
                </div>
             ) : (
                <p className="text-[10px] text-slate-700 italic font-bold">WAITING FOR NEURAL DATA...</p>
             )}
           </div>

           <div className="space-y-6">
              <div>
                <h2 className="text-xs font-bold mb-3 text-slate-500 uppercase tracking-widest">Energy Yield (Wh)</h2>
                {result ? (
                   <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <AnalyticsCharts data={result.timeseries} currentIndex={stepIndex} />
                      <div className="mt-3 flex justify-between text-[10px] font-mono border-t border-slate-800 pt-3">
                        <span className="text-slate-500">FIXED: {result.daily_totals.fixed_wh}</span>
                        <span className="text-blue-500">TRKR: {result.daily_totals.tracker_wh}</span>
                        <span className="text-orange-400 font-bold underline">AI: {result.daily_totals.ai_wh}</span>
                      </div>
                   </div>
                ) : (
                   <div className="h-32 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-700 text-[10px] uppercase font-bold">
                      Yield Trace
                   </div>
                )}
              </div>

              <div>
                <h2 className="text-xs font-bold mb-3 text-slate-500 uppercase tracking-widest flex justify-between">
                    Grid Transformation (W)
                    <span className="text-emerald-500 font-black tracking-tighter">Load Balancing</span>
                </h2>
                {result ? (
                   <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="w-full h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={result.timeseries} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorDemand" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#334155" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#334155" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" hide />
                            <YAxis hide />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none', fontSize: '10px' }} />
                            <Area type="monotone" dataKey="grid_demand" name="Base Demand" stroke="#475569" fillOpacity={1} fill="url(#colorDemand)" />
                            <Line type="monotone" dataKey="grid_unbalanced" name="Unbalanced" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="grid_balanced" name="Balanced" stroke="#10b981" strokeWidth={2} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                ) : (
                   <div className="h-32 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-700 text-[10px] uppercase font-bold">
                      Grid Transformation
                   </div>
                )}
              </div>

              <div>
                <h2 className="text-xs font-bold mb-3 text-slate-500 uppercase tracking-widest flex justify-between">
                    Grid Load Analysis
                    <span className="text-emerald-500 font-black tracking-tighter">Peak Shaving</span>
                </h2>
                {result ? (
                   <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="w-full h-32">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={result.timeseries} margin={{ top: 10, right: 10, left: -30, bottom: 0 }}>
                            <XAxis dataKey="time" hide />
                            <YAxis hide />
                            <YAxis yAxisId="right" orientation="right" hide />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: 'none', fontSize: '10px' }}
                              labelStyle={{ color: '#64748b' }}
                            />
                            {interpolatedData && (
                                <ReferenceLine x={result.timeseries[stepIndex]?.time} stroke="#f97316" strokeDasharray="3 3" />
                            )}
                            <Area type="monotone" dataKey="grid_demand" name="Base Demand" fill="#334155" fillOpacity={0.3} stroke="none" />
                            <Line type="monotone" dataKey="grid_unbalanced" name="Unbalanced" stroke="#ef4444" strokeWidth={1} dot={false} strokeDasharray="3 3" />
                            <Line type="monotone" dataKey="grid_balanced" name="Balanced" stroke="#10b981" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0 0 8px #10b981)' }} />
                            <Area yAxisId="right" type="monotone" dataKey="bess_soc" name="Battery SoC" fill="#a855f7" fillOpacity={0.1} stroke="none" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                   </div>
                ) : (
                   <div className="h-32 border border-dashed border-slate-800 rounded-xl flex items-center justify-center text-slate-700 text-[10px] uppercase font-bold">
                      Grid Metrics
                   </div>
                )}
              </div>
           </div>

           {result && (
              <div className="mt-auto border-t border-slate-800 pt-6">
                 <h2 className="text-xs font-bold mb-3 text-slate-500 uppercase tracking-widest">Financial Engine</h2>
                 
                 <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex flex-col items-center justify-center text-center">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Peak Shaved</p>
                        <p className="text-sm font-black text-orange-400">{(result.daily_totals.total_shaved_wh ?? 0).toFixed(0)} Wh</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex flex-col items-center justify-center text-center">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Stability</p>
                        <p className="text-sm font-black text-emerald-400">{(result.daily_totals.efficiency_score ?? 0).toFixed(1)}%</p>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-2 rounded-xl flex flex-col items-center justify-center text-center">
                        <p className="text-[8px] font-bold text-slate-500 uppercase">Capture</p>
                        <p className="text-sm font-black text-blue-400">${(result.daily_totals.ai_revenue_usd ?? 0).toFixed(2)}</p>
                    </div>
                 </div>

                 <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-3 flex items-center justify-between shadow-inner">
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Est. Revenue Loss</p>
                      <p className="text-lg font-black text-red-500 tracking-tighter">${result.commercial_impact.financial_loss_usd.toFixed(2)}</p>
                    </div>
                    <div className="flex-1 border-l border-slate-800 pl-4">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Daily Earnings</p>
                      <p className="text-lg font-black text-emerald-500 tracking-tighter">${(result.daily_totals.ai_revenue_usd ?? 0).toFixed(2)}</p>
                    </div>
                 </div>

                 <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl mb-3 flex flex-col shadow-inner">
                    <p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Load Balancing Efficiency</p>
                    <div className="flex items-end gap-2">
                        <p className={`text-2xl font-black tracking-tighter ${result.daily_totals.efficiency_score > 80 ? 'text-emerald-500' : 'text-slate-400'}`}>
                            {result.daily_totals.efficiency_score.toFixed(1)}%
                        </p>
                        <span className="text-[10px] text-slate-500 mb-1 font-bold uppercase italic">Optimization Grade</span>
                    </div>
                 </div>

                 <div className={`mb-3 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-center ${
                      result.commercial_impact.urgency.includes("Schedule") ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}>
                      {result.commercial_impact.urgency}
                 </div>

                 <div className="space-y-2">
                    {result.faults.length > 0 ? result.faults.map((f: any, i: number) => (
                      <div key={i} className="flex items-start gap-3 bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/10">
                        <AlertTriangle size={14} className="text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-black text-[10px] uppercase text-yellow-500 leading-none mb-1">{f.type.replace('_', ' ')}</p>
                          <p className="text-slate-500 text-[10px] leading-tight font-medium">{f.message}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-emerald-400 text-[10px] font-bold bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/10 uppercase tracking-tight">
                        All systems operational. Yield maximized.
                      </p>
                    )}
                 </div>
              </div>
           )}
        </section>

      </div>
    </main>

    {showComparison && (
      <ComparisonDashboard 
        onClose={() => setShowComparison(false)} 
        initialCoords={coords} 
      />
    )}
    </>
  );
}
