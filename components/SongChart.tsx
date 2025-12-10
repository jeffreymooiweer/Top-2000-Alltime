import React, { memo, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { SongData } from '../types';

interface SongChartProps {
  song: SongData;
}

const SongChart: React.FC<SongChartProps> = memo(({ song }) => {
  // Transform ranking map to array, sort by year
  const data = useMemo(() => {
    return Object.entries(song.rankings)
      .map(([year, rank]) => ({
        year,
        rank: rank === null ? null : rank, // null breaks line in recharts usually, or we can filter
      }))
      .filter(item => item.rank !== null) // Filter out years where it wasn't listed for cleaner line
      .sort((a, b) => parseInt(a.year) - parseInt(b.year));
  }, [song.rankings]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 p-3 rounded shadow-xl text-xs">
          <p className="font-bold text-[#d00018]">{label}</p>
          <p className="text-gray-800">Positie: <span className="font-bold">#{payload[0].value}</span></p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-64 mt-4">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="year" 
            stroke="#6b7280" 
            tick={{fontSize: 10}} 
            tickMargin={10}
            interval="preserveStartEnd"
          />
          <YAxis 
            stroke="#6b7280" 
            reversed={true} // Invert Y axis so #1 is top
            domain={[1, 'auto']} 
            tick={{fontSize: 10}}
            width={40}
          />
          <Tooltip content={<CustomTooltip />} cursor={{stroke: '#9ca3af', strokeWidth: 1}} />
          <ReferenceLine y={1} stroke="#d00018" strokeDasharray="3 3" opacity={0.5} label={{ value: '#1', position: 'insideTopLeft', fill: '#d00018', fontSize: 10 }} />
          <Line 
            type="monotone" 
            dataKey="rank" 
            stroke="#d00018" 
            strokeWidth={3} 
            dot={{ fill: '#d00018', r: 3 }} 
            activeDot={{ r: 6, stroke: '#d00018', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
});

SongChart.displayName = 'SongChart';

export default SongChart;