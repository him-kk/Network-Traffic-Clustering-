// Network Traffic Data Generation and Packet Simulation

import type { NetworkFlow, TrafficStatistics, TimeSeriesPoint, TopTalker } from '@/types';
import { ProtocolType, AnomalyType } from '@/types';

// IP address utilities
export function generateRandomIP(): string {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

export function generatePrivateIP(): string {
  const ranges = [
    { base: [10, 0, 0, 0], mask: 8 },
    { base: [172, 16, 0, 0], mask: 12 },
    { base: [192, 168, 0, 0], mask: 16 }
  ];
  const range = ranges[Math.floor(Math.random() * ranges.length)];
  return `${range.base[0]}.${range.base[1] + Math.floor(Math.random() * (256 - range.base[1]))}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

export function generatePublicIP(): string {
  // Generate IPs that are not in private ranges
  let ip: string;
  do {
    ip = generateRandomIP();
  } while (
    ip.startsWith('10.') ||
    ip.startsWith('172.16.') ||
    ip.startsWith('172.17.') ||
    ip.startsWith('172.18.') ||
    ip.startsWith('172.19.') ||
    ip.startsWith('172.20.') ||
    ip.startsWith('172.21.') ||
    ip.startsWith('172.22.') ||
    ip.startsWith('172.23.') ||
    ip.startsWith('172.24.') ||
    ip.startsWith('172.25.') ||
    ip.startsWith('172.26.') ||
    ip.startsWith('172.27.') ||
    ip.startsWith('172.28.') ||
    ip.startsWith('172.29.') ||
    ip.startsWith('172.30.') ||
    ip.startsWith('172.31.') ||
    ip.startsWith('192.168.')
  );
  return ip;
}

// Port utilities
const WELL_KNOWN_PORTS: Record<number, ProtocolType> = {
  20: ProtocolType.FTP,
  21: ProtocolType.FTP,
  22: ProtocolType.SSH,
  25: ProtocolType.SMTP,
  53: ProtocolType.DNS,
  80: ProtocolType.HTTP,
  110: ProtocolType.SMTP,
  143: ProtocolType.SMTP,
  443: ProtocolType.HTTPS,
  993: ProtocolType.SMTP,
  995: ProtocolType.SMTP,
};

export function generatePort(protocol?: ProtocolType): number {
  if (protocol && protocol !== ProtocolType.TCP && protocol !== ProtocolType.UDP) {
    const ports = Object.entries(WELL_KNOWN_PORTS)
      .filter(([, p]) => p === protocol)
      .map(([port]) => parseInt(port));
    if (ports.length > 0) {
      return ports[Math.floor(Math.random() * ports.length)];
    }
  }
  
  // Random port
  return Math.floor(Math.random() * 65535) + 1;
}

export function getProtocolFromPort(port: number): ProtocolType {
  return WELL_KNOWN_PORTS[port] || ProtocolType.TCP;
}

// TCP flags generation
export function generateTCPFlags(protocol: ProtocolType): NetworkFlow['flags'] {
  if (protocol !== ProtocolType.TCP && protocol !== ProtocolType.HTTP && protocol !== ProtocolType.HTTPS) {
    return { syn: false, ack: false, fin: false, rst: false, psh: false, urg: false };
  }

  const rand = Math.random();
  if (rand < 0.3) {
    // SYN packet
    return { syn: true, ack: false, fin: false, rst: false, psh: false, urg: false };
  } else if (rand < 0.6) {
    // ACK packet
    return { syn: false, ack: true, fin: false, rst: false, psh: Math.random() > 0.5, urg: false };
  } else if (rand < 0.8) {
    // FIN packet
    return { syn: false, ack: true, fin: true, rst: false, psh: false, urg: false };
  } else if (rand < 0.9) {
    // RST packet
    return { syn: false, ack: false, fin: false, rst: true, psh: false, urg: false };
  } else {
    // Mixed
    return {
      syn: Math.random() > 0.8,
      ack: Math.random() > 0.3,
      fin: Math.random() > 0.9,
      rst: Math.random() > 0.95,
      psh: Math.random() > 0.6,
      urg: Math.random() > 0.98
    };
  }
}

// Geo location generation
export function generateGeoLocation(): NetworkFlow['geoLocation'] {
  const countries = ['US', 'CN', 'RU', 'DE', 'GB', 'FR', 'JP', 'BR', 'IN', 'KR'];
  const cities: Record<string, string[]> = {
    'US': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'],
    'CN': ['Beijing', 'Shanghai', 'Guangzhou', 'Shenzhen', 'Chengdu'],
    'RU': ['Moscow', 'Saint Petersburg', 'Novosibirsk', 'Yekaterinburg', 'Kazan'],
    'DE': ['Berlin', 'Hamburg', 'Munich', 'Cologne', 'Frankfurt'],
    'GB': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'],
    'FR': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice'],
    'JP': ['Tokyo', 'Yokohama', 'Osaka', 'Nagoya', 'Sapporo'],
    'BR': ['São Paulo', 'Rio de Janeiro', 'Brasília', 'Salvador', 'Fortaleza'],
    'IN': ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],
    'KR': ['Seoul', 'Busan', 'Incheon', 'Daegu', 'Daejeon']
  };

  const country = countries[Math.floor(Math.random() * countries.length)];
  const cityList = cities[country] || ['Unknown'];
  const city = cityList[Math.floor(Math.random() * cityList.length)];

  return {
    country,
    city,
    latitude: (Math.random() - 0.5) * 180,
    longitude: (Math.random() - 0.5) * 360,
    asn: `AS${Math.floor(Math.random() * 60000) + 1000}`,
    isp: `ISP-${Math.floor(Math.random() * 1000)}`
  };
}

// Generate a single network flow
export function generateFlow(options?: {
  timestamp?: number;
  sourceIP?: string;
  destinationIP?: string;
  sourcePort?: number;
  destinationPort?: number;
  protocol?: ProtocolType;
  isAnomaly?: boolean;
  anomalyType?: AnomalyType;
}): NetworkFlow {
  const timestamp = options?.timestamp || Date.now();
  const protocol = options?.protocol || Object.values(ProtocolType)[Math.floor(Math.random() * 7)];
  
  let sourceIP = options?.sourceIP;
  let destinationIP = options?.destinationIP;
  
  if (!sourceIP) {
    sourceIP = Math.random() > 0.3 ? generatePrivateIP() : generatePublicIP();
  }
  if (!destinationIP) {
    destinationIP = Math.random() > 0.5 ? generatePublicIP() : generatePrivateIP();
  }

  const sourcePort = options?.sourcePort || generatePort(protocol);
  const destinationPort = options?.destinationPort || generatePort(protocol);

  // Generate packet and byte counts based on protocol
  let packetCount: number;
  let byteCount: number;
  let duration: number;

  if (options?.isAnomaly) {
    // Anomalous traffic patterns
    switch (options.anomalyType) {
      case AnomalyType.HIGH_VOLUME:
        packetCount = Math.floor(Math.random() * 10000) + 5000;
        byteCount = packetCount * (Math.floor(Math.random() * 1500) + 500);
        duration = Math.random() * 60;
        break;
      case AnomalyType.PORT_SCAN:
        packetCount = Math.floor(Math.random() * 100) + 50;
        byteCount = packetCount * 64;
        duration = Math.random() * 10;
        break;
      case AnomalyType.DDOS:
        packetCount = Math.floor(Math.random() * 100000) + 50000;
        byteCount = packetCount * 100;
        duration = Math.random() * 5;
        break;
      default:
        packetCount = Math.floor(Math.random() * 1000) + 100;
        byteCount = packetCount * (Math.floor(Math.random() * 1000) + 100);
        duration = Math.random() * 300;
    }
  } else {
    // Normal traffic patterns
    packetCount = Math.floor(Math.random() * 100) + 1;
    byteCount = packetCount * (Math.floor(Math.random() * 500) + 64);
    duration = Math.random() * 60;
  }

  const flags = generateTCPFlags(protocol);
  const ttl = Math.floor(Math.random() * 128) + 32;
  const windowSize = Math.floor(Math.random() * 65535);

  return {
    id: `${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp,
    sourceIP,
    destinationIP,
    sourcePort,
    destinationPort,
    protocol,
    packetCount,
    byteCount,
    duration,
    flags,
    ttl,
    windowSize,
    payload: Array(Math.floor(Math.random() * 100)).fill(0).map(() => Math.floor(Math.random() * 256)),
    isAnomaly: options?.isAnomaly || false,
    anomalyType: options?.isAnomaly ? [options.anomalyType!] : undefined,
    geoLocation: generateGeoLocation()
  };
}

// Generate multiple flows
export function generateFlows(count: number, options?: {
  startTime?: number;
  duration?: number;
  anomalyRatio?: number;
}): NetworkFlow[] {
  const flows: NetworkFlow[] = [];
  const startTime = options?.startTime || Date.now() - 3600000;
  const duration = options?.duration || 3600000;
  const anomalyRatio = options?.anomalyRatio || 0.05;

  for (let i = 0; i < count; i++) {
    const timestamp = startTime + Math.random() * duration;
    const isAnomaly = Math.random() < anomalyRatio;
    const anomalyTypes = Object.values(AnomalyType);
    const anomalyType = isAnomaly 
      ? anomalyTypes[Math.floor(Math.random() * 5)]
      : undefined;

    flows.push(generateFlow({
      timestamp,
      isAnomaly,
      anomalyType
    }));
  }

  return flows.sort((a, b) => a.timestamp - b.timestamp);
}

// Generate realistic traffic patterns
export function generateRealisticTraffic(
  duration: number = 3600000,
  baseRate: number = 100
): NetworkFlow[] {
  const flows: NetworkFlow[] = [];
  const startTime = Date.now() - duration;
  
  // Define traffic patterns
  const patterns = [
    { start: 0, end: 0.2, rate: baseRate * 0.5 },      // Low activity
    { start: 0.2, end: 0.4, rate: baseRate * 1.5 },    // Morning peak
    { start: 0.4, end: 0.6, rate: baseRate },          // Normal
    { start: 0.6, end: 0.8, rate: baseRate * 2 },      // Evening peak
    { start: 0.8, end: 1, rate: baseRate * 0.3 }       // Night low
  ];

  for (const pattern of patterns) {
    const patternStart = startTime + pattern.start * duration;
    const patternEnd = startTime + pattern.end * duration;
    const patternDuration = patternEnd - patternStart;
    const flowCount = Math.floor(pattern.rate * (patternDuration / 60000));

    for (let i = 0; i < flowCount; i++) {
      const timestamp = patternStart + Math.random() * patternDuration;
      flows.push(generateFlow({ timestamp }));
    }
  }

  // Add some anomalies
  const anomalyCount = Math.floor(flows.length * 0.02);
  for (let i = 0; i < anomalyCount; i++) {
    const timestamp = startTime + Math.random() * duration;
    const anomalyTypes = Object.values(AnomalyType);
    const anomalyType = anomalyTypes[Math.floor(Math.random() * 5)];
    flows.push(generateFlow({ timestamp, isAnomaly: true, anomalyType }));
  }

  return flows.sort((a, b) => a.timestamp - b.timestamp);
}

// Calculate traffic statistics
export function calculateStatistics(flows: NetworkFlow[]): TrafficStatistics {
  const totalFlows = flows.length;
  const totalBytes = flows.reduce((sum, f) => sum + f.byteCount, 0);
  const totalPackets = flows.reduce((sum, f) => sum + f.packetCount, 0);
  const avgFlowDuration = flows.reduce((sum, f) => sum + f.duration, 0) / (totalFlows || 1);

  // Protocol distribution
  const protocolDistribution: Record<string, number> = {};
  flows.forEach(f => {
    protocolDistribution[f.protocol] = (protocolDistribution[f.protocol] || 0) + 1;
  });

  // Top talkers
  const ipStats: Record<string, { flowCount: number; byteCount: number; packetCount: number }> = {};
  flows.forEach(f => {
    if (!ipStats[f.sourceIP]) {
      ipStats[f.sourceIP] = { flowCount: 0, byteCount: 0, packetCount: 0 };
    }
    ipStats[f.sourceIP].flowCount++;
    ipStats[f.sourceIP].byteCount += f.byteCount;
    ipStats[f.sourceIP].packetCount += f.packetCount;
  });

  const topTalkers: TopTalker[] = Object.entries(ipStats)
    .map(([ip, stats]) => ({
      ip,
      flowCount: stats.flowCount,
      byteCount: stats.byteCount,
      packetCount: stats.packetCount,
      geoLocation: flows.find(f => f.sourceIP === ip)?.geoLocation
    }))
    .sort((a, b) => b.byteCount - a.byteCount)
    .slice(0, 10);

  // Port distribution
  const portDistribution: Record<number, number> = {};
  flows.forEach(f => {
    portDistribution[f.destinationPort] = (portDistribution[f.destinationPort] || 0) + 1;
  });

  // Time series data
  const timeSeriesData = generateTimeSeries(flows);

  // Anomaly count
  const anomalyCount = flows.filter(f => f.isAnomaly).length;

  return {
    totalFlows,
    totalBytes,
    totalPackets,
    avgFlowDuration,
    protocolDistribution,
    topTalkers,
    portDistribution,
    timeSeriesData,
    anomalyCount,
    clusterCount: 0
  };
}

// Generate time series data
function generateTimeSeries(flows: NetworkFlow[]): TimeSeriesPoint[] {
  if (flows.length === 0) return [];

  const sortedFlows = [...flows].sort((a, b) => a.timestamp - b.timestamp);
  const startTime = sortedFlows[0].timestamp;
  const endTime = sortedFlows[sortedFlows.length - 1].timestamp;
  const interval = Math.max(60000, Math.floor((endTime - startTime) / 100)); // Max 100 points

  const timeSeries: TimeSeriesPoint[] = [];
  let currentTime = startTime;

  while (currentTime <= endTime) {
    const intervalFlows = sortedFlows.filter(
      f => f.timestamp >= currentTime && f.timestamp < currentTime + interval
    );

    timeSeries.push({
      timestamp: currentTime,
      flowCount: intervalFlows.length,
      byteCount: intervalFlows.reduce((sum, f) => sum + f.byteCount, 0),
      packetCount: intervalFlows.reduce((sum, f) => sum + f.packetCount, 0),
      anomalyCount: intervalFlows.filter(f => f.isAnomaly).length
    });

    currentTime += interval;
  }

  return timeSeries;
}

// Simulate packet capture
export interface SimulatedPacket {
  timestamp: number;
  sourceIP: string;
  destinationIP: string;
  sourcePort: number;
  destinationPort: number;
  protocol: ProtocolType;
  length: number;
  payload: Uint8Array;
  flags?: NetworkFlow['flags'];
}

export function simulatePacketCapture(flow: NetworkFlow): SimulatedPacket[] {
  const packets: SimulatedPacket[] = [];
  const packetSize = Math.floor(flow.byteCount / flow.packetCount);

  for (let i = 0; i < flow.packetCount; i++) {
    packets.push({
      timestamp: flow.timestamp + (i * flow.duration / flow.packetCount),
      sourceIP: flow.sourceIP,
      destinationIP: flow.destinationIP,
      sourcePort: flow.sourcePort,
      destinationPort: flow.destinationPort,
      protocol: flow.protocol,
      length: packetSize,
      payload: new Uint8Array(flow.payload.slice(0, Math.min(flow.payload.length, packetSize))),
      flags: flow.flags
    });
  }

  return packets;
}

// Generate attack patterns
export function generateAttackPattern(
  attackType: AnomalyType,
  targetIP: string,
  duration: number = 60000,
  intensity: number = 1000
): NetworkFlow[] {
  const flows: NetworkFlow[] = [];
  const startTime = Date.now();

  switch (attackType) {
    case AnomalyType.DDOS:
      // DDoS: Many sources, one target
      for (let i = 0; i < intensity; i++) {
        flows.push(generateFlow({
          timestamp: startTime + Math.random() * duration,
          destinationIP: targetIP,
          isAnomaly: true,
          anomalyType: AnomalyType.DDOS
        }));
      }
      break;

    case AnomalyType.PORT_SCAN:
      // Port scan: One source, many ports
      const scannerIP = generatePublicIP();
      for (let i = 0; i < intensity; i++) {
        flows.push(generateFlow({
          timestamp: startTime + Math.random() * duration,
          sourceIP: scannerIP,
          destinationIP: targetIP,
          destinationPort: Math.floor(Math.random() * 65535) + 1,
          isAnomaly: true,
          anomalyType: AnomalyType.PORT_SCAN
        }));
      }
      break;

    case AnomalyType.DATA_EXFILTRATION:
      // Data exfiltration: Large outbound transfer
      const insiderIP = generatePrivateIP();
      for (let i = 0; i < intensity / 10; i++) {
        flows.push(generateFlow({
          timestamp: startTime + Math.random() * duration,
          sourceIP: insiderIP,
          isAnomaly: true,
          anomalyType: AnomalyType.DATA_EXFILTRATION
        }));
      }
      break;

    default:
      // Generic high volume
      for (let i = 0; i < intensity; i++) {
        flows.push(generateFlow({
          timestamp: startTime + Math.random() * duration,
          isAnomaly: true,
          anomalyType: attackType
        }));
      }
  }

  return flows.sort((a, b) => a.timestamp - b.timestamp);
}

// Export all functions
export default {
  generateRandomIP,
  generatePrivateIP,
  generatePublicIP,
  generatePort,
  getProtocolFromPort,
  generateTCPFlags,
  generateGeoLocation,
  generateFlow,
  generateFlows,
  generateRealisticTraffic,
  calculateStatistics,
  simulatePacketCapture,
  generateAttackPattern
};
