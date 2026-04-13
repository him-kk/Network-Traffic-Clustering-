// Anomaly Detection System for Network Traffic
// FIXES:
//  1. ICMP / broadcast / multicast no longer trigger false positives
//  2. Score inflation from typeMultiplier removed
//  3. Flow deduplication before detection
//  4. Timing anomaly skips broadcast destinations
//  5. detectAnomalies merges dedup + cluster outlier detection so callers
//     don't accidentally double-count by calling both methods separately

import type { NetworkFlow, AnomalyDetection, Cluster } from '@/types';
import { AnomalyType, SeverityLevel } from '@/types';
import { extractFeatures, normalizeFeatures, euclideanDistance } from '@/algorithms/utils';

interface Thresholds {
  byteCount:   { mean: number; std: number };
  packetCount: { mean: number; std: number };
  duration:    { mean: number; std: number };
  flowRate:    { mean: number; std: number };
}

// ─── Broadcast / Multicast helpers ─────────────────────────────────────────

const KNOWN_BROADCASTS = new Set([
  '255.255.255.255',
  '224.0.0.1',    // All hosts
  '224.0.0.2',    // All routers
  '224.0.0.251',  // mDNS
  '224.0.0.252',  // LLMNR
  '239.255.255.250', // SSDP / UPnP
]);

function isBroadcastOrMulticast(ip: string): boolean {
  if (KNOWN_BROADCASTS.has(ip)) return true;
  if (ip.endsWith('.255')) return true;           // subnet broadcast
  const first = parseInt(ip.split('.')[0], 10);
  return first >= 224 && first <= 239;            // full multicast range
}

// ─── Deduplication ──────────────────────────────────────────────────────────

function deduplicateFlows(flows: NetworkFlow[]): NetworkFlow[] {
  const seen = new Map<string, NetworkFlow>();
  for (const flow of flows) {
    const key = [
      flow.sourceIP, flow.sourcePort,
      flow.destinationIP, flow.destinationPort,
      flow.protocol, flow.byteCount,
      flow.packetCount, flow.timestamp,
    ].join('|');
    if (!seen.has(key)) seen.set(key, flow);
  }
  return Array.from(seen.values());
}

// ─── Main Detector ──────────────────────────────────────────────────────────

export class AnomalyDetector {
  private thresholds: Thresholds;
  private baselineFlows: NetworkFlow[];
  private portScanThreshold  = 50;
  private ddosThreshold      = 1000;
  private timingThreshold    = 0.05;   // halved — only truly robotic traffic

  constructor() {
    this.baselineFlows = [];
    this.thresholds = {
      byteCount:   { mean: 0, std: 1 },
      packetCount: { mean: 0, std: 1 },
      duration:    { mean: 0, std: 1 },
      flowRate:    { mean: 0, std: 1 },
    };
  }

  public updateBaseline(flows: NetworkFlow[]): void {
    this.baselineFlows = flows;
    this.calculateThresholds(flows);
  }

  private calculateThresholds(flows: NetworkFlow[]): void {
    if (flows.length === 0) return;

    this.thresholds.byteCount   = this.stats(flows.map(f => f.byteCount));
    this.thresholds.packetCount = this.stats(flows.map(f => f.packetCount));
    this.thresholds.duration    = this.stats(flows.map(f => f.duration));

    const timeRange = Math.max(
      1,
      (Math.max(...flows.map(f => f.timestamp)) -
       Math.min(...flows.map(f => f.timestamp))) / 60_000,
    );
    this.thresholds.flowRate = {
      mean: flows.length / timeRange,
      std:  Math.sqrt(flows.length) / timeRange,
    };
  }

  private stats(values: number[]): { mean: number; std: number } {
    const mean     = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return { mean, std: Math.sqrt(variance) };
  }

  // ── Per-flow detection ────────────────────────────────────────────────────

  public detectFlowAnomaly(flow: NetworkFlow): AnomalyDetection {
    const types:  (typeof AnomalyType)[keyof typeof AnomalyType][] = [];
    const scores: number[] = [];

    const check = (
      result: { isAnomaly: boolean; score: number },
      type:   (typeof AnomalyType)[keyof typeof AnomalyType],
    ) => {
      if (result.isAnomaly) { types.push(type); scores.push(result.score); }
    };

    check(this.detectHighVolume(flow),         AnomalyType.HIGH_VOLUME);
    check(this.detectPortScan(flow),           AnomalyType.PORT_SCAN);
    check(this.detectDDoS(flow),               AnomalyType.DDOS);
    check(this.detectDataExfiltration(flow),   AnomalyType.DATA_EXFILTRATION);
    check(this.detectSuspiciousProtocol(flow), AnomalyType.SUSPICIOUS_PROTOCOL);
    check(this.detectTimingAnomaly(flow),      AnomalyType.TIMING_ANOMALY);
    check(this.detectGeographicAnomaly(flow),  AnomalyType.GEO_ANOMALY);

    const score      = scores.length > 0 ? Math.max(...scores) : 0;
    const severity   = this.calculateSeverity(score);
    // Confidence: driven by score; a second corroborating type adds a small boost
    const confidence = Math.min(1, score * 0.75 + (scores.length > 1 ? 0.1 : 0));

    return {
      flow,
      score,
      types,
      severity,
      confidence,
      description:       this.generateDescription(types, flow),
      recommendedAction: this.generateRecommendation(severity),
    };
  }

  // High volume — requires 4σ deviation AND a minimum baseline of 50 flows.
  // With < 50 flows the std is meaningless — one HTTPS packet looks like 10σ.
  private detectHighVolume(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (this.baselineFlows.length < 50) return { isAnomaly: false, score: 0 };
    const bZ = Math.abs(flow.byteCount   - this.thresholds.byteCount.mean)   / (this.thresholds.byteCount.std   || 1);
    const pZ = Math.abs(flow.packetCount - this.thresholds.packetCount.mean) / (this.thresholds.packetCount.std || 1);
    const z  = Math.max(bZ, pZ);
    return { isAnomaly: z > 4, score: Math.min(1, z / 6) };
  }

  // Port scan — unchanged logic, still valid
  private detectPortScan(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    const unique = new Set(
      this.baselineFlows
        .filter(f => f.sourceIP === flow.sourceIP)
        .map(f => f.destinationPort),
    ).size;
    return {
      isAnomaly: unique > this.portScanThreshold,
      score:     Math.min(1, unique / (this.portScanThreshold * 2)),
    };
  }

  // DDoS — skip broadcast/multicast destinations entirely
  private detectDDoS(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (isBroadcastOrMulticast(flow.destinationIP)) return { isAnomaly: false, score: 0 };

    const recent = this.baselineFlows.filter(
      f => f.destinationIP === flow.destinationIP &&
           Math.abs(f.timestamp - flow.timestamp) < 60_000,
    ).length;

    return {
      isAnomaly: recent > this.ddosThreshold,
      score:     Math.min(1, recent / (this.ddosThreshold * 2)),
    };
  }

  // Data exfiltration — only large outbound flows to real external IPs.
  // Also requires minimum baseline — without it, the threshold collapses to ~0.
  private detectDataExfiltration(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (this.baselineFlows.length < 50) return { isAnomaly: false, score: 0 };
    const isOutbound = this.isPrivateIP(flow.sourceIP) &&
                       !this.isPrivateIP(flow.destinationIP) &&
                       !isBroadcastOrMulticast(flow.destinationIP);
    if (!isOutbound) return { isAnomaly: false, score: 0 };

    const threshold = this.thresholds.byteCount.mean + 3 * this.thresholds.byteCount.std;
    // Guard: threshold must be meaningful (> 1 KB) to avoid flagging tiny flows
    if (threshold < 1024) return { isAnomaly: false, score: 0 };
    const isLarge = flow.byteCount > threshold;
    return {
      isAnomaly: isLarge,
      score:     isLarge ? Math.min(1, flow.byteCount / (threshold * 2)) : 0,
    };
  }

  // Suspicious protocol
  // Skip entirely for broadcast/multicast destinations — mDNS, SSDP, IGMP etc. are all normal.
  private detectSuspiciousProtocol(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (isBroadcastOrMulticast(flow.destinationIP)) return { isAnomaly: false, score: 0 };

    if (flow.protocol === 'ICMP') {
      const external   = !this.isPrivateIP(flow.destinationIP);
      const highVolume = this.baselineFlows.length >= 50 &&
                         flow.byteCount > this.thresholds.byteCount.mean + 3 * this.thresholds.byteCount.std;
      return { isAnomaly: external && highVolume, score: external && highVolume ? 0.65 : 0 };
    }

    if (flow.protocol === 'UNKNOWN') return { isAnomaly: true, score: 0.6 };

    const mismatch = this.isPortProtocolMismatch(flow.destinationPort, flow.protocol);
    return { isAnomaly: mismatch, score: mismatch ? 0.55 : 0 };
  }

  // Timing anomaly
  // FIX: Skip broadcast/multicast — they are inherently periodic.
  //      Require ≥10 samples before judging.
  private detectTimingAnomaly(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (isBroadcastOrMulticast(flow.destinationIP)) return { isAnomaly: false, score: 0 };

    const sorted = this.baselineFlows
      .filter(f => f.sourceIP === flow.sourceIP)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (sorted.length < 10) return { isAnomaly: false, score: 0 };

    const iats: number[] = [];
    for (let i = 1; i < sorted.length; i++) iats.push(sorted[i].timestamp - sorted[i - 1].timestamp);

    const mean = iats.reduce((s, t) => s + t, 0) / iats.length;
    const std  = Math.sqrt(iats.reduce((s, t) => s + (t - mean) ** 2, 0) / iats.length);
    const cv   = std / (mean || 1);

    const isAnomaly = cv < this.timingThreshold;
    return {
      isAnomaly,
      score: isAnomaly ? Math.min(1, (this.timingThreshold - cv) / this.timingThreshold) : 0,
    };
  }

  // Geographic anomaly — raised unique-country threshold 5→8
  private detectGeographicAnomaly(flow: NetworkFlow): { isAnomaly: boolean; score: number } {
    if (!flow.geoLocation) return { isAnomaly: false, score: 0 };

    const HIGH_RISK = new Set(['CN', 'RU', 'KP', 'IR']);
    const isHighRisk = HIGH_RISK.has(flow.geoLocation.country);

    const uniqueCountries = new Set(
      this.baselineFlows
        .filter(f => f.sourceIP === flow.sourceIP)
        .map(f => f.geoLocation?.country)
        .filter(Boolean),
    ).size;

    const isAnomaly = isHighRisk || uniqueCountries > 8;
    return {
      isAnomaly,
      score: isAnomaly ? (isHighRisk ? 0.75 : Math.min(1, uniqueCountries / 15)) : 0,
    };
  }

  // ── Cluster outlier detection ─────────────────────────────────────────────

  public detectClusterOutliers(flows: NetworkFlow[], clusters: Cluster[]): AnomalyDetection[] {
    if (flows.length === 0 || clusters.length === 0) return [];

    const features   = flows.map(f => extractFeatures(f));
    const normalized = normalizeFeatures(features);
    const anomalies: AnomalyDetection[] = [];

    for (let i = 0; i < flows.length; i++) {
      const feature = normalized[i];

      let minDist        = Infinity;
      let nearestCluster: Cluster | null = null;

      for (const cluster of clusters) {
        const d = euclideanDistance(feature, cluster.centroid);
        if (d < minDist) { minDist = d; nearestCluster = cluster; }
      }

      if (!nearestCluster) continue;

      // Build per-cluster mean distance
      const clusterNorms = nearestCluster.points
        .map(p => flows.findIndex(f => f.id === p.id))
        .filter(idx => idx >= 0)
        .map(idx => normalized[idx]);

      if (clusterNorms.length === 0) continue;

      const meanDist = clusterNorms.reduce(
        (s, f) => s + euclideanDistance(f, nearestCluster!.centroid), 0,
      ) / clusterNorms.length;

      const threshold = meanDist * 3;
      if (minDist > threshold) {
        const score = Math.min(1, minDist / (threshold * 2));
        anomalies.push({
          flow:              flows[i],
          score,
          types:             [AnomalyType.CLUSTER_OUTLIER],
          severity:          this.calculateSeverity(score),
          confidence:        Math.min(1, minDist / threshold - 1),
          description:       `Outlier from cluster ${nearestCluster.id} (dist: ${minDist.toFixed(2)})`,
          recommendedAction: 'Review flow details and consider blocking if suspicious',
        });
      }
    }

    return anomalies;
  }

  // ── Public batch API ──────────────────────────────────────────────────────

  /**
   * Detect all anomalies (statistical + cluster outliers) in one call.
   * Deduplicates first so the caller doesn't need to.
   * Pass `clusters` if you have them; omit to skip cluster outlier detection.
   */
  public detectAnomalies(flows: NetworkFlow[], clusters?: Cluster[]): AnomalyDetection[] {
    const unique = deduplicateFlows(flows);
    this.updateBaseline(unique);

    const statistical = unique
      .map(flow => this.detectFlowAnomaly(flow))
      .filter(a => a.types.length > 0);

    const outliers = clusters ? this.detectClusterOutliers(unique, clusters) : [];

    // Merge: if a flow already has a statistical anomaly, don't add a cluster outlier for it too
    const statisticalIds = new Set(statistical.map(a => a.flow.id));
    const newOutliers = outliers.filter(o => !statisticalIds.has(o.flow.id));

    return [...statistical, ...newOutliers];
  }

  public getAnomalyStatistics(anomalies: AnomalyDetection[]) {
    const bySeverity: Record<string, number> = {
      [SeverityLevel.LOW]: 0, [SeverityLevel.MEDIUM]: 0,
      [SeverityLevel.HIGH]: 0, [SeverityLevel.CRITICAL]: 0,
    };
    const byType: Partial<Record<string, number>> = {};
    let totalScore = 0;

    for (const a of anomalies) {
      bySeverity[a.severity]++;
      totalScore += a.score;
      for (const t of a.types) byType[t] = (byType[t] ?? 0) + 1;
    }

    return {
      total:      anomalies.length,
      bySeverity: bySeverity as Record<(typeof SeverityLevel)[keyof typeof SeverityLevel], number>,
      byType:     byType     as Record<(typeof AnomalyType)[keyof typeof AnomalyType], number>,
      avgScore:   anomalies.length > 0 ? totalScore / anomalies.length : 0,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private isPrivateIP(ip: string): boolean {
    if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
    const parts = ip.split('.');
    if (parts[0] === '172') {
      const b = parseInt(parts[1], 10);
      if (b >= 16 && b <= 31) return true;
    }
    return false;
  }

  private isPortProtocolMismatch(port: number, protocol: string): boolean {
    const map: Record<number, string[]> = {
      20:   ['FTP', 'FTP-DATA'],
      21:   ['FTP'],
      22:   ['SSH'],
      25:   ['SMTP'],
      53:   ['DNS'],
      67:   ['DHCP', 'UDP'],
      68:   ['DHCP', 'UDP'],
      80:   ['HTTP'],
      123:  ['NTP', 'UDP'],
      137:  ['NetBIOS', 'UDP'],
      138:  ['NetBIOS', 'UDP'],
      139:  ['NetBIOS', 'TCP'],
      443:  ['HTTPS'],
      445:  ['SMB', 'TCP'],
      1900: ['SSDP', 'UDP'],
      5353: ['mDNS', 'DNS', 'UDP'],
      5355: ['LLMNR', 'UDP'],
    };
    const allowed = map[port];
    return allowed != null && !allowed.includes(protocol);
  }

  // FIX: Severity is now score-only — no more typeMultiplier inflation
  private calculateSeverity(score: number): (typeof SeverityLevel)[keyof typeof SeverityLevel] {
    if (score >= 0.85) return SeverityLevel.CRITICAL;
    if (score >= 0.65) return SeverityLevel.HIGH;
    if (score >= 0.40) return SeverityLevel.MEDIUM;
    return SeverityLevel.LOW;
  }

  private generateDescription(
    types: (typeof AnomalyType)[keyof typeof AnomalyType][],
    flow:  NetworkFlow,
  ): string {
    if (types.length === 0) return 'No anomalies detected';
    const map: Record<string, string> = {
      [AnomalyType.HIGH_VOLUME]:         `High traffic volume (${flow.byteCount} bytes, ${flow.packetCount} packets)`,
      [AnomalyType.PORT_SCAN]:           `Port scanning detected from ${flow.sourceIP}`,
      [AnomalyType.DDOS]:                `Possible DDoS toward ${flow.destinationIP}`,
      [AnomalyType.DATA_EXFILTRATION]:   `Large outbound transfer to ${flow.destinationIP}`,
      [AnomalyType.SUSPICIOUS_PROTOCOL]: `Protocol/port mismatch or unknown protocol`,
      [AnomalyType.TIMING_ANOMALY]:      `Robotic timing pattern from ${flow.sourceIP}`,
      [AnomalyType.GEO_ANOMALY]:         `Suspicious geographic origin`,
      [AnomalyType.BEHAVIORAL_ANOMALY]:  `Behavioural anomaly detected`,
      [AnomalyType.CLUSTER_OUTLIER]:     `Statistical outlier from cluster`,
    };
    return types.map(t => map[t] ?? t).join('; ');
  }

  private generateRecommendation(
    severity: (typeof SeverityLevel)[keyof typeof SeverityLevel],
  ): string {
    const map: Record<string, string> = {
      [SeverityLevel.LOW]:      'Monitor for further anomalies',
      [SeverityLevel.MEDIUM]:   'Investigate source and review traffic patterns',
      [SeverityLevel.HIGH]:     'Consider blocking source IP and alerting security team',
      [SeverityLevel.CRITICAL]: 'Immediate action: block source and initiate incident response',
    };
    return map[severity] ?? 'No action required';
  }
}

// ─── Autoencoder Detector ───────────────────────────────────────────────────

export class AutoencoderAnomalyDetector {
  private encoderWeights: number[][];
  private decoderWeights: number[][];
  private threshold = 0.5;

  constructor(inputDim = 19, hiddenDim = 10) {
    this.encoderWeights = this.initWeights(inputDim, hiddenDim);
    this.decoderWeights = this.initWeights(hiddenDim, inputDim);
  }

  private initWeights(i: number, o: number): number[][] {
    return Array(o).fill(null).map(() =>
      Array(i).fill(null).map(() => (Math.random() - 0.5) * 0.1),
    );
  }

  private sigmoid(x: number) { return 1 / (1 + Math.exp(-x)); }

  private encode(v: number[]) {
    return this.encoderWeights.map(w => this.sigmoid(w.reduce((s, c, i) => s + c * v[i], 0)));
  }
  private decode(v: number[]) {
    return this.decoderWeights.map(w => this.sigmoid(w.reduce((s, c, i) => s + c * v[i], 0)));
  }

  public detect(flow: NetworkFlow) {
    const norm  = normalizeFeatures([extractFeatures(flow)])[0];
    const recon = this.decode(this.encode(norm));
    const error = norm.reduce((s, f, i) => s + (f - recon[i]) ** 2, 0) / norm.length;
    return { isAnomaly: error > this.threshold, score: Math.min(1, error / (this.threshold * 2)), reconstruction: recon };
  }

  public setThreshold(t: number) { this.threshold = t; }
}

// ─── Time Series Detector ───────────────────────────────────────────────────

export class TimeSeriesAnomalyDetector {
  private windowSize: number;
  private threshold: number;

  constructor(windowSize = 10, threshold = 2) {
    this.windowSize = windowSize;
    this.threshold  = threshold;
  }

  public detectAnomalies(values: number[]) {
    const out: { index: number; value: number; score: number }[] = [];
    for (let i = this.windowSize; i < values.length; i++) {
      const w    = values.slice(i - this.windowSize, i);
      const mean = w.reduce((s, v) => s + v, 0) / w.length;
      const std  = Math.sqrt(w.reduce((s, v) => s + (v - mean) ** 2, 0) / w.length);
      const z    = Math.abs(values[i] - mean) / (std || 1);
      if (z > this.threshold) out.push({ index: i, value: values[i], score: Math.min(1, z / (this.threshold * 2)) });
    }
    return out;
  }
}

export const anomalyDetector = new AnomalyDetector();