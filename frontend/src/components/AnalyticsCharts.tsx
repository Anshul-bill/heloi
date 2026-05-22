import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Label } from 'recharts';

interface Props {
  data: any[];
  currentIndex: number;
}

export default function AnalyticsCharts({ data, currentIndex }: Props) {
  const currentDataPoint = data[currentIndex];
  
  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
          <XAxis dataKey="time" stroke="#64748b" fontSize={10} tickFormatter={(val, i) => i % 6 === 0 ? val : ''}>
             <Label value="Time (24h)" offset={-15} position="insideBottom" fill="#64748b" style={{ fontSize: '10px' }} />
          </XAxis>
          <YAxis stroke="#64748b" fontSize={10}>
             <Label value="Yield (Wh)" angle={-90} position="insideLeft" offset={10} fill="#64748b" style={{ fontSize: '10px', textAnchor: 'middle' }} />
          </YAxis>
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          {currentDataPoint && (
              <ReferenceLine x={currentDataPoint.time} stroke="#f97316" strokeDasharray="3 3" />
          )}
          <Line type="monotone" dataKey="energy_ai" name="AI Yield" stroke="#f97316" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="energy_tracker" name="Perfect Tracker" stroke="#3b82f6" strokeWidth={1} dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="energy_fixed" name="Fixed Panel" stroke="#22c55e" strokeWidth={1} dot={false} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
