// K-Means and K-Means++ Clustering Implementation

import type { NetworkFlow, Cluster, ClusteringResult, AlgorithmParameters } from '@/types';
import { DistanceMetric } from '@/types';
import { normalizeFeatures, extractFeatures, euclideanDistance } from './utils';

type DistanceMetricValue = typeof DistanceMetric[keyof typeof DistanceMetric];

export class KMeansClustering {
  private k: number;
  private maxIterations: number;
  private convergenceThreshold: number;
  private distanceMetric: DistanceMetricValue;
  private useKMeansPlusPlus: boolean;

  // FIX: Read useKMeansPlusPlus from params object (where Dashboard puts it),
  //      not from a second positional argument (which Dashboard never passes).
  constructor(params: AlgorithmParameters) {
    this.k                   = params.k || 3;
    this.maxIterations       = params.maxIterations || 100;
    this.convergenceThreshold = params.convergenceThreshold || 0.0001;
    this.distanceMetric      = (params.distanceMetric as DistanceMetricValue) || DistanceMetric.EUCLIDEAN;
    this.useKMeansPlusPlus   = params.useKMeansPlusPlus ?? false;
  }

  public cluster(flows: NetworkFlow[]): ClusteringResult {
    const startTime = performance.now();

    if (flows.length === 0) {
      return this.emptyResult(0);
    }

    // FIX: Cap k to the number of flows — can't have more clusters than points
    const k = Math.min(this.k, flows.length);

    // Extract and normalize features
    const features           = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);

    // Initialize centroids
    let centroids = this.useKMeansPlusPlus
      ? this.kMeansPlusPlusInit(normalizedFeatures, k)
      : this.randomInit(normalizedFeatures, k);

    let assignments: number[] = new Array(flows.length).fill(-1);
    let iterations            = 0;
    let converged             = false;
    let previousInertia       = Infinity;

    while (iterations < this.maxIterations && !converged) {
      const newAssignments = this.assignPoints(normalizedFeatures, centroids);
      const newCentroids   = this.updateCentroids(normalizedFeatures, newAssignments, k);
      const inertia        = this.calculateInertia(normalizedFeatures, newAssignments, newCentroids);

      const assignmentChanged = !this.arraysEqual(assignments, newAssignments);
      const inertiaChanged    = Math.abs(previousInertia - inertia) > this.convergenceThreshold;

      converged       = !assignmentChanged && !inertiaChanged;
      assignments     = newAssignments;
      centroids       = newCentroids;
      previousInertia = inertia;
      iterations++;
    }

    const clusters = this.buildClusters(flows, normalizedFeatures, assignments, centroids, k);

    // FIX: Silhouette is O(n²) — sample max 200 points so it never freezes
    //      the browser on large real-traffic datasets (500–1000 flows).
    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, assignments, k);

    return {
      clusters,
      noise:          [],
      iterations,
      convergence:    converged,
      silhouetteScore,
      inertia:        previousInertia,
      executionTime:  performance.now() - startTime,
      algorithm:      this.useKMeansPlusPlus ? 'K-Means++' : 'K-Means',
      parameters:     { k, useKMeansPlusPlus: this.useKMeansPlusPlus },
    };
  }

  // ── Initialization ────────────────────────────────────────────────────────

  private randomInit(features: number[][], k: number): number[][] {
    const used      = new Set<number>();
    const centroids: number[][] = [];
    while (centroids.length < k && used.size < features.length) {
      const idx = Math.floor(Math.random() * features.length);
      if (!used.has(idx)) { centroids.push([...features[idx]]); used.add(idx); }
    }
    return centroids;
  }

  private kMeansPlusPlusInit(features: number[][], k: number): number[][] {
    const n         = features.length;
    const centroids: number[][] = [];
    centroids.push([...features[Math.floor(Math.random() * n)]]);

    const distances = new Array(n).fill(Infinity);

    while (centroids.length < k) {
      let total = 0;
      for (let i = 0; i < n; i++) {
        const d    = this.minDist(features[i], centroids);
        distances[i] = d * d;
        total       += distances[i];
      }

      const threshold = Math.random() * total;
      let   cumulative = 0;
      let   selected   = 0;
      for (let i = 0; i < n; i++) {
        cumulative += distances[i];
        if (cumulative >= threshold) { selected = i; break; }
      }
      centroids.push([...features[selected]]);
    }
    return centroids;
  }

  private minDist(point: number[], centroids: number[][]): number {
    let min = Infinity;
    for (const c of centroids) min = Math.min(min, euclideanDistance(point, c));
    return min;
  }

  // ── Core algorithm ────────────────────────────────────────────────────────

  private assignPoints(features: number[][], centroids: number[][]): number[] {
    return features.map(point => {
      let minDist = Infinity;
      let closest = 0;
      for (let i = 0; i < centroids.length; i++) {
        const d = euclideanDistance(point, centroids[i]);
        if (d < minDist) { minDist = d; closest = i; }
      }
      return closest;
    });
  }

  private updateCentroids(features: number[][], assignments: number[], k: number): number[][] {
    const dim      = features[0].length;
    const sums     = Array.from({ length: k }, () => new Array(dim).fill(0));
    const counts   = new Array(k).fill(0);

    for (let i = 0; i < features.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (let j = 0; j < dim; j++) sums[c][j] += features[i][j];
    }

    return sums.map((sum, i) =>
      counts[i] > 0 ? sum.map(v => v / counts[i]) : sum,
    );
  }

  private calculateInertia(features: number[][], assignments: number[], centroids: number[][]): number {
    return features.reduce((total, point, i) =>
      total + euclideanDistance(point, centroids[assignments[i]]) ** 2, 0,
    );
  }

  // ── Cluster building ──────────────────────────────────────────────────────

  private buildClusters(
    flows:      NetworkFlow[],
    features:   number[][],
    assignments: number[],
    centroids:  number[][],
    k:          number,
  ): Cluster[] {
    const colors = this.generateColors(k);

    return Array.from({ length: k }, (_, i) => {
      const points = flows
        .map((f, idx) => ({ f, idx }))
        .filter(({ idx }) => assignments[idx] === i)
        .map(({ f }) => ({ ...f, clusterId: i }));

      return {
        id:                   i,
        centroid:             centroids[i],
        points,
        size:                 points.length,
        density:              points.length / (flows.length || 1),
        silhouette:           0,
        protocolDistribution: this.protocolDist(points),
        avgByteCount:         points.reduce((s, p) => s + p.byteCount,   0) / (points.length || 1),
        avgPacketCount:       points.reduce((s, p) => s + p.packetCount, 0) / (points.length || 1),
        avgDuration:          points.reduce((s, p) => s + p.duration,    0) / (points.length || 1),
        color:                colors[i],
      } satisfies Cluster;
    });
  }

  private protocolDist(points: NetworkFlow[]): Record<string, number> {
    return points.reduce((acc, p) => {
      acc[p.protocol] = (acc[p.protocol] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // ── Silhouette — sampled to stay O(m²) where m ≤ 200 ────────────────────

  private calculateSilhouetteScore(
    features:    number[][],
    assignments: number[],
    k:           number,
  ): number {
    const n = features.length;
    if (n < 2 || k < 2) return 0;

    // Sample up to 200 points to avoid O(n²) freeze on large captures
    const MAX_SAMPLE = 200;
    let indices: number[];
    if (n <= MAX_SAMPLE) {
      indices = Array.from({ length: n }, (_, i) => i);
    } else {
      const shuffled = Array.from({ length: n }, (_, i) => i)
        .sort(() => Math.random() - 0.5);
      indices = shuffled.slice(0, MAX_SAMPLE);
    }

    let total = 0;
    let valid = 0;

    for (const i of indices) {
      const ci = assignments[i];

      // a(i) — mean dist to same cluster
      let a = 0, sameCount = 0;
      for (const j of indices) {
        if (j !== i && assignments[j] === ci) {
          a += euclideanDistance(features[i], features[j]);
          sameCount++;
        }
      }
      a = sameCount > 0 ? a / sameCount : 0;

      // b(i) — min mean dist to other clusters
      let b = Infinity;
      for (let c = 0; c < k; c++) {
        if (c === ci) continue;
        let dist = 0, cnt = 0;
        for (const j of indices) {
          if (assignments[j] === c) { dist += euclideanDistance(features[i], features[j]); cnt++; }
        }
        if (cnt > 0) b = Math.min(b, dist / cnt);
      }
      if (b === Infinity) b = 0;

      const mx = Math.max(a, b);
      total += mx > 0 ? (b - a) / mx : 0;
      valid++;
    }

    return valid > 0 ? total / valid : 0;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private arraysEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  private generateColors(k: number): string[] {
    let hue = Math.random();
    return Array.from({ length: k }, (_, i) => {
      hue = (hue + 0.618033988749895) % 1;
      return `hsl(${Math.floor(hue * 360)}, ${70 + (i % 2) * 10}%, ${50 + (i % 3) * 10}%)`;
    });
  }

  private emptyResult(k: number): ClusteringResult {
    return {
      clusters: [], noise: [], iterations: 0, convergence: false,
      silhouetteScore: 0, executionTime: 0,
      algorithm: this.useKMeansPlusPlus ? 'K-Means++' : 'K-Means',
      parameters: { k, useKMeansPlusPlus: this.useKMeansPlusPlus },
    };
  }
}

// Convenience exports
export const kMeans = (flows: NetworkFlow[], k = 3): ClusteringResult =>
  new KMeansClustering({ k, useKMeansPlusPlus: false }).cluster(flows);

export const kMeansPlusPlus = (flows: NetworkFlow[], k = 3): ClusteringResult =>
  new KMeansClustering({ k, useKMeansPlusPlus: true }).cluster(flows);