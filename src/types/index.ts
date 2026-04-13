// Network Traffic Clustering Platform - Type Definitions

export interface NetworkFlow {
  id: string;
  timestamp: number;
  sourceIP: string;
  destinationIP: string;
  sourcePort: number;
  destinationPort: number;
  protocol: string;
  packetCount: number;
  byteCount: number;
  duration: number;
  flags: TCPFlags;
  ttl: number;
  windowSize: number;
  payload: number[];
  labels?: string[];
  clusterId?: number;
  anomalyScore?: number;
  isAnomaly?: boolean;
  anomalyType?: string[];
  geoLocation?: GeoLocation;
}

export interface TCPFlags {
  syn: boolean;
  ack: boolean;
  fin: boolean;
  rst: boolean;
  psh: boolean;
  urg: boolean;
}

export interface GeoLocation {
  country: string;
  city: string;
  latitude: number;
  longitude: number;
  asn: string;
  isp: string;
}

export interface Cluster {
  id: number;
  centroid: number[];
  points: NetworkFlow[];
  size: number;
  density: number;
  silhouette: number;
  protocolDistribution: Record<string, number>;
  avgByteCount: number;
  avgPacketCount: number;
  avgDuration: number;
  color: string;
  bounds?: {
    min: number[];
    max: number[];
  };
}

export interface ClusteringResult {
  clusters: Cluster[];
  noise: NetworkFlow[];
  iterations: number;
  convergence: boolean;
  silhouetteScore: number;
  inertia?: number;
  executionTime: number;
  algorithm: string;
  parameters: AlgorithmParameters;
}

export interface AlgorithmParameters {
  k?: number;
  epsilon?: number;
  minPoints?: number;
  linkage?: string;
  distanceMetric?: string;
  bandwidth?: number;
  maxIterations?: number;
  convergenceThreshold?: number;
  kernel?: string;
  nu?: number;
  nEstimators?: number;
  contamination?: number;
  useKMeansPlusPlus?: boolean;
}

export interface AnomalyDetection {
  flow: NetworkFlow;
  score: number;
  types: string[];
  severity: string;
  confidence: number;
  description: string;
  recommendedAction: string;
}

export interface TrafficStatistics {
  totalFlows: number;
  totalBytes: number;
  totalPackets: number;
  avgFlowDuration: number;
  protocolDistribution: Record<string, number>;
  topTalkers: TopTalker[];
  portDistribution: Record<number, number>;
  timeSeriesData: TimeSeriesPoint[];
  anomalyCount: number;
  clusterCount: number;
}

export interface TopTalker {
  ip: string;
  flowCount: number;
  byteCount: number;
  packetCount: number;
  geoLocation?: GeoLocation;
  reputation?: ReputationScore;
}

export interface ReputationScore {
  score: number;
  category: string;
  lastReported: number;
}

export interface TimeSeriesPoint {
  timestamp: number;
  flowCount: number;
  byteCount: number;
  packetCount: number;
  anomalyCount: number;
}

export interface VisualizationConfig {
  width: number;
  height: number;
  padding: number;
  colors: string[];
  showLabels: boolean;
  showGrid: boolean;
  animationEnabled: boolean;
  pointRadius: number;
  clusterOpacity: number;
}

export interface ExportConfig {
  format: string;
  includeFlows: boolean;
  includeClusters: boolean;
  includeAnomalies: boolean;
  includeStatistics: boolean;
  dateRange?: { start: number; end: number };
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: string;
  enabled: boolean;
  notificationChannels: NotificationChannel[];
  cooldown: number;
  lastTriggered?: number;
}

export interface AlertCondition {
  metric: string;
  operator: string;
  threshold: number;
  timeWindow: number;
}

export interface NotificationChannel {
  type: string;
  config: Record<string, string>;
}

export interface MLModel {
  id: string;
  name: string;
  type: string;
  version: string;
  trainedAt: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  features: string[];
  parameters: AlgorithmParameters;
  weights?: number[];
}

export interface FeatureVector {
  flow: NetworkFlow;
  features: number[];
  featureNames: string[];
}

export interface DimensionalityReduction {
  method: string;
  components: number[][];
  explainedVariance: number[];
}

export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export interface DashboardState {
  isMonitoring: boolean;
  selectedAlgorithm: string;
  algorithmParams: AlgorithmParameters;
  flows: NetworkFlow[];
  clusters: Cluster[];
  anomalies: AnomalyDetection[];
  statistics: TrafficStatistics;
  selectedTimeRange: number | string;
  refreshRate: number;
  autoClustering: boolean;
  showAnomaliesOnly: boolean;
}

export interface NetworkNode {
  id: string;
  ip: string;
  type: string;
  x?: number;
  y?: number;
  z?: number;
  fx?: number | null;
  fy?: number | null;
  connections: string[];
  flowCount: number;
  byteCount: number;
  isAnomaly: boolean;
  clusterId?: number;
}

export interface NetworkEdge {
  source: string | NetworkNode;
  target: string | NetworkNode;
  weight: number;
  protocol: string;
  flowCount: number;
  byteCount: number;
  isAnomaly: boolean;
}

export interface PCAPPacket {
  timestamp: number;
  length: number;
  ethType: number;
  ipVersion: number;
  protocol: number;
  sourceIP: string;
  destinationIP: string;
  sourcePort?: number;
  destinationPort?: number;
  payload: Uint8Array;
}

export interface ReportConfig {
  title: string;
  sections: ReportSection[];
  schedule?: ReportSchedule;
  recipients: string[];
}

export interface ReportSection {
  type: string;
  title: string;
  config?: Record<string, unknown>;
}

export interface ReportSchedule {
  frequency: 'hourly' | 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number;
  hour: number;
  minute: number;
}

// Constants
export const ProtocolType = {
  TCP: 'TCP',
  UDP: 'UDP',
  ICMP: 'ICMP',
  HTTP: 'HTTP',
  HTTPS: 'HTTPS',
  DNS: 'DNS',
  FTP: 'FTP',
  SSH: 'SSH',
  SMTP: 'SMTP',
  UNKNOWN: 'UNKNOWN'
} as const;

export const ClusteringAlgorithm = {
  KMEANS: 'K-Means',
  KMEANS_PLUS_PLUS: 'K-Means++',
  DBSCAN: 'DBSCAN',
  HIERARCHICAL: 'Hierarchical',
  MEAN_SHIFT: 'Mean Shift',
  SPECTRAL: 'Spectral',
  GMM: 'Gaussian Mixture Model',
  SOM: 'Self-Organizing Map',
  ISOLATION_FOREST: 'Isolation Forest',
  ONE_CLASS_SVM: 'One-Class SVM'
} as const;

export const LinkageMethod = {
  SINGLE: 'single',
  COMPLETE: 'complete',
  AVERAGE: 'average',
  WARD: 'ward',
  CENTROID: 'centroid'
} as const;

export const DistanceMetric = {
  EUCLIDEAN: 'euclidean',
  MANHATTAN: 'manhattan',
  COSINE: 'cosine',
  CHEBYSHEV: 'chebyshev',
  MINKOWSKI: 'minkowski',
  MAHALANOBIS: 'mahalanobis'
} as const;

export const KernelType = {
  RBF: 'rbf',
  LINEAR: 'linear',
  POLY: 'poly',
  SIGMOID: 'sigmoid'
} as const;

export const AnomalyType = {
  HIGH_VOLUME: 'High Volume',
  PORT_SCAN: 'Port Scan',
  DDOS: 'DDoS Attack',
  DATA_EXFILTRATION: 'Data Exfiltration',
  SUSPICIOUS_PROTOCOL: 'Suspicious Protocol',
  TIMING_ANOMALY: 'Timing Anomaly',
  GEO_ANOMALY: 'Geographic Anomaly',
  BEHAVIORAL_ANOMALY: 'Behavioral Anomaly',
  CLUSTER_OUTLIER: 'Cluster Outlier'
} as const;

export const SeverityLevel = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const;

export const ExportFormat = {
  JSON: 'json',
  CSV: 'csv',
  PCAP: 'pcap',
  PDF: 'pdf',
  XML: 'xml'
} as const;

export const AlertMetric = {
  FLOW_COUNT: 'flow_count',
  BYTE_COUNT: 'byte_count',
  PACKET_COUNT: 'packet_count',
  ANOMALY_COUNT: 'anomaly_count',
  CLUSTER_DENSITY: 'cluster_density',
  PROTOCOL_RATIO: 'protocol_ratio'
} as const;

export const ComparisonOperator = {
  GREATER_THAN: '>',
  LESS_THAN: '<',
  EQUALS: '=',
  GREATER_THAN_OR_EQUAL: '>=',
  LESS_THAN_OR_EQUAL: '<='
} as const;

export const NotificationType = {
  EMAIL: 'email',
  SLACK: 'slack',
  WEBHOOK: 'webhook',
  TEAMS: 'teams',
  SMS: 'sms'
} as const;

export const ReductionMethod = {
  PCA: 'PCA',
  T_SNE: 't-SNE',
  UMAP: 'UMAP',
  LDA: 'LDA'
} as const;

export const MessageType = {
  FLOW_DATA: 'flow_data',
  CLUSTER_UPDATE: 'cluster_update',
  ANOMALY_ALERT: 'anomaly_alert',
  STATS_UPDATE: 'stats_update',
  CONTROL_COMMAND: 'control_command',
  CONFIG_UPDATE: 'config_update'
} as const;

export const TimeRange = {
  LAST_5_MINUTES: 5 * 60 * 1000,
  LAST_15_MINUTES: 15 * 60 * 1000,
  LAST_30_MINUTES: 30 * 60 * 1000,
  LAST_HOUR: 60 * 60 * 1000,
  LAST_6_HOURS: 6 * 60 * 60 * 1000,
  LAST_24_HOURS: 24 * 60 * 60 * 1000,
  CUSTOM: 'custom'
} as const;

export const NodeType = {
  SOURCE: 'source',
  DESTINATION: 'destination',
  GATEWAY: 'gateway',
  SERVER: 'server',
  CLIENT: 'client'
} as const;

export const ReportSectionType = {
  SUMMARY: 'summary',
  STATISTICS: 'statistics',
  CLUSTERS: 'clusters',
  ANOMALIES: 'anomalies',
  TRENDS: 'trends',
  TOP_TALKERS: 'top_talkers',
  PROTOCOL_DISTRIBUTION: 'protocol_distribution',
  GEO_MAP: 'geo_map'
} as const;
