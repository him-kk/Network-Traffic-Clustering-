import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Play,
  Pause,
  Settings,
  Download,
  AlertTriangle,
  Activity,
  Network,
  BarChart3,
  PieChart,
  Clock,
  RefreshCw,
  Zap,
  Shield,
  Database,
  Cpu,
  Globe
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';

import type {
  NetworkFlow,
  Cluster,
  ClusteringResult,
  AlgorithmParameters,
  AnomalyDetection,
  TrafficStatistics
} from '@/types';

import { KMeansClustering } from '@/algorithms/kmeans';
import { DBSCANClustering } from '@/algorithms/dbscan';
import { HierarchicalClustering } from '@/algorithms/hierarchical';
import { MeanShiftClustering, GaussianMixtureModel, SelfOrganizingMap, IsolationForest } from '@/algorithms/advanced';
import { exportFlowsToCSV, exportFlowsToJSON, exportFlowsToPCAP } from '@/data/importExport';
import { calculateStatistics } from '@/data/trafficGenerator';
import { AnomalyDetector } from '@/anomaly/detector';
import { generateReport, sendReportToAPI } from '@/data/reporting';
import { importPCAPFromFile, mergeFlows } from '@/data/pcapParser';
import { MLPipeline } from '@/data/mlPipeline';
import PCAPUpload from '@/components/ui/pcap-upload';
import ClusterCanvas from '@/visualization/ClusterCanvas';
import Cluster3D from '@/visualization/Cluster3D';
import NetworkTopology from '@/visualization/NetworkTopology';
import ProtocolChart from './ProtocolChart';
import TimeSeriesChart from './TimeSeriesChart';
import AnomalyList from './AnomalyList';
import FlowTable from './FlowTable';
import ClusterDetails from './ClusterDetails';
import ExportDialog from './ExportDialog';

const CLUSTERING_ALGORITHMS = [
  'K-Means',
  'K-Means++',
  'DBSCAN',
  'Hierarchical',
  'Mean Shift',
  'Spectral',
  'Gaussian Mixture Model',
  'Self-Organizing Map',
  'Isolation Forest',
  'One-Class SVM'
] as const;

type ClusteringAlgorithmType = typeof CLUSTERING_ALGORITHMS[number];

interface ServerInterface {
  index: string;
  name: string;
  description: string;
}

// WebSocket reconnection config
const WS_URL             = 'ws://localhost:8080';
const WS_RECONNECT_DELAY = 3_000;   // ms between reconnect attempts
const WS_MAX_RETRIES     = 10;

const Dashboard: React.FC = () => {
  // Core state
  const [isMonitoring, setIsMonitoring]           = useState(false);
  const [flows, setFlows]                         = useState<NetworkFlow[]>([]);
  const [clusters, setClusters]                   = useState<Cluster[]>([]);
  const [anomalies, setAnomalies]                 = useState<AnomalyDetection[]>([]);
  const [statistics, setStatistics]               = useState<TrafficStatistics | null>(null);
  const [selectedAlgorithm, setSelectedAlgorithm] = useState<ClusteringAlgorithmType>('K-Means++');
  const [algorithmParams, setAlgorithmParams]     = useState<AlgorithmParameters>({ k: 5 });
  const [selectedCluster, setSelectedCluster]     = useState<number | null>(null);
  const [selectedFlow, setSelectedFlow]           = useState<NetworkFlow | null>(null);
  const [refreshRate, setRefreshRate]             = useState(5);
  const [showAnomaliesOnly, setShowAnomaliesOnly] = useState(false);
  const [autoClustering, setAutoClustering]       = useState(true);
  const [activeTab, setActiveTab]                 = useState('overview');
  const [wsConnected, setWsConnected]             = useState(false);
  const [exportOpen, setExportOpen]               = useState(false);

  // Interface selector
  const [availableInterfaces, setAvailableInterfaces] = useState<ServerInterface[]>([]);
  const [selectedInterface, setSelectedInterface]     = useState<string>('6');

  // Reporting
  const [report, setReport]           = useState('');
  const [reportStatus, setReportStatus] = useState('');

  // ML
  const [trainedModels, setTrainedModels] = useState<any[]>([]);

  // Refs
  const anomalyDetector  = useRef(new AnomalyDetector());
  const mlPipeline       = useRef(new MLPipeline());
  const isClusteringRef  = useRef(false);
  const wsRef            = useRef<WebSocket | null>(null);
  const reconnectTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount       = useRef(0);
  const unmounted        = useRef(false);

  // ── Statistics ──────────────────────────────────────────────────────────

  const updateStatistics = useCallback((currentFlows: NetworkFlow[]) => {
    setStatistics(calculateStatistics(currentFlows));
  }, []);

  // ── Clustering ──────────────────────────────────────────────────────────

  const runClustering = useCallback(() => {
    if (flows.length === 0 || isClusteringRef.current) return;
    isClusteringRef.current = true;

    const toCluster = showAnomaliesOnly ? flows.filter(f => f.isAnomaly) : flows;
    if (toCluster.length === 0) { isClusteringRef.current = false; return; }

    let result: ClusteringResult;

    try {
      switch (selectedAlgorithm) {
        case 'K-Means':
          result = new KMeansClustering({ ...algorithmParams, useKMeansPlusPlus: false }).cluster(toCluster); break;
        case 'K-Means++':
          result = new KMeansClustering({ ...algorithmParams, useKMeansPlusPlus: true }).cluster(toCluster); break;
        case 'DBSCAN':
          result = new DBSCANClustering(algorithmParams).cluster(toCluster); break;
        case 'Hierarchical':
          result = new HierarchicalClustering(algorithmParams).cluster(toCluster); break;
        case 'Mean Shift':
          result = new MeanShiftClustering(algorithmParams).cluster(toCluster); break;
        case 'Gaussian Mixture Model':
          result = new GaussianMixtureModel(algorithmParams).cluster(toCluster); break;
        case 'Self-Organizing Map':
          result = new SelfOrganizingMap(algorithmParams).cluster(toCluster); break;
        case 'Isolation Forest':
          result = new IsolationForest(algorithmParams).cluster(toCluster); break;
        default:
          result = new KMeansClustering({ k: 5, useKMeansPlusPlus: true }).cluster(toCluster);
      }

      setClusters(result.clusters);

      // FIX: Single detectAnomalies call — passes clusters so outlier detection
      //      is merged internally. This prevents double-counting that was
      //      inflating the anomaly list to 500+ entries.
      const detected = anomalyDetector.current.detectAnomalies(flows, result.clusters);
      setAnomalies(detected);

      toast.success(`Clustering completed: ${result.clusters.length} clusters, ${detected.length} anomalies`);
    } catch (error) {
      toast.error('Clustering failed: ' + (error as Error).message);
    } finally {
      isClusteringRef.current = false;
    }
  }, [flows, selectedAlgorithm, algorithmParams, showAnomaliesOnly]);

  // Auto-cluster debounced
  useEffect(() => {
    if (!autoClustering || flows.length === 0) return;
    const t = setTimeout(() => runClustering(), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flows.length, autoClustering, selectedAlgorithm, JSON.stringify(algorithmParams)]);

  // ── WebSocket with auto-reconnect ───────────────────────────────────────

  const connectWebSocket = useCallback(() => {
    if (unmounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    let ws: WebSocket;
    try {
      ws = new WebSocket(WS_URL);
    } catch {
      scheduleReconnect();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) { ws.close(); return; }
      retryCount.current = 0;
      setWsConnected(true);
      console.log('✅ WebSocket connected to server');
      toast.success('✅ Server connected');
    };

    ws.onmessage = (event) => {
      if (unmounted.current) return;
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'flow_data': {
            if (!data.payload) break;
            const flow = data.payload as NetworkFlow;
            setFlows(prev => {
              const updated = [...prev, flow].slice(-1000);
              updateStatistics(updated);
              return updated;
            });
            break;
          }
          case 'interfaces': {
            const ifaces: ServerInterface[] = data.interfaces ?? [];
            setAvailableInterfaces(ifaces);
            const wifi     = ifaces.find(i => i.description.toLowerCase().includes('wi-fi'));
            const ethernet = ifaces.find(i => i.description.toLowerCase().includes('ethernet'));
            const best     = wifi ?? ethernet ?? ifaces[0];
            if (best) setSelectedInterface(best.index);
            toast.info(`Found ${ifaces.length} network interfaces`);
            break;
          }
          case 'capture_started': {
            const label = availableInterfaces.find(i => i.index === data.interface)?.description ?? data.interface;
            toast.success(`✅ Capturing on: ${label}`);
            break;
          }
          case 'capture_stopped': {
            setIsMonitoring(false);
            toast.info('⏹️ Capture stopped by server');
            break;
          }
          case 'error': {
            toast.error(`Server error: ${data.message}`);
            setIsMonitoring(false);
            break;
          }
          default:
            console.warn('Unknown WS message type:', data.type);
        }
      } catch (e) {
        console.error('Failed to parse WS message:', e);
      }
    };

    ws.onerror = (e) => {
      console.error('❌ WebSocket error', e);
      // onclose will fire next and trigger reconnect
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setWsConnected(false);
      setIsMonitoring(false);
      console.warn('⚠️ WebSocket closed');
      scheduleReconnect();
    };
  }, [availableInterfaces, updateStatistics]);

  const scheduleReconnect = useCallback(() => {
    if (unmounted.current) return;
    if (retryCount.current >= WS_MAX_RETRIES) {
      toast.error(`Could not reach server after ${WS_MAX_RETRIES} attempts. Run: node server.cjs`);
      return;
    }
    retryCount.current++;
    const delay = WS_RECONNECT_DELAY * Math.min(retryCount.current, 4); // back-off up to 4×
    console.log(`Reconnecting in ${delay}ms (attempt ${retryCount.current})`);
    reconnectTimer.current = setTimeout(() => connectWebSocket(), delay);
  }, [connectWebSocket]);

  // Mount / unmount
  useEffect(() => {
    unmounted.current = false;
    // No fake data — all flows come from the WebSocket server
    connectWebSocket();

    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Controls ────────────────────────────────────────────────────────────

  const toggleMonitoring = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      toast.error('❌ Not connected to server. Reconnecting…');
      connectWebSocket();
      return;
    }
    if (isMonitoring) {
      wsRef.current.send(JSON.stringify({ type: 'stop_capture' }));
      setIsMonitoring(false);
      toast.info('⏹️ Stopping capture…');
    } else {
      wsRef.current.send(JSON.stringify({ type: 'start_capture', interface: selectedInterface }));
      setIsMonitoring(true);
      toast.info(`▶️ Starting capture on interface ${selectedInterface}…`);
    }
  }, [isMonitoring, selectedInterface, connectWebSocket]);

  const injectAnomaly = useCallback(() => {
    const injected: NetworkFlow[] = Array.from({ length: 5 }, (_, i) => ({
      id:              `anomaly-${Date.now()}-${i}`,
      timestamp:       Date.now(),
      sourceIP:        '192.168.1.100',
      destinationIP:   '203.0.113.42',   // TEST-NET-3, clearly external
      sourcePort:      Math.floor(Math.random() * 65535) + 1,
      destinationPort: [80, 443, 22, 3389][Math.floor(Math.random() * 4)],
      protocol:        'TCP',
      packetCount:     Math.floor(Math.random() * 10000) + 5000,
      byteCount:       Math.floor(Math.random() * 1_000_000) + 100_000,
      duration:        Math.random() * 5,
      flags:           { syn: true, ack: false, fin: false, rst: false, psh: false, urg: false },
      ttl:             64,
      windowSize:      65535,
      payload:         [],
      isAnomaly:       true,
    }));
    setFlows(prev => [...prev, ...injected].slice(-1000));
    toast.warning('5 test anomaly flows injected');
  }, []);

  const clearData = useCallback(() => {
    setFlows([]);
    setClusters([]);
    setAnomalies([]);
    setStatistics(null);
    toast.info('All data cleared');
  }, []);

  const exportData = useCallback((format: string, config: any) => {
    const exportFlows = config.includeFlows ? flows : [];
    let blob: Blob;
    let filename = `network-traffic-${Date.now()}`;

    if (format === 'csv') {
      blob = new Blob([exportFlowsToCSV(exportFlows)], { type: 'text/csv' });
      filename += '.csv';
    } else if (format === 'pcap') {
      blob = new Blob([exportFlowsToPCAP(exportFlows)], { type: 'application/octet-stream' });
      filename += '.pcap';
    } else {
      blob = new Blob([exportFlowsToJSON(exportFlows)], { type: 'application/json' });
      filename += '.json';
    }

    const url = URL.createObjectURL(blob);
    const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Data exported');
  }, [flows]);

  const handleTrainModel = useCallback(async () => {
    await mlPipeline.current.trainModel(flows, selectedAlgorithm, algorithmParams);
    setTrainedModels(mlPipeline.current.listModels());
    toast.success(`${selectedAlgorithm} model trained!`);
  }, [flows, selectedAlgorithm, algorithmParams]);

  const handleGenerateReport = useCallback(() => {
    const config = {
      title:      'Network Traffic Report',
      sections:   [
        { type: 'summary',   title: 'Summary' },
        { type: 'flows',     title: 'Sample Flows' },
        { type: 'anomalies', title: 'Sample Anomalies' },
      ],
      recipients: [],
    };
    setReport(generateReport(config, { flows, anomalies, statistics }));
    setReportStatus('Report generated');
  }, [flows, anomalies, statistics]);

  const handleSendReport = useCallback(async () => {
    setReportStatus('Sending…');
    const ok = await sendReportToAPI(report, 'https://example.com/api/report');
    setReportStatus(ok ? 'Report sent!' : 'Failed to send');
  }, [report]);

  const handlePCAPImport = useCallback(async (file: File) => {
    try {
      toast.loading('Importing PCAP file…');
      const imported = await importPCAPFromFile(file);
      const merged   = mergeFlows(imported);
      setFlows(prev => {
        const updated = [...prev, ...merged];
        updateStatistics(updated);
        return updated;
      });
      toast.success(`Imported ${merged.length} flows from ${file.name}`);
    } catch (error) {
      toast.error('PCAP import failed: ' + (error as Error).message);
    }
  }, [updateStatistics]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ML / Reporting bar */}
      <div className="p-4 bg-white border-b border-gray-200 flex gap-4 items-center flex-wrap">
        <Button variant="outline" size="sm" onClick={handleTrainModel}>
          Train {selectedAlgorithm} Model
        </Button>
        <div>
          <span className="font-semibold text-sm">Trained Models:</span>
          {trainedModels.length === 0 ? (
            <span className="ml-2 text-gray-500 text-sm">None</span>
          ) : trainedModels.map((m: any) => (
            <span key={m.id} className="inline-block mr-2 text-xs bg-gray-100 px-2 py-1 rounded">
              {m.name} ({m.version})
            </span>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={handleGenerateReport}>Generate Report</Button>
        <Button variant="outline" size="sm" onClick={handleSendReport} disabled={!report}>Send Report</Button>
        {reportStatus && <span className="ml-2 text-xs text-gray-500">{reportStatus}</span>}

        {/* FIX: WebSocket status indicator so users know connection state */}
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-green-500' : 'bg-red-400 animate-pulse'}`} />
          <span className="text-gray-500">{wsConnected ? 'Server connected' : 'Reconnecting…'}</span>
        </div>
      </div>

      {report && (
        <div className="p-4 bg-gray-50 border-b border-gray-200">
          <h3 className="font-semibold mb-2 text-sm">Report Preview</h3>
          <pre className="text-xs whitespace-pre-wrap bg-white p-2 rounded border max-h-48 overflow-auto">{report}</pre>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Network className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Network Traffic Clustering</h1>
                <p className="text-xs text-gray-500">Real-time Network Analysis & Anomaly Detection</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={isMonitoring ? 'destructive' : 'default'}
                size="sm"
                onClick={toggleMonitoring}
                className="gap-2"
              >
                {isMonitoring ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                {isMonitoring ? 'Stop' : 'Start'} Monitoring
              </Button>

              <Button variant="outline" size="sm" onClick={injectAnomaly} className="gap-2">
                <Zap className="h-4 w-4" />
                Inject Anomaly
              </Button>

              <Dialog open={exportOpen} onOpenChange={setExportOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Download className="h-4 w-4" />
                    Export
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Export Data</DialogTitle></DialogHeader>
                  <ExportDialog onExport={exportData} onClose={() => setExportOpen(false)} />
                </DialogContent>
              </Dialog>

              <PCAPUpload onImport={handlePCAPImport} />
              <Button variant="outline" size="sm" onClick={clearData}>Clear</Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Total Flows</p>
                  <p className="text-2xl font-bold">{statistics.totalFlows.toLocaleString()}</p></div>
                <Activity className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Total Bytes</p>
                  <p className="text-2xl font-bold">{(statistics.totalBytes / 1e9).toFixed(2)} GB</p></div>
                <Database className="h-8 w-8 text-green-500" />
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Clusters</p>
                  <p className="text-2xl font-bold">{clusters.length}</p></div>
                <Cpu className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent></Card>

            <Card><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-sm text-gray-500">Anomalies</p>
                  <p className="text-2xl font-bold text-red-600">{anomalies.length}</p></div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent></Card>
          </div>
        )}

        {/* Config */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />Configuration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Network Interface</Label>
                <Select value={selectedInterface} onValueChange={setSelectedInterface} disabled={isMonitoring}>
                  <SelectTrigger><SelectValue placeholder="Select interface…" /></SelectTrigger>
                  <SelectContent>
                    {availableInterfaces.length === 0 ? (
                      <SelectItem value={selectedInterface}>Interface {selectedInterface} (connecting…)</SelectItem>
                    ) : availableInterfaces.map(iface => (
                      <SelectItem key={iface.index} value={iface.index}>
                        {iface.index}. {iface.description}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {isMonitoring && <p className="text-xs text-gray-400">Stop capture to change interface</p>}
              </div>

              <div className="space-y-2">
                <Label>Algorithm</Label>
                <Select value={selectedAlgorithm} onValueChange={v => setSelectedAlgorithm(v as ClusteringAlgorithmType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLUSTERING_ALGORITHMS.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Clusters (k)</Label>
                <Slider
                  value={[algorithmParams.k || 5]}
                  onValueChange={([v]) => setAlgorithmParams(p => ({ ...p, k: v }))}
                  min={2} max={20} step={1}
                />
                <span className="text-xs text-gray-500">{algorithmParams.k || 5}</span>
              </div>

              <div className="space-y-2">
                <Label>Refresh Rate (seconds)</Label>
                <Slider value={[refreshRate]} onValueChange={([v]) => setRefreshRate(v)} min={1} max={60} step={1} />
                <span className="text-xs text-gray-500">{refreshRate}s</span>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="auto-cluster">Auto Clustering</Label>
                  <Switch id="auto-cluster" checked={autoClustering} onCheckedChange={setAutoClustering} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="show-anomalies">Show Anomalies Only</Label>
                  <Switch id="show-anomalies" checked={showAnomaliesOnly} onCheckedChange={setShowAnomaliesOnly} />
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button onClick={runClustering} className="gap-2">
                <RefreshCw className="h-4 w-4" />Run Clustering
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview"  className="gap-2"><BarChart3 className="h-4 w-4" />Overview</TabsTrigger>
            <TabsTrigger value="clusters"  className="gap-2"><Network   className="h-4 w-4" />Clusters</TabsTrigger>
            <TabsTrigger value="topology"  className="gap-2"><Globe     className="h-4 w-4" />Topology</TabsTrigger>
            <TabsTrigger value="anomalies" className="gap-2">
              <Shield className="h-4 w-4" />Anomalies
              {anomalies.length > 0 && <Badge variant="destructive" className="ml-1">{anomalies.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="flows" className="gap-2"><Database className="h-4 w-4" />Flows</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <PieChart className="h-4 w-4" />Protocol Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statistics && <ProtocolChart distribution={statistics.protocolDistribution} />}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Clock className="h-4 w-4" />Traffic Over Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {statistics && <TimeSeriesChart data={statistics.timeSeriesData} />}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">Top Talkers</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  {statistics?.topTalkers.slice(0, 5).map((talker, i) => (
                    <div key={talker.ip} className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-xs text-gray-500">#{i + 1} {talker.ip}</p>
                      <p className="text-lg font-semibold">{(talker.byteCount / 1e6).toFixed(2)} MB</p>
                      <p className="text-xs text-gray-500">{talker.flowCount} flows</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clusters" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader><CardTitle className="text-sm">2D Cluster Visualization</CardTitle></CardHeader>
                  <CardContent>
                    <ClusterCanvas
                      flows={flows} clusters={clusters}
                      selectedCluster={selectedCluster}
                      onClusterSelect={setSelectedCluster}
                      onFlowSelect={setSelectedFlow}
                      width={600} height={400}
                    />
                  </CardContent>
                </Card>
              </div>
              <div>
                <Card className="h-full">
                  <CardHeader><CardTitle className="text-sm">Cluster Details</CardTitle></CardHeader>
                  <CardContent>
                    {selectedCluster !== null ? (
                      <ClusterDetails cluster={clusters.find(c => c.id === selectedCluster)} />
                    ) : (
                      <div className="text-center text-gray-500 py-8">Select a cluster to view details</div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
            <Card>
              <CardHeader><CardTitle className="text-sm">3D Cluster Visualization</CardTitle></CardHeader>
              <CardContent>
                <Cluster3D
                  flows={flows} clusters={clusters}
                  selectedCluster={selectedCluster}
                  onClusterSelect={setSelectedCluster}
                  onFlowSelect={setSelectedFlow}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="topology">
            <Card>
              <CardHeader><CardTitle className="text-sm">Network Topology</CardTitle></CardHeader>
              <CardContent>
                <NetworkTopology
                  flows={flows} width={1100} height={600}
                  onNodeSelect={node => toast.info(`Selected: ${node.ip}`)}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="anomalies">
            <AnomalyList anomalies={anomalies} onAnomalySelect={a => setSelectedFlow(a.flow)} />
          </TabsContent>

          <TabsContent value="flows">
            <FlowTable flows={flows} onFlowSelect={setSelectedFlow} selectedFlowId={selectedFlow?.id} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Dashboard;