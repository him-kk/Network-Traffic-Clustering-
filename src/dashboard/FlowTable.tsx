import React, { useState, useMemo, useEffect } from 'react';
import { ArrowUpDown, Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NetworkFlow } from '@/types';

interface FlowTableProps {
  flows:           NetworkFlow[];
  onFlowSelect?:   (flow: NetworkFlow) => void;
  selectedFlowId?: string;
}

type SortField     = 'timestamp' | 'sourceIP' | 'destinationIP' | 'protocol' | 'byteCount' | 'packetCount' | 'duration';
type SortDirection = 'asc' | 'desc';

const FlowTable: React.FC<FlowTableProps> = ({ flows, onFlowSelect, selectedFlowId }) => {
  const [searchQuery,     setSearchQuery]     = useState('');
  const [filterProtocol,  setFilterProtocol]  = useState<string>('all');
  const [sortField,       setSortField]       = useState<SortField>('timestamp');
  const [sortDirection,   setSortDirection]   = useState<SortDirection>('desc');
  const [currentPage,     setCurrentPage]     = useState(1);
  const [pageSize,        setPageSize]        = useState(50);

  // FIX: Reset to page 1 whenever the flow list itself changes length
  //      (data cleared, new flows arrive, filters applied).
  useEffect(() => { setCurrentPage(1); }, [flows.length, filterProtocol, searchQuery]);

  const handleSort = (field: SortField) => {
    setSortField(prev => {
      if (prev === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
      else setSortDirection('desc');
      return field;
    });
  };

  const processed = useMemo(() => {
    let result = [...flows];

    if (filterProtocol !== 'all') result = result.filter(f => f.protocol === filterProtocol);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.sourceIP.toLowerCase().includes(q)      ||
        f.destinationIP.toLowerCase().includes(q) ||
        f.sourcePort.toString().includes(q)       ||
        f.destinationPort.toString().includes(q)  ||
        f.protocol.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'timestamp':      cmp = a.timestamp  - b.timestamp;                    break;
        case 'sourceIP':       cmp = a.sourceIP.localeCompare(b.sourceIP);          break;
        case 'destinationIP':  cmp = a.destinationIP.localeCompare(b.destinationIP); break;
        case 'protocol':       cmp = a.protocol.localeCompare(b.protocol);          break;
        case 'byteCount':      cmp = a.byteCount   - b.byteCount;                   break;
        case 'packetCount':    cmp = a.packetCount - b.packetCount;                 break;
        case 'duration':       cmp = a.duration    - b.duration;                    break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [flows, filterProtocol, searchQuery, sortField, sortDirection]);

  const totalPages    = Math.ceil(processed.length / pageSize);
  // FIX: Clamp currentPage so it never exceeds available pages after data shrinks
  const safePage      = Math.min(currentPage, totalPages || 1);
  const paginated     = processed.slice((safePage - 1) * pageSize, safePage * pageSize);

  const getProtocolColor = (p: string) => ({
    TCP:     'bg-blue-100 text-blue-800',
    UDP:     'bg-green-100 text-green-800',
    ICMP:    'bg-yellow-100 text-yellow-800',
    HTTP:    'bg-purple-100 text-purple-800',
    HTTPS:   'bg-indigo-100 text-indigo-800',
    DNS:     'bg-pink-100 text-pink-800',
    FTP:     'bg-orange-100 text-orange-800',
    SSH:     'bg-teal-100 text-teal-800',
    SMTP:    'bg-lime-100 text-lime-800',
    UNKNOWN: 'bg-gray-100 text-gray-800',
  }[p] ?? 'bg-gray-100 text-gray-800');

  const exportToCSV = () => {
    const headers = ['Timestamp','Source IP','Source Port','Destination IP','Destination Port','Protocol','Bytes','Packets','Duration','Anomaly'];
    const rows    = processed.map(f => [
      new Date(f.timestamp).toISOString(),
      f.sourceIP, f.sourcePort, f.destinationIP, f.destinationPort,
      f.protocol, f.byteCount, f.packetCount,
      f.duration, f.isAnomaly ? 'Yes' : 'No',
    ]);
    const csv  = [headers, ...rows].map(r => r.join(',')).join('\n');
    const url  = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a    = Object.assign(document.createElement('a'), { href: url, download: `flows-${Date.now()}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <ArrowUpDown className="h-3 w-3" />
        {sortField === field && (
          <span className="text-blue-500">{sortDirection === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Network Flows ({processed.length})</span>
          <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
            <Download className="h-4 w-4" />Export CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search flows…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-64"
            />
          </div>

          <Select value={filterProtocol} onValueChange={setFilterProtocol}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Protocol" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Protocols</SelectItem>
              {['TCP','UDP','HTTP','HTTPS','DNS','ICMP','FTP','SSH','SMTP'].map(p => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={pageSize.toString()}
            onValueChange={v => { setPageSize(parseInt(v)); setCurrentPage(1); }}
          >
            <SelectTrigger className="w-32"><SelectValue placeholder="Page size" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 / page</SelectItem>
              <SelectItem value="50">50 / page</SelectItem>
              <SelectItem value="100">100 / page</SelectItem>
              <SelectItem value="200">200 / page</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <ScrollArea className="h-[500px]">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <SortHeader field="timestamp">Time</SortHeader>
                <SortHeader field="sourceIP">Source</SortHeader>
                <SortHeader field="destinationIP">Destination</SortHeader>
                <SortHeader field="protocol">Protocol</SortHeader>
                <SortHeader field="byteCount">Bytes</SortHeader>
                <SortHeader field="packetCount">Packets</SortHeader>
                <SortHeader field="duration">Duration</SortHeader>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    No flows match the current filters
                  </td>
                </tr>
              ) : paginated.map(flow => (
                <tr
                  key={flow.id}
                  className={`
                    hover:bg-gray-50 cursor-pointer transition-colors
                    ${selectedFlowId === flow.id ? 'bg-blue-50' : ''}
                    ${flow.isAnomaly ? 'bg-red-50' : ''}
                  `}
                  onClick={() => onFlowSelect?.(flow)}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {new Date(flow.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {flow.sourceIP}:{flow.sourcePort}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {flow.destinationIP}:{flow.destinationPort}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge className={getProtocolColor(flow.protocol)} variant="secondary">
                      {flow.protocol}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {(flow.byteCount / 1024).toFixed(2)} KB
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {flow.packetCount}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                    {flow.duration.toFixed(2)}s
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {flow.isAnomaly && (
                      <Badge variant="destructive" className="text-xs">Anomaly</Badge>
                    )}
                    {flow.clusterId !== undefined && flow.clusterId >= 0 && !flow.isAnomaly && (
                      <Badge variant="outline" className="text-xs">Cluster {flow.clusterId}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-500">
            {processed.length === 0
              ? 'No flows'
              : `Showing ${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, processed.length)} of ${processed.length}`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">Page {safePage} of {totalPages || 1}</span>
            <Button
              variant="outline" size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages || totalPages === 0}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FlowTable;