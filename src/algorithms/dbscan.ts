// DBSCAN (Density-Based Spatial Clustering of Applications with Noise) Implementation

import type { NetworkFlow, Cluster, ClusteringResult, AlgorithmParameters } from '@/types';
import { normalizeFeatures, extractFeatures, euclideanDistance } from './utils';

interface PointStatus {
  visited: boolean;
  clustered: boolean;
  clusterId: number;
  isCore: boolean;
}

export class DBSCANClustering {
  private epsilon: number;
  private minPoints: number;
  //
  private autoEstimateEpsilon: boolean;

  constructor(params: AlgorithmParameters) {
    this.epsilon = params.epsilon || 0.5;
    this.minPoints = params.minPoints || 5;
    // this.distanceMetric = params.distanceMetric || DistanceMetric.EUCLIDEAN;
    this.autoEstimateEpsilon = params.epsilon === undefined;
  }

  public cluster(flows: NetworkFlow[]): ClusteringResult {
    const startTime = performance.now();
    
    if (flows.length === 0) {
      return {
        clusters: [],
        noise: [],
        iterations: 0,
        convergence: true,
        silhouetteScore: 0,
        executionTime: 0,
        algorithm: 'DBSCAN',
        parameters: { epsilon: this.epsilon, minPoints: this.minPoints }
      };
    }

    // Extract and normalize features
    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);
    
    // Auto-estimate epsilon if not provided
    if (this.autoEstimateEpsilon) {
      this.epsilon = this.estimateEpsilon(normalizedFeatures);
    }

    const n = normalizedFeatures.length;
    const statuses: PointStatus[] = Array(n).fill(null).map(() => ({
      visited: false,
      clustered: false,
      clusterId: -1,
      isCore: false
    }));

    let clusterId = 0;
    const clusters: Cluster[] = [];
    const noise: NetworkFlow[] = [];

    for (let i = 0; i < n; i++) {
      if (statuses[i].visited) continue;
      
      statuses[i].visited = true;
      
      const neighbors = this.getNeighbors(normalizedFeatures, i);
      
      if (neighbors.length < this.minPoints) {
        // Mark as noise temporarily
        continue;
      }
      
      // Start a new cluster
      statuses[i].isCore = true;
      const cluster = this.expandCluster(
        normalizedFeatures,
        flows,
        statuses,
        i,
        neighbors,
        clusterId
      );
      
      clusters.push(cluster);
      clusterId++;
    }

    // Collect noise points
    for (let i = 0; i < n; i++) {
      if (!statuses[i].clustered) {
        noise.push({ ...flows[i], clusterId: -1 });
      }
    }

    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, statuses);
    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise,
      iterations: clusterId,
      convergence: true,
      silhouetteScore,
      executionTime,
      algorithm: 'DBSCAN',
      parameters: { epsilon: this.epsilon, minPoints: this.minPoints }
    };
  }

  private estimateEpsilon(features: number[][]): number {
    // Use k-distance graph to estimate epsilon
    const k = this.minPoints;
    const kDistances: number[] = [];
    
    for (let i = 0; i < features.length; i++) {
      const distances: number[] = [];
      
      for (let j = 0; j < features.length; j++) {
        if (i !== j) {
          distances.push(euclideanDistance(features[i], features[j]));
        }
      }
      
      distances.sort((a, b) => a - b);
      kDistances.push(distances[k - 1] || distances[distances.length - 1]);
    }
    
    kDistances.sort((a, b) => a - b);
    
    // Find the elbow point using the knee method
    return this.findElbowPoint(kDistances);
  }

  private findElbowPoint(values: number[]): number {
    if (values.length < 3) return values[Math.floor(values.length / 2)];
    
    const n = values.length;
    const firstPoint = { x: 0, y: values[0] };
    const lastPoint = { x: n - 1, y: values[n - 1] };
    
    let maxDistance = 0;
    let elbowIndex = 0;
    
    for (let i = 0; i < n; i++) {
      const distance = this.pointToLineDistance(
        { x: i, y: values[i] },
        firstPoint,
        lastPoint
      );
      
      if (distance > maxDistance) {
        maxDistance = distance;
        elbowIndex = i;
      }
    }
    
    return values[elbowIndex];
  }

  private pointToLineDistance(
    point: { x: number; y: number },
    lineStart: { x: number; y: number },
    lineEnd: { x: number; y: number }
  ): number {
    const numerator = Math.abs(
      (lineEnd.y - lineStart.y) * point.x -
      (lineEnd.x - lineStart.x) * point.y +
      lineEnd.x * lineStart.y -
      lineEnd.y * lineStart.x
    );
    
    const denominator = Math.sqrt(
      Math.pow(lineEnd.y - lineStart.y, 2) +
      Math.pow(lineEnd.x - lineStart.x, 2)
    );
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  private getNeighbors(features: number[][], pointIndex: number): number[] {
    const neighbors: number[] = [];
    
    for (let i = 0; i < features.length; i++) {
      if (i !== pointIndex) {
        const dist = euclideanDistance(features[pointIndex], features[i]);
        
        if (dist <= this.epsilon) {
          neighbors.push(i);
        }
      }
    }
    
    return neighbors;
  }

  private expandCluster(
    features: number[][],
    flows: NetworkFlow[],
    statuses: PointStatus[],
    corePointIndex: number,
    neighbors: number[],
    clusterId: number
  ): Cluster {
    const clusterPoints: NetworkFlow[] = [{ ...flows[corePointIndex], clusterId }];
    statuses[corePointIndex].clustered = true;
    statuses[corePointIndex].clusterId = clusterId;

    const queue = [...neighbors];
    let i = 0;

    while (i < queue.length) {
      const pointIndex = queue[i];
      
      if (!statuses[pointIndex].visited) {
        statuses[pointIndex].visited = true;
        
        const pointNeighbors = this.getNeighbors(features, pointIndex);
        
        if (pointNeighbors.length >= this.minPoints) {
          statuses[pointIndex].isCore = true;
          // Add new neighbors to queue
          for (const neighbor of pointNeighbors) {
            if (!queue.includes(neighbor)) {
              queue.push(neighbor);
            }
          }
        }
      }
      
      if (!statuses[pointIndex].clustered) {
        clusterPoints.push({ ...flows[pointIndex], clusterId });
        statuses[pointIndex].clustered = true;
        statuses[pointIndex].clusterId = clusterId;
      }
      
      i++;
    }

    return this.buildCluster(clusterPoints, features, flows, clusterId);
  }

  private buildCluster(points: NetworkFlow[], features: number[][], flows: NetworkFlow[], clusterId: number): Cluster {
    const protocolDistribution = this.calculateProtocolDistribution(points);
    const avgByteCount = points.reduce((sum, p) => sum + p.byteCount, 0) / (points.length || 1);
    const avgPacketCount = points.reduce((sum, p) => sum + p.packetCount, 0) / (points.length || 1);
    const avgDuration = points.reduce((sum, p) => sum + p.duration, 0) / (points.length || 1);

    // Calculate centroid
    const clusterFeatures: number[][] = [];
    for (const point of points) {
      // Find the feature vector for this point by matching id
      const idx = flows.findIndex((f: NetworkFlow) => f.id === point.id);
      if (idx >= 0) {
        clusterFeatures.push(features[idx]);
      }
    }
    
    const centroid = this.calculateCentroid(clusterFeatures);

    // Calculate bounds
    const bounds = this.calculateBounds(clusterFeatures);

    const colors = this.generateClusterColors(10);

    return {
      id: clusterId,
      centroid,
      points,
      size: points.length,
      density: points.length / features.length,
      silhouette: 0,
      protocolDistribution,
      avgByteCount,
      avgPacketCount,
      avgDuration,
      color: colors[clusterId % colors.length],
      bounds
    };
  }

  private calculateCentroid(features: number[][]): number[] {
    if (features.length === 0) return [];
    
    const dim = features[0].length;
    const centroid = new Array(dim).fill(0);
    
    for (const feature of features) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += feature[i];
      }
    }
    
    for (let i = 0; i < dim; i++) {
      centroid[i] /= features.length;
    }
    
    return centroid;
  }

  private calculateBounds(features: number[][]): { min: number[]; max: number[] } {
    if (features.length === 0) return { min: [], max: [] };
    
    const dim = features[0].length;
    const min = new Array(dim).fill(Infinity);
    const max = new Array(dim).fill(-Infinity);
    
    for (const feature of features) {
      for (let i = 0; i < dim; i++) {
        min[i] = Math.min(min[i], feature[i]);
        max[i] = Math.max(max[i], feature[i]);
      }
    }
    
    return { min, max };
  }

  private calculateProtocolDistribution(points: NetworkFlow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    points.forEach(p => {
      distribution[p.protocol] = (distribution[p.protocol] || 0) + 1;
    });
    return distribution;
  }

  private calculateSilhouetteScore(features: number[][], statuses: PointStatus[]): number {
    const n = features.length;
    if (n === 0) return 0;
    
    let totalScore = 0;
    let validPoints = 0;
    
    for (let i = 0; i < n; i++) {
      const clusterId = statuses[i].clusterId;
      if (clusterId === -1) continue; // Skip noise points
      
      validPoints++;
      
      // Calculate a(i) - average distance to points in same cluster
      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && statuses[j].clusterId === clusterId) {
          a += euclideanDistance(features[i], features[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;
      
      // Calculate b(i) - minimum average distance to points in other clusters
      let b = Infinity;
      const uniqueClusters = new Set<number>();
      for (let j = 0; j < n; j++) {
        if (statuses[j].clusterId !== -1 && statuses[j].clusterId !== clusterId) {
          uniqueClusters.add(statuses[j].clusterId);
        }
      }
      
      for (const otherCluster of uniqueClusters) {
        let avgDist = 0;
        let count = 0;
        for (let j = 0; j < n; j++) {
          if (statuses[j].clusterId === otherCluster) {
            avgDist += euclideanDistance(features[i], features[j]);
            count++;
          }
        }
        
        if (count > 0) {
          avgDist /= count;
          b = Math.min(b, avgDist);
        }
      }
      
      if (b === Infinity) b = 0;
      
      // Silhouette score for point i
      const maxAB = Math.max(a, b);
      totalScore += maxAB > 0 ? (b - a) / maxAB : 0;
    }
    
    return validPoints > 0 ? totalScore / validPoints : 0;
  }

  private generateClusterColors(k: number): string[] {
    const colors: string[] = [];
    const goldenRatio = 0.618033988749895;
    let hue = Math.random();
    
    for (let i = 0; i < k; i++) {
      hue += goldenRatio;
      hue %= 1;
      const h = Math.floor(hue * 360);
      const s = 70 + (i % 2) * 10;
      const l = 50 + (i % 3) * 10;
      colors.push(`hsl(${h}, ${s}%, ${l}%)`);
    }
    
    return colors;
  }
}

// Export singleton instance creator
export const dbscan = (flows: NetworkFlow[], epsilon?: number, minPoints: number = 5): ClusteringResult => {
  const clusterer = new DBSCANClustering({ epsilon, minPoints });
  return clusterer.cluster(flows);
};
