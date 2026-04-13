// Hierarchical Clustering Implementation

import type { NetworkFlow, Cluster, ClusteringResult, AlgorithmParameters } from '@/types';
import { LinkageMethod, DistanceMetric } from '@/types';
import { normalizeFeatures, extractFeatures, euclideanDistance } from './utils';

interface ClusterNode {
  id: number;
  points: number[];
  centroid: number[];
  left?: ClusterNode;
  right?: ClusterNode;
  distance: number;
  height: number;
}

export class HierarchicalClustering {
  private k: number;
  private linkage: LinkageMethod;
  private distanceMetric: DistanceMetric;

  constructor(params: AlgorithmParameters) {
    this.k = params.k || 3;
    this.linkage = params.linkage || LinkageMethod.AVERAGE;
    this.distanceMetric = params.distanceMetric || DistanceMetric.EUCLIDEAN;
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
        algorithm: 'Hierarchical',
        parameters: { k: this.k, linkage: this.linkage }
      };
    }

    // Extract and normalize features
    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);
    
    // Build dendrogram
    const root = this.buildDendrogram(normalizedFeatures);
    
    // Cut dendrogram to get k clusters
    const clusterNodes = this.cutDendrogram(root, this.k);
    
    // Build clusters from nodes
    const clusters = this.buildClusters(clusterNodes, flows, normalizedFeatures);
    
    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, clusters);
    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise: [],
      iterations: flows.length - 1,
      convergence: true,
      silhouetteScore,
      executionTime,
      algorithm: 'Hierarchical',
      parameters: { k: this.k, linkage: this.linkage }
    };
  }

  private buildDendrogram(features: number[][]): ClusterNode {
    const n = features.length;
    
    // Initialize each point as its own cluster
    const nodes: ClusterNode[] = [];
    for (let i = 0; i < n; i++) {
      nodes.push({
        id: i,
        points: [i],
        centroid: [...features[i]],
        distance: 0,
        height: 0
      });
    }

    // Distance matrix
    const distMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(Infinity));
    
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        distMatrix[i][j] = euclideanDistance(features[i], features[j]);
        distMatrix[j][i] = distMatrix[i][j];
      }
    }

    // Track active clusters
    const active = new Set<number>(Array.from({ length: n }, (_, i) => i));
    let nextId = n;

    while (active.size > 1) {
      // Find closest pair of clusters
      let minDist = Infinity;
      let pair: [number, number] = [-1, -1];
      
      const activeArray = Array.from(active);
      for (let i = 0; i < activeArray.length; i++) {
        for (let j = i + 1; j < activeArray.length; j++) {
          const id1 = activeArray[i];
          const id2 = activeArray[j];
          const dist = this.linkageDistance(nodes[id1], nodes[id2], distMatrix);
          
          if (dist < minDist) {
            minDist = dist;
            pair = [id1, id2];
          }
        }
      }

      if (pair[0] === -1 || pair[1] === -1) break;

      // Merge clusters
      const newNode: ClusterNode = {
        id: nextId++,
        points: [...nodes[pair[0]].points, ...nodes[pair[1]].points],
        centroid: this.calculateCentroid([...nodes[pair[0]].points, ...nodes[pair[1]].points], features),
        left: nodes[pair[0]],
        right: nodes[pair[1]],
        distance: minDist,
        height: Math.max(nodes[pair[0]].height, nodes[pair[1]].height) + 1
      };

      nodes.push(newNode);
      active.delete(pair[0]);
      active.delete(pair[1]);
      active.add(newNode.id);
    }

    // Return root node
    const rootId = Array.from(active)[0];
    return nodes[rootId];
  }

  private linkageDistance(
    cluster1: ClusterNode,
    cluster2: ClusterNode,
    distMatrix: number[][]
  ): number {
    switch (this.linkage) {
      case LinkageMethod.SINGLE:
        return this.singleLinkage(cluster1, cluster2, distMatrix);
      case LinkageMethod.COMPLETE:
        return this.completeLinkage(cluster1, cluster2, distMatrix);
      case LinkageMethod.AVERAGE:
        return this.averageLinkage(cluster1, cluster2, distMatrix);
      case LinkageMethod.WARD:
        return this.wardLinkage(cluster1, cluster2);
      case LinkageMethod.CENTROID:
        return this.centroidLinkage(cluster1, cluster2);
      default:
        return this.averageLinkage(cluster1, cluster2, distMatrix);
    }
  }

  private singleLinkage(cluster1: ClusterNode, cluster2: ClusterNode, distMatrix: number[][]): number {
    let minDist = Infinity;
    for (const i of cluster1.points) {
      for (const j of cluster2.points) {
        minDist = Math.min(minDist, distMatrix[i][j]);
      }
    }
    return minDist;
  }

  private completeLinkage(cluster1: ClusterNode, cluster2: ClusterNode, distMatrix: number[][]): number {
    let maxDist = 0;
    for (const i of cluster1.points) {
      for (const j of cluster2.points) {
        maxDist = Math.max(maxDist, distMatrix[i][j]);
      }
    }
    return maxDist;
  }

  private averageLinkage(cluster1: ClusterNode, cluster2: ClusterNode, distMatrix: number[][]): number {
    let totalDist = 0;
    let count = 0;
    for (const i of cluster1.points) {
      for (const j of cluster2.points) {
        totalDist += distMatrix[i][j];
        count++;
      }
    }
    return count > 0 ? totalDist / count : 0;
  }

  private wardLinkage(cluster1: ClusterNode, cluster2: ClusterNode): number {
    const dist = euclideanDistance(cluster1.centroid, cluster2.centroid);
    return dist * dist * cluster1.points.length * cluster2.points.length / 
           (cluster1.points.length + cluster2.points.length);
  }

  private centroidLinkage(cluster1: ClusterNode, cluster2: ClusterNode): number {
    return euclideanDistance(cluster1.centroid, cluster2.centroid);
  }

  private calculateCentroid(pointIndices: number[], features: number[][]): number[] {
    if (pointIndices.length === 0) return [];
    
    const dim = features[0].length;
    const centroid = new Array(dim).fill(0);
    
    for (const idx of pointIndices) {
      for (let i = 0; i < dim; i++) {
        centroid[i] += features[idx][i];
      }
    }
    
    for (let i = 0; i < dim; i++) {
      centroid[i] /= pointIndices.length;
    }
    
    return centroid;
  }

  private cutDendrogram(root: ClusterNode, k: number): ClusterNode[] {
    // Priority queue of nodes sorted by distance (descending)
    const queue: ClusterNode[] = [root];
    
    while (queue.length < k) {
      // Find node with highest distance to split
      queue.sort((a, b) => b.distance - a.distance);
      
      const nodeToSplit = queue[0];
      if (!nodeToSplit.left || !nodeToSplit.right) break;
      
      // Replace with children
      queue.shift();
      queue.push(nodeToSplit.left);
      queue.push(nodeToSplit.right);
    }
    
    return queue.slice(0, k);
  }

  private buildClusters(clusterNodes: ClusterNode[], flows: NetworkFlow[], features: number[][]): Cluster[] {
    const clusters: Cluster[] = [];
    const colors = this.generateClusterColors(clusterNodes.length);
    
    for (let i = 0; i < clusterNodes.length; i++) {
      const node = clusterNodes[i];
      const clusterPoints: NetworkFlow[] = node.points.map(idx => ({
        ...flows[idx],
        clusterId: i
      }));
      
      const protocolDistribution = this.calculateProtocolDistribution(clusterPoints);
      const avgByteCount = clusterPoints.reduce((sum, p) => sum + p.byteCount, 0) / (clusterPoints.length || 1);
      const avgPacketCount = clusterPoints.reduce((sum, p) => sum + p.packetCount, 0) / (clusterPoints.length || 1);
      const avgDuration = clusterPoints.reduce((sum, p) => sum + p.duration, 0) / (clusterPoints.length || 1);
      
      const clusterFeatures = node.points.map(idx => features[idx]);
      const bounds = this.calculateBounds(clusterFeatures);
      
      clusters.push({
        id: i,
        centroid: node.centroid,
        points: clusterPoints,
        size: clusterPoints.length,
        density: clusterPoints.length / flows.length,
        silhouette: 0,
        protocolDistribution,
        avgByteCount,
        avgPacketCount,
        avgDuration,
        color: colors[i],
        bounds
      });
    }
    
    return clusters;
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

  private calculateSilhouetteScore(features: number[][], clusters: Cluster[]): number {
    const n = features.length;
    if (n === 0) return 0;
    
    // Create assignment array
    const assignments: number[] = new Array(n).fill(-1);
    for (let i = 0; i < clusters.length; i++) {
      for (const point of clusters[i].points) {
        const idx = features.findIndex((_, idx) => 
          clusters[i].points.some(p => p.id === point.id)
        );
        if (idx >= 0) assignments[idx] = i;
      }
    }
    
    let totalScore = 0;
    let validPoints = 0;
    
    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i];
      if (clusterId === -1) continue;
      
      validPoints++;
      
      // Calculate a(i) - average distance to points in same cluster
      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && assignments[j] === clusterId) {
          a += euclideanDistance(features[i], features[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;
      
      // Calculate b(i) - minimum average distance to points in other clusters
      let b = Infinity;
      for (let otherCluster = 0; otherCluster < clusters.length; otherCluster++) {
        if (otherCluster === clusterId) continue;
        
        let avgDist = 0;
        let count = 0;
        for (let j = 0; j < n; j++) {
          if (assignments[j] === otherCluster) {
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
export const hierarchical = (flows: NetworkFlow[], k: number = 3, linkage: LinkageMethod = LinkageMethod.AVERAGE): ClusteringResult => {
  const clusterer = new HierarchicalClustering({ k, linkage });
  return clusterer.cluster(flows);
};
