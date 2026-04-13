import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Cluster } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ClusterDetailsProps {
  cluster?: Cluster;
}

const PROTOCOL_COLORS: Record<string, string> = {
  'TCP': '#3b82f6',
  'UDP': '#10b981',
  'ICMP': '#f59e0b',
  'HTTP': '#8b5cf6',
  'HTTPS': '#6366f1',
  'DNS': '#ec4899',
  'FTP': '#f97316',
  'SSH': '#14b8a6',
  'SMTP': '#84cc16',
  'UNKNOWN': '#94a3b8'
};

const ClusterDetails: React.FC<ClusterDetailsProps> = ({ cluster }) => {
  if (!cluster) {
    return (
      <div className="text-center py-8 text-gray-500">
        No cluster selected
      </div>
    );
  }

  // Prepare protocol distribution data
  const protocolData = Object.entries(cluster.protocolDistribution)
    .filter(([, count]) => count > 0)
    .map(([protocol, count]) => ({
      name: protocol,
      value: count,
      color: PROTOCOL_COLORS[protocol] || '#94a3b8'
    }))
    .sort((a, b) => b.value - a.value);

  const totalFlows = cluster.size;

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Cluster {cluster.id}</h3>
            <p className="text-sm text-gray-500">{cluster.size} flows</p>
          </div>
          <div 
            className="w-8 h-8 rounded-full"
            style={{ backgroundColor: cluster.color }}
          />
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Density</p>
            <p className="text-lg font-semibold">{(cluster.density * 100).toFixed(2)}%</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-xs text-gray-500">Silhouette</p>
            <p className="text-lg font-semibold">{cluster.silhouette.toFixed(3)}</p>
          </div>
        </div>

        {/* Averages */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Averages</h4>
          
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Byte Count</span>
              <span>{(cluster.avgByteCount / 1024).toFixed(2)} KB</span>
            </div>
            <Progress value={Math.min(100, (cluster.avgByteCount / 1e6) * 100)} />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Packet Count</span>
              <span>{cluster.avgPacketCount.toFixed(0)}</span>
            </div>
            <Progress value={Math.min(100, cluster.avgPacketCount)} />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-500">Duration</span>
              <span>{cluster.avgDuration.toFixed(2)}s</span>
            </div>
            <Progress value={Math.min(100, cluster.avgDuration * 10)} />
          </div>
        </div>

        {/* Protocol Distribution */}
        <div>
          <h4 className="text-sm font-medium mb-3">Protocol Distribution</h4>
          
          {protocolData.length > 0 ? (
            <>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={protocolData}
                      cx="50%"
                      cy="50%"
                      innerRadius={30}
                      outerRadius={50}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {protocolData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => [
                        `${value} (${((value / totalFlows) * 100).toFixed(1)}%)`,
                        'Flows'
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-1 mt-2">
                {protocolData.slice(0, 5).map(({ name, value, color }) => (
                  <div key={name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: color }}
                      />
                      <span>{name}</span>
                    </div>
                    <span className="text-gray-500">{value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">No protocol data available</p>
          )}
        </div>

        {/* Centroid */}
        <div>
          <h4 className="text-sm font-medium mb-2">Centroid (Normalized)</h4>
          <div className="bg-gray-50 p-2 rounded text-xs font-mono overflow-x-auto">
            {cluster.centroid.slice(0, 6).map((v, i) => (
              <span key={i} className="mr-2">
                {v.toFixed(3)}
              </span>
            ))}
            ...
          </div>
        </div>

        {/* Bounds */}
        {cluster.bounds && (
          <div>
            <h4 className="text-sm font-medium mb-2">Bounds</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Min:</span>
                <div className="font-mono">
                  {cluster.bounds.min.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...
                </div>
              </div>
              <div className="bg-gray-50 p-2 rounded">
                <span className="text-gray-500">Max:</span>
                <div className="font-mono">
                  {cluster.bounds.max.slice(0, 3).map(v => v.toFixed(2)).join(', ')}...
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sample Flows */}
        <div>
          <h4 className="text-sm font-medium mb-2">Sample Flows</h4>
          <div className="space-y-2">
            {cluster.points.slice(0, 5).map((flow) => (
              <div key={flow.id} className="bg-gray-50 p-2 rounded text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">{flow.sourceIP}</span>
                  <span className="text-gray-500">→</span>
                  <span className="font-medium">{flow.destinationIP}</span>
                </div>
                <div className="flex justify-between text-gray-500 mt-1">
                  <span>{flow.protocol}</span>
                  <span>{(flow.byteCount / 1024).toFixed(1)} KB</span>
                </div>
              </div>
            ))}
            {cluster.points.length > 5 && (
              <p className="text-xs text-gray-500 text-center">
                +{cluster.points.length - 5} more flows
              </p>
            )}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

export default ClusterDetails;
