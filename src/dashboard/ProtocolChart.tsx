import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ProtocolType } from '@/types';

interface ProtocolChartProps {
  distribution: Record<string, number>;
}

const COLORS: Record<string, string> = {
  [ProtocolType.TCP]:     '#3b82f6',
  [ProtocolType.UDP]:     '#10b981',
  [ProtocolType.ICMP]:    '#f59e0b',
  [ProtocolType.HTTP]:    '#8b5cf6',
  [ProtocolType.HTTPS]:   '#6366f1',
  [ProtocolType.DNS]:     '#ec4899',
  [ProtocolType.FTP]:     '#f97316',
  [ProtocolType.SSH]:     '#14b8a6',
  [ProtocolType.SMTP]:    '#84cc16',
  [ProtocolType.UNKNOWN]: '#94a3b8',
  OTHER:                  '#cbd5e1',
};

const MAX_SLICES = 8;

const ProtocolChart: React.FC<ProtocolChartProps> = ({ distribution }) => {
  // Sort by count descending, take top MAX_SLICES, group rest as OTHER
  const sorted = Object.entries(distribution)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  const top    = sorted.slice(0, MAX_SLICES);
  const rest   = sorted.slice(MAX_SLICES);
  const others = rest.reduce((sum, [, v]) => sum + v, 0);

  const data = [
    ...top.map(([protocol, count]) => ({
      name:  protocol,
      value: count,
      color: COLORS[protocol] ?? '#94a3b8',
    })),
    ...(others > 0 ? [{ name: 'OTHER', value: others, color: COLORS.OTHER }] : []),
  ];

  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No protocol data — start monitoring to see traffic
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((entry, i) => (
              <Cell key={`cell-${i}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [
              `${value.toLocaleString()} (${((value / total) * 100).toFixed(1)}%)`,
              'Flows',
            ]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ fontSize: 11 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ProtocolChart;