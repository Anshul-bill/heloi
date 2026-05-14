import React from 'react';
import { BrainCircuit, Cpu } from 'lucide-react';

interface RLPolicyVisualizationProps {
  qValues?: number[];
  actionId?: number;
  mode?: string;
  tiltBias?: number;
  azBias?: number;
}

const ACTION_MAPPING = [
  { id: 0, label: "-15° Tilt" },
  { id: 1, label: "-10° Tilt" },
  { id: 2, label: "-5° Tilt" },
  { id: 3, label: "0° (Perfect Track)" }, // Physics baseline
  { id: 4, label: "+5° Tilt" },
  { id: 5, label: "+10° Tilt" },
  { id: 6, label: "+15° Tilt" },
  { id: 7, label: "-15° Azimuth" },
  { id: 8, label: "+15° Azimuth" },
  { id: 9, label: "+10° Tilt, +10° Az" },
  { id: 10, label: "-10° Tilt, +10° Az" },
  { id: 11, label: "Stow Mode" },
  { id: 12, label: "Diffuse Mode" }
];

export default function RLPolicyVisualization({ qValues, actionId, mode, tiltBias, azBias }: RLPolicyVisualizationProps) {
  if (!qValues || qValues.length === 0) return null;

  const maxQ = Math.max(...qValues);
  const minQ = Math.min(...qValues);
  const range = maxQ - minQ || 1;

  // Normalize Q-values to 0-100% for bar chart
  const normalize = (val: number) => ((val - minQ) / range) * 100;

  return (
    <div className="bg-slate-950 p-4 w-full text-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <BrainCircuit size={120} />
      </div>

      <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <Cpu className="text-purple-500" size={20} />
          <h3 className="font-bold text-sm tracking-widest text-slate-300 uppercase">Double DQN Policy Head</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Selected Action: <span className="font-bold text-orange-400 capitalize">{mode}</span></p>
          <p className="text-[10px] text-slate-500 font-mono">Bias: Tilt {tiltBias}&deg; | Az {azBias}&deg;</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
          {qValues.map((q, idx) => {
            const isSelected = idx === actionId;
            const isPhysicsBaseline = idx === 3;
            const label = ACTION_MAPPING[idx]?.label || `Action ${idx}`;
            
            return (
              <div key={idx} className={`relative p-2 rounded border flex flex-col justify-center ${isSelected ? 'bg-orange-950/40 border-orange-500/50' : 'bg-slate-900/50 border-slate-800'}`}>
                <div className="flex justify-between items-center mb-1 relative z-10">
                  <span className={`text-[10px] font-bold ${isSelected ? 'text-orange-400' : isPhysicsBaseline ? 'text-blue-400' : 'text-slate-400'}`}>
                    {label} {isPhysicsBaseline && "(Physics Baseline)"}
                  </span>
                  <span className={`text-[10px] font-mono ${isSelected ? 'text-orange-300' : 'text-slate-500'}`}>
                    Q: {q.toFixed(2)}
                  </span>
                </div>
                {/* Bar Chart inside item */}
                <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden relative z-10">
                  <div 
                    className={`h-full rounded-full transition-all duration-300 ${isSelected ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.8)]' : isPhysicsBaseline ? 'bg-blue-500' : 'bg-slate-600'}`}
                    style={{ width: `${normalize(q)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col justify-center border-l border-slate-800 pl-6 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg">
             <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Q-Table Inference Engine</h4>
             <p className="text-[11px] text-slate-400 leading-relaxed">
               The DQN takes 25 environmental dimensions (sun angle, shadow raycasts, irradiance, regime) and outputs 13 Q-Values representing the predicted reward (energy yield) for each mechanical offset. 
             </p>
          </div>
          
          <div className="bg-slate-900/50 border border-slate-800/50 p-3 rounded-lg flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-orange-900/50 flex items-center justify-center border border-orange-500/30">
               <span className="text-orange-400 font-bold font-mono text-xs">AI</span>
             </div>
             <div>
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">RL Overridden Tracking</p>
                <p className="text-xs font-mono text-slate-300">Reward delta vs Physics: {actionId !== 3 ? 'Active Avoidance' : 'Nominal'}</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
