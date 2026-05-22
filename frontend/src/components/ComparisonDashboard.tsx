"use client";

import { useState } from 'react';
import { runSimulation } from '@/lib/api';
import { SimulationResult } from '@/types';
import { calculateMSE, calculateRMSE, calculateRSE } from '@/lib/metrics';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { X, Search, ChevronLeft } from 'lucide-react';
import dynamic from 'next/dynamic';

const DualSiteMap = dynamic(() => import('./DualSiteMap'), { ssr: false });

interface Props {
  onClose: () => void;
  initialCoords: { lat: number, lon: number };
}

export default function ComparisonDashboard({ onClose, initialCoords }: Props) {
  const [coordsA, setCoordsA] = useState(initialCoords);
  const [coordsB, setCoordsB] = useState({ lat: initialCoords.lat + 0.001, lon: initialCoords.lon + 0.001 }); // Extremely nearby
  
  const [resultA, setResultA] = useState<SimulationResult | null>(null);
  const [resultB, setResultB] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [searchQueryA, setSearchQueryA] = useState("");
  const [searchingA, setSearchingA] = useState(false);
  const [searchQueryB, setSearchQueryB] = useState("");
  const [searchingB, setSearchingB] = useState(false);

  const handleSearch = async (query: string, isA: boolean, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query) return;
    isA ? setSearchingA(true) : setSearchingB(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        if (isA) {
          setCoordsA({ lat, lon });
          setCoordsB({ lat: lat + 0.001, lon: lon + 0.001 }); // Auto-set B to be extremely nearby
        } else {
          setCoordsB({ lat, lon });
        }
      } else {
        alert("Location not found");
      }
    } catch (error) {
      console.error("Search failed", error);
      alert("Search failed. Please try again.");
    }
    isA ? setSearchingA(false) : setSearchingB(false);
  };

  const handleCompare = async () => {
    setLoading(true);
    try {
      const [dataA, dataB] = await Promise.all([
        runSimulation(coordsA.lat, coordsA.lon),
        runSimulation(coordsB.lat, coordsB.lon)
      ]);
      setResultA(dataA);
      setResultB(dataB);
    } catch (err) {
      console.error("Comparison failed", err);
      alert("Failed to run comparison simulations.");
    }
    setLoading(false);
  };

  // Helper to extract arrays for math
  const getArray = (res: SimulationResult | null, key: 'energy_ai' | 'energy_tracker' | 'energy_fixed' | 'dni') => {
    if (!res) return [];
    return res.timeseries.map(t => t[key]);
  };

  const aiA = getArray(resultA, 'energy_ai');
  const trA = getArray(resultA, 'energy_tracker');
  const fxA = getArray(resultA, 'energy_fixed');
  const dniA = getArray(resultA, 'dni');
  
  const aiB = getArray(resultB, 'energy_ai');
  const trB = getArray(resultB, 'energy_tracker');
  const fxB = getArray(resultB, 'energy_fixed');
  const dniB = getArray(resultB, 'dni');

  // Combined data for Recharts overlay
  const combinedChartData = resultA?.timeseries.map((t, i) => ({
    time: t.time,
    Loc_A_AI: t.energy_ai,
    Loc_B_AI: resultB?.timeseries[i]?.energy_ai || 0,
    Loc_A_DNI: t.dni,
    Loc_B_DNI: resultB?.timeseries[i]?.dni || 0,
  })) || [];

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur overflow-y-auto p-6 flex flex-col text-slate-50">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-medium transition-colors text-slate-300">
            <ChevronLeft size={18} />
            Back to Dashboard
          </button>
          <h2 className="text-2xl font-bold text-orange-400">Micro-Climate Analysis</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
          <X size={24} />
        </button>
      </div>

      <DualSiteMap 
        coordsA={coordsA} 
        coordsB={coordsB} 
        onSetA={setCoordsA} 
        onSetB={setCoordsB} 
      />

      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-slate-900 p-4 border border-slate-800 rounded-xl shadow-lg">
          <h3 className="font-semibold mb-3 text-blue-400">Location A (Primary)</h3>
          <form onSubmit={(e) => handleSearch(searchQueryA, true, e)} className="flex gap-2 mb-3">
            <input type="text" placeholder="Search Location A..." value={searchQueryA} onChange={e => setSearchQueryA(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 p-2 rounded text-sm outline-none focus:border-blue-500" />
            <button type="submit" disabled={searchingA} className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 disabled:opacity-50"><Search size={20} /></button>
          </form>
          <div className="flex gap-2">
             <input type="number" step="0.000001" value={coordsA.lat} onChange={e => setCoordsA({...coordsA, lat: parseFloat(e.target.value)})} className="bg-slate-950 border border-slate-700 p-2 rounded w-full text-sm outline-none focus:border-blue-500" placeholder="Lat" />
             <input type="number" step="0.000001" value={coordsA.lon} onChange={e => setCoordsA({...coordsA, lon: parseFloat(e.target.value)})} className="bg-slate-950 border border-slate-700 p-2 rounded w-full text-sm outline-none focus:border-blue-500" placeholder="Lon" />
          </div>
        </div>
        <div className="bg-slate-900 p-4 border border-slate-800 rounded-xl shadow-lg">
          <h3 className="font-semibold mb-3 text-purple-400">Location B (Extremely Nearby)</h3>
          <form onSubmit={(e) => handleSearch(searchQueryB, false, e)} className="flex gap-2 mb-3">
            <input type="text" placeholder="Search Location B..." value={searchQueryB} onChange={e => setSearchQueryB(e.target.value)} className="flex-1 bg-slate-950 border border-slate-700 p-2 rounded text-sm outline-none focus:border-purple-500" />
            <button type="submit" disabled={searchingB} className="bg-slate-800 hover:bg-slate-700 p-2 rounded text-slate-300 disabled:opacity-50"><Search size={20} /></button>
          </form>
          <div className="flex gap-2">
             <input type="number" step="0.000001" value={coordsB.lat} onChange={e => setCoordsB({...coordsB, lat: parseFloat(e.target.value)})} className="bg-slate-950 border border-slate-700 p-2 rounded w-full text-sm outline-none focus:border-purple-500" placeholder="Lat" />
             <input type="number" step="0.000001" value={coordsB.lon} onChange={e => setCoordsB({...coordsB, lon: parseFloat(e.target.value)})} className="bg-slate-950 border border-slate-700 p-2 rounded w-full text-sm outline-none focus:border-purple-500" placeholder="Lon" />
          </div>
        </div>
      </div>
      
      <button onClick={handleCompare} disabled={loading} className="bg-orange-600 hover:bg-orange-500 py-3 rounded-xl font-bold mb-8 transition-all shadow-lg shadow-orange-900/20 disabled:opacity-50">
        {loading ? "Running Dual Simulations..." : "Generate Comparison Report"}
      </button>

      {/* Results */}
      {resultA && resultB && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Metrics Tables */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-slate-800/50 p-3 font-semibold text-sm border-b border-slate-800">Location A AI Error Metrics</div>
              <div className="p-4 space-y-3 font-mono text-xs">
                 <div className="flex justify-between"><span>MSE (vs Tracker)</span> <span className="text-orange-300">{calculateMSE(trA, aiA).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RMSE (vs Tracker)</span> <span className="text-orange-300">{calculateRMSE(trA, aiA).toFixed(4)}</span></div>
                 <div className="flex justify-between border-b border-slate-700 pb-2"><span>RSE (vs Tracker)</span> <span className="text-orange-300">{calculateRSE(trA, aiA).toFixed(4)}</span></div>
                 
                 <div className="flex justify-between pt-2"><span>MSE (vs Fixed)</span> <span className="text-blue-300">{calculateMSE(fxA, aiA).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RMSE (vs Fixed)</span> <span className="text-blue-300">{calculateRMSE(fxA, aiA).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RSE (vs Fixed)</span> <span className="text-blue-300">{calculateRSE(fxA, aiA).toFixed(4)}</span></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
              <div className="bg-slate-800/50 p-3 font-semibold text-sm border-b border-slate-800">Location B AI Error Metrics</div>
              <div className="p-4 space-y-3 font-mono text-xs">
                 <div className="flex justify-between"><span>MSE (vs Tracker)</span> <span className="text-orange-300">{calculateMSE(trB, aiB).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RMSE (vs Tracker)</span> <span className="text-orange-300">{calculateRMSE(trB, aiB).toFixed(4)}</span></div>
                 <div className="flex justify-between border-b border-slate-700 pb-2"><span>RSE (vs Tracker)</span> <span className="text-orange-300">{calculateRSE(trB, aiB).toFixed(4)}</span></div>

                 <div className="flex justify-between pt-2"><span>MSE (vs Fixed)</span> <span className="text-blue-300">{calculateMSE(fxB, aiB).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RMSE (vs Fixed)</span> <span className="text-blue-300">{calculateRMSE(fxB, aiB).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>RSE (vs Fixed)</span> <span className="text-blue-300">{calculateRSE(fxB, aiB).toFixed(4)}</span></div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden border-orange-900/50 shadow-lg shadow-orange-950/10">
              <div className="bg-orange-950/20 p-3 font-semibold text-sm text-orange-200 border-b border-slate-800">Loc A vs Loc B Differential</div>
              <div className="p-4 space-y-3 font-mono text-xs">
                 <div className="flex justify-between text-lg font-bold">
                    <span className="text-slate-400">Total Yield Delta</span>
                    <span className={resultA.daily_totals.ai_wh >= resultB.daily_totals.ai_wh ? "text-green-400" : "text-red-400"}>
                      {((resultA.daily_totals.ai_wh / resultB.daily_totals.ai_wh - 1) * 100).toFixed(2)}%
                    </span>
                 </div>
                 <div className="flex justify-between pt-2 border-t border-slate-800"><span>AI Yield MSE</span> <span className="text-red-400 font-bold">{calculateMSE(aiA, aiB).toFixed(4)}</span></div>
                 <div className="flex justify-between"><span>AI Yield RMSE</span> <span className="text-red-400 font-bold">{calculateRMSE(aiA, aiB).toFixed(4)}</span></div>
                 
                 <div className="flex justify-between pt-2 border-t border-slate-800"><span>Power (DNI) MSE</span> <span className="text-yellow-400">{calculateMSE(dniA, dniB).toFixed(2)}</span></div>
                 <div className="flex justify-between"><span>Power (DNI) RMSE</span> <span className="text-yellow-400">{calculateRMSE(dniA, dniB).toFixed(2)}</span></div>
                 
                 <p className="text-[10px] text-slate-500 mt-2 italic border-t border-slate-800 pt-2">Mathematical variance of AI decision quality over a distance of {Math.sqrt(Math.pow(coordsA.lat - coordsB.lat, 2) + Math.pow(coordsA.lon - coordsB.lon, 2)).toFixed(6)} degrees.</p>
              </div>
            </div>
          </div>

          {/* Graph Overlays */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col h-72">
              <h3 className="font-semibold mb-2 text-slate-300 flex justify-between items-center text-sm">
                AI Yield Overlay (Wh)
                <span className="text-[10px] font-normal text-slate-500">Compares final generated output</span>
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val, i) => i % 6 === 0 ? val : ''} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="Loc_A_AI" name="Loc A Yield" stroke="#3b82f6" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Loc_B_AI" name="Loc B Yield" stroke="#a855f7" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg flex flex-col h-72">
              <h3 className="font-semibold mb-2 text-slate-300 flex justify-between items-center text-sm">
                Source Power Overlay (DNI W/m²)
                <span className="text-[10px] font-normal text-slate-500">Compares raw solar potential</span>
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={combinedChartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val, i) => i % 6 === 0 ? val : ''} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }} itemStyle={{ fontSize: '12px' }} />
                    <Legend verticalAlign="top" height={36}/>
                    <Line type="monotone" dataKey="Loc_A_DNI" name="Loc A DNI" stroke="#eab308" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Loc_B_DNI" name="Loc B DNI" stroke="#fbbf24" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
