import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart,
  Bar
} from 'recharts';
import type { TimeSeriesPoint } from '@/types';

interface TimeSeriesChartProps {
  data: TimeSeriesPoint[];
  showAnomalies?: boolean;
}

const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ 
  data, 
  showAnomalies = true 
}) => {
  if (data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-gray-500">
        No time series data available
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map(point => ({
    timestamp: new Date(point.timestamp).toLocaleTimeString(),
    flows: point.flowCount,
    bytes: Math.round(point.byteCount / 1024), // Convert to KB
    packets: point.packetCount,
    anomalies: point.anomalyCount
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 10 }}
            interval="preserveStartEnd"
          />
          <YAxis 
            yAxisId="left"
            tick={{ fontSize: 10 }}
          />
          <YAxis 
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 10 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              border: 'none',
              borderRadius: '4px',
              color: 'white'
            }}
          />
          <Legend />
          
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="flows"
            name="Flow Count"
            stroke="#3b82f6"
            fill="#3b82f6"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="bytes"
            name="Bytes (KB)"
            stroke="#10b981"
            fill="#10b981"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          
          {showAnomalies && (
            <Bar
              yAxisId="left"
              dataKey="anomalies"
              name="Anomalies"
              fill="#ef4444"
              opacity={0.7}
              barSize={10}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TimeSeriesChart;
