import React, { useState } from 'react';
import { AlertTriangle, Filter, ChevronDown, ChevronUp, Shield, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnomalyType, SeverityLevel } from '@/types';
import type { AnomalyDetection } from '@/types';

type SeverityLevelValue = typeof SeverityLevel[keyof typeof SeverityLevel];
type AnomalyTypeValue   = typeof AnomalyType[keyof typeof AnomalyType];

interface AnomalyListProps {
  anomalies: AnomalyDetection[];
  onAnomalySelect?: (anomaly: AnomalyDetection) => void;
}

const AnomalyList: React.FC<AnomalyListProps> = ({ anomalies, onAnomalySelect }) => {
  const [filterSeverity, setFilterSeverity] = useState<SeverityLevelValue | 'all'>('all');
  const [filterType, setFilterType]         = useState<AnomalyTypeValue | 'all'>('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [expandedKeys, setExpandedKeys]     = useState<Set<string>>(new Set());
  const [sortBy, setSortBy]                 = useState<'score' | 'time' | 'severity'>('score');

  // FIX: Key uses flow.id + types joined so two anomaly records for the same
  //      flow (e.g. statistical + cluster) never collide.
  const anomalyKey = (a: AnomalyDetection) => `${a.flow.id}::${a.types.join('|')}`;

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getSeverityColor = (severity: SeverityLevelValue): string => {
    switch (severity) {
      case SeverityLevel.CRITICAL: return 'bg-red-500 hover:bg-red-600';
      case SeverityLevel.HIGH:     return 'bg-orange-500 hover:bg-orange-600';
      case SeverityLevel.MEDIUM:   return 'bg-yellow-500 hover:bg-yellow-600';
      case SeverityLevel.LOW:      return 'bg-blue-500 hover:bg-blue-600';
      default:                     return 'bg-gray-500 hover:bg-gray-600';
    }
  };

  const getSeverityIcon = (severity: SeverityLevelValue) => {
    switch (severity) {
      case SeverityLevel.CRITICAL:
      case SeverityLevel.HIGH:
        return <AlertTriangle className="h-4 w-4" />;
      case SeverityLevel.MEDIUM:
        return <Shield className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const severityOrder: Record<SeverityLevelValue, number> = {
    [SeverityLevel.CRITICAL]: 4,
    [SeverityLevel.HIGH]:     3,
    [SeverityLevel.MEDIUM]:   2,
    [SeverityLevel.LOW]:      1,
  };

  const filtered = anomalies
    .filter(a => {
      if (filterSeverity !== 'all' && a.severity !== filterSeverity) return false;
      if (filterType    !== 'all' && !a.types.includes(filterType))  return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          a.flow.sourceIP.toLowerCase().includes(q)      ||
          a.flow.destinationIP.toLowerCase().includes(q) ||
          a.types.some(t => t.toLowerCase().includes(q)) ||
          a.description.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'score':    return b.score - a.score;
        case 'severity': return (severityOrder[b.severity as SeverityLevelValue] ?? 0) -
                                (severityOrder[a.severity as SeverityLevelValue] ?? 0);
        case 'time':
        default:         return b.flow.timestamp - a.flow.timestamp;
      }
    });

  const stats = {
    total:    anomalies.length,
    critical: anomalies.filter(a => a.severity === SeverityLevel.CRITICAL).length,
    high:     anomalies.filter(a => a.severity === SeverityLevel.HIGH).length,
    medium:   anomalies.filter(a => a.severity === SeverityLevel.MEDIUM).length,
    low:      anomalies.filter(a => a.severity === SeverityLevel.LOW).length,
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-4">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-red-500">Critical</p>
          <p className="text-2xl font-bold text-red-600">{stats.critical}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-orange-500">High</p>
          <p className="text-2xl font-bold text-orange-600">{stats.high}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-yellow-500">Medium</p>
          <p className="text-2xl font-bold text-yellow-600">{stats.medium}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-blue-500">Low</p>
          <p className="text-2xl font-bold text-blue-600">{stats.low}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select value={filterSeverity} onValueChange={v => setFilterSeverity(v as SeverityLevelValue | 'all')}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {Object.values(SeverityLevel).map(l => (
                  <SelectItem key={l} value={l}>{l.charAt(0).toUpperCase() + l.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={v => setFilterType(v as AnomalyTypeValue | 'all')}>
              <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.values(AnomalyType).map(t => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={v => setSortBy(v as 'score' | 'time' | 'severity')}>
              <SelectTrigger className="w-32"><SelectValue placeholder="Sort by" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="score">Score</SelectItem>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="time">Time</SelectItem>
              </SelectContent>
            </Select>

            <Input
              placeholder="Search IP, type…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48"
            />
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Anomalies ({filtered.length})</span>
            {filtered.length !== anomalies.length && (
              <span className="text-xs text-gray-500">
                Showing {filtered.length} of {anomalies.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No anomalies match the current filters
                </div>
              ) : (
                filtered.map(anomaly => {
                  const key = anomalyKey(anomaly);
                  const expanded = expandedKeys.has(key);
                  return (
                    <div
                      key={key}
                      className="border rounded-lg overflow-hidden hover:border-gray-400 transition-colors"
                    >
                      {/* Row header */}
                      <div
                        className="p-3 cursor-pointer bg-gray-50 hover:bg-gray-100"
                        onClick={() => toggleExpand(key)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Badge className={getSeverityColor(anomaly.severity as SeverityLevelValue)}>
                              {getSeverityIcon(anomaly.severity as SeverityLevelValue)}
                              <span className="ml-1">{anomaly.severity}</span>
                            </Badge>
                            <span className="font-medium text-sm">{anomaly.types.join(', ')}</span>
                            <span className="text-xs text-gray-500">
                              Score: {(anomaly.score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {new Date(anomaly.flow.timestamp).toLocaleTimeString()}
                            </span>
                            {expanded
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </div>
                        </div>

                        <div className="mt-2 text-sm text-gray-600">
                          {anomaly.flow.sourceIP}:{anomaly.flow.sourcePort}
                          {' → '}
                          {anomaly.flow.destinationIP}:{anomaly.flow.destinationPort}
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {expanded && (
                        <div className="p-3 bg-white border-t">
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Description:</span>
                              <p className="text-gray-600">{anomaly.description}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <span className="font-medium">Protocol:</span>{' '}
                                <span className="text-gray-600">{anomaly.flow.protocol}</span>
                              </div>
                              <div>
                                <span className="font-medium">Bytes:</span>{' '}
                                <span className="text-gray-600">{anomaly.flow.byteCount.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="font-medium">Packets:</span>{' '}
                                <span className="text-gray-600">{anomaly.flow.packetCount}</span>
                              </div>
                              <div>
                                <span className="font-medium">Duration:</span>{' '}
                                <span className="text-gray-600">{anomaly.flow.duration.toFixed(2)}s</span>
                              </div>
                            </div>

                            <div>
                              <span className="font-medium">Confidence:</span>{' '}
                              <span className="text-gray-600">{(anomaly.confidence * 100).toFixed(1)}%</span>
                            </div>

                            <div className="bg-yellow-50 p-2 rounded">
                              <span className="font-medium text-yellow-800">Recommended Action:</span>
                              <p className="text-yellow-700">{anomaly.recommendedAction}</p>
                            </div>

                            <div className="flex gap-2 pt-2">
                              <Button size="sm" variant="outline" onClick={() => onAnomalySelect?.(anomaly)}>
                                View Flow Details
                              </Button>
                              <Button size="sm" variant="destructive">Block Source</Button>
                              <Button size="sm" variant="secondary">Whitelist</Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnomalyList;