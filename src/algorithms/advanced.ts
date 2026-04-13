// Advanced Clustering Algorithms: Mean Shift, GMM, SOM, Isolation Forest

import type { NetworkFlow, Cluster, ClusteringResult, AlgorithmParameters } from '@/types';
import { normalizeFeatures, extractFeatures, euclideanDistance, calculateCentroid } from './utils';

// ==================== Mean Shift Clustering ====================

export class MeanShiftClustering {
  private bandwidth: number;
  private maxIterations: number;
  private convergenceThreshold: number;

  constructor(params: AlgorithmParameters) {
    this.bandwidth = params.bandwidth || 0.5;
    this.maxIterations = params.maxIterations || 100;
    this.convergenceThreshold = params.convergenceThreshold || 0.001;
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
        algorithm: 'Mean Shift',
        parameters: { bandwidth: this.bandwidth }
      };
    }

    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);
    
    // Auto-estimate bandwidth if not provided
    if (!this.bandwidth || this.bandwidth <= 0) {
      this.bandwidth = this.estimateBandwidth(normalizedFeatures);
    }

    // Run mean shift on each point
    const shiftedPoints: number[][] = [];
    for (const point of normalizedFeatures) {
      shiftedPoints.push(this.meanShift(point, normalizedFeatures));
    }

    // Cluster shifted points
    const { clusters, assignments } = this.clusterShiftedPoints(shiftedPoints, normalizedFeatures, flows);
    
    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, assignments);
    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise: [],
      iterations: this.maxIterations,
      convergence: true,
      silhouetteScore,
      executionTime,
      algorithm: 'Mean Shift',
      parameters: { bandwidth: this.bandwidth }
    };
  }

  private estimateBandwidth(features: number[][]): number {
    // Use median of k-nearest neighbor distances
    const k = Math.min(5, features.length - 1);
    const distances: number[] = [];
    
    for (let i = 0; i < features.length; i++) {
      const pointDistances: number[] = [];
      for (let j = 0; j < features.length; j++) {
        if (i !== j) {
          pointDistances.push(euclideanDistance(features[i], features[j]));
        }
      }
      pointDistances.sort((a, b) => a - b);
      distances.push(pointDistances[k - 1] || pointDistances[pointDistances.length - 1]);
    }
    
    distances.sort((a, b) => a - b);
    return distances[Math.floor(distances.length / 2)];
  }

  private meanShift(point: number[], features: number[][]): number[] {
    let current = [...point];
    
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const newPosition = this.shift(current, features);
      
      const shiftDistance = euclideanDistance(current, newPosition);
      current = newPosition;
      
      if (shiftDistance < this.convergenceThreshold) {
        break;
      }
    }
    
    return current;
  }

  private shift(point: number[], features: number[][]): number[] {
    const weightedSum = new Array(point.length).fill(0);
    let totalWeight = 0;
    
    for (const feature of features) {
      const dist = euclideanDistance(point, feature);
      const weight = this.gaussianKernel(dist, this.bandwidth);
      
      for (let i = 0; i < point.length; i++) {
        weightedSum[i] += feature[i] * weight;
      }
      totalWeight += weight;
    }
    
    if (totalWeight === 0) return point;
    
    return weightedSum.map(sum => sum / totalWeight);
  }

  private gaussianKernel(distance: number, bandwidth: number): number {
    return Math.exp(-0.5 * Math.pow(distance / bandwidth, 2));
  }

  private clusterShiftedPoints(
    shiftedPoints: number[][],
    _originalFeatures: number[][],
    flows: NetworkFlow[]
  ): { clusters: Cluster[]; assignments: number[] } {
    const n = shiftedPoints.length;
    const assignments: number[] = new Array(n).fill(-1);
    let clusterId = 0;
    const clusterCenters: number[][] = [];
    const clusterPoints: NetworkFlow[][] = [];

    for (let i = 0; i < n; i++) {
      if (assignments[i] !== -1) continue;

      // Find or create cluster
      let foundCluster = false;
      for (let c = 0; c < clusterCenters.length; c++) {
        if (euclideanDistance(shiftedPoints[i], clusterCenters[c]) < this.bandwidth / 2) {
          assignments[i] = c;
          clusterPoints[c].push({ ...flows[i], clusterId: c });
          foundCluster = true;
          break;
        }
      }

      if (!foundCluster) {
        clusterCenters.push(shiftedPoints[i]);
        assignments[i] = clusterId;
        clusterPoints.push([{ ...flows[i], clusterId }]);
        clusterId++;
      }
    }

    // Build clusters
    const clusters: Cluster[] = [];
    const colors = this.generateClusterColors(clusterId);

    for (let i = 0; i < clusterId; i++) {
      const points = clusterPoints[i];
      const protocolDistribution = this.calculateProtocolDistribution(points);
      const avgByteCount = points.reduce((sum, p) => sum + p.byteCount, 0) / (points.length || 1);
      const avgPacketCount = points.reduce((sum, p) => sum + p.packetCount, 0) / (points.length || 1);
      const avgDuration = points.reduce((sum, p) => sum + p.duration, 0) / (points.length || 1);

      clusters.push({
        id: i,
        centroid: clusterCenters[i],
        points,
        size: points.length,
        density: points.length / n,
        silhouette: 0,
        protocolDistribution,
        avgByteCount,
        avgPacketCount,
        avgDuration,
        color: colors[i]
      });
    }

    return { clusters, assignments };
  }

  private calculateProtocolDistribution(points: NetworkFlow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    points.forEach(p => {
      distribution[p.protocol] = (distribution[p.protocol] || 0) + 1;
    });
    return distribution;
  }

  private calculateSilhouetteScore(features: number[][], assignments: number[]): number {
    const n = features.length;
    if (n === 0) return 0;

    const uniqueClusters = Array.from(new Set(assignments)).filter(id => id !== -1);
    let totalScore = 0;
    let validPoints = 0;

    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i];
      if (clusterId === -1) continue;

      validPoints++;

      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && assignments[j] === clusterId) {
          a += euclideanDistance(features[i], features[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;

      let b = Infinity;
      for (const otherCluster of uniqueClusters) {
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

// ==================== Gaussian Mixture Model (GMM) ====================

export class GaussianMixtureModel {
  private k: number;
  private maxIterations: number;
  private convergenceThreshold: number;

  constructor(params: AlgorithmParameters) {
    this.k = params.k || 3;
    this.maxIterations = params.maxIterations || 100;
    this.convergenceThreshold = params.convergenceThreshold || 0.001;
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
        algorithm: 'Gaussian Mixture Model',
        parameters: { k: this.k }
      };
    }

    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);
    const dim = normalizedFeatures[0].length;

    // Initialize parameters
    let weights = new Array(this.k).fill(1 / this.k);
    let means: number[][] = this.initializeMeans(normalizedFeatures);
    let covariances: number[][][] = Array(this.k).fill(null).map(() => 
      this.initializeCovariance(dim)
    );

    let logLikelihood = -Infinity;
    let iterations = 0;

    for (iterations = 0; iterations < this.maxIterations; iterations++) {
      // E-step: Calculate responsibilities
      const responsibilities = this.eStep(normalizedFeatures, weights, means, covariances);

      // M-step: Update parameters
      const newParams = this.mStep(normalizedFeatures, responsibilities);
      weights = newParams.weights;
      means = newParams.means;
      covariances = newParams.covariances;

      // Calculate log-likelihood
      const newLogLikelihood = this.calculateLogLikelihood(
        normalizedFeatures, weights, means, covariances
      );

      // Check convergence
      if (Math.abs(newLogLikelihood - logLikelihood) < this.convergenceThreshold) {
        break;
      }

      logLikelihood = newLogLikelihood;
    }

    // Assign points to clusters
    const responsibilities = this.eStep(normalizedFeatures, weights, means, covariances);
    const assignments = responsibilities.map(r => {
      let maxProb = 0;
      let cluster = 0;
      for (let i = 0; i < this.k; i++) {
        if (r[i] > maxProb) {
          maxProb = r[i];
          cluster = i;
        }
      }
      return cluster;
    });

    const clusters = this.buildClusters(flows, normalizedFeatures, assignments, means);
    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, assignments);
    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise: [],
      iterations,
      convergence: true,
      silhouetteScore,
      executionTime,
      algorithm: 'Gaussian Mixture Model',
      parameters: { k: this.k }
    };
  }

  private initializeMeans(features: number[][]): number[][] {
    const means: number[][] = [];
    const usedIndices = new Set<number>();

    while (means.length < this.k && usedIndices.size < features.length) {
      const randomIndex = Math.floor(Math.random() * features.length);
      if (!usedIndices.has(randomIndex)) {
        means.push([...features[randomIndex]]);
        usedIndices.add(randomIndex);
      }
    }

    return means;
  }

  private initializeCovariance(dim: number): number[][] {
    const cov: number[][] = Array(dim).fill(null).map(() => Array(dim).fill(0));
    for (let i = 0; i < dim; i++) {
      cov[i][i] = 1;
    }
    return cov;
  }

  private eStep(
    features: number[][],
    weights: number[],
    means: number[][],
    covariances: number[][][]
  ): number[][] {
    return features.map(feature => {
      const probs = weights.map((w, i) => 
        w * this.multivariateGaussian(feature, means[i], covariances[i])
      );
      const totalProb = probs.reduce((sum, p) => sum + p, 0);
      return probs.map(p => (totalProb > 0 ? p / totalProb : 0));
    });
  }

  private mStep(features: number[][], responsibilities: number[][]): {
    weights: number[];
    means: number[][];
    covariances: number[][][];
  } {
    const dim = features[0].length;

    const N = responsibilities[0].map((_, i) => 
      responsibilities.reduce((sum, r) => sum + r[i], 0)
    );

    const weights = N.map(nk => nk / features.length);

    const means = N.map((nk, i) => {
      const sum = new Array(dim).fill(0);
      for (let j = 0; j < features.length; j++) {
        for (let d = 0; d < dim; d++) {
          sum[d] += responsibilities[j][i] * features[j][d];
        }
      }
      return sum.map(s => (nk > 0 ? s / nk : 0));
    });

    const covariances = N.map((nk, i) => {
      const cov = Array(dim).fill(null).map(() => Array(dim).fill(0));
      for (let j = 0; j < features.length; j++) {
        const diff = features[j].map((f, d) => f - means[i][d]);
        for (let d1 = 0; d1 < dim; d1++) {
          for (let d2 = 0; d2 < dim; d2++) {
            cov[d1][d2] += responsibilities[j][i] * diff[d1] * diff[d2];
          }
        }
      }
      for (let d1 = 0; d1 < dim; d1++) {
        for (let d2 = 0; d2 < dim; d2++) {
          cov[d1][d2] = nk > 0 ? cov[d1][d2] / nk : (d1 === d2 ? 1 : 0);
        }
      }
      return cov;
    });

    return { weights, means, covariances };
  }

  private multivariateGaussian(x: number[], mean: number[], covariance: number[][]): number {
    const dim = x.length;
    const diff = x.map((xi, i) => xi - mean[i]);
    
    // Simplified: assume diagonal covariance for performance
    let det = 1;
    let exponent = 0;
    for (let i = 0; i < dim; i++) {
      det *= covariance[i][i];
      exponent += Math.pow(diff[i], 2) / covariance[i][i];
    }
    
    det = Math.max(det, 1e-10);
    
    return Math.exp(-0.5 * exponent) / Math.sqrt(Math.pow(2 * Math.PI, dim) * det);
  }

  private calculateLogLikelihood(
    features: number[][],
    weights: number[],
    means: number[][],
    covariances: number[][][]
  ): number {
    let logLikelihood = 0;
    for (const feature of features) {
      let prob = 0;
      for (let i = 0; i < this.k; i++) {
        prob += weights[i] * this.multivariateGaussian(feature, means[i], covariances[i]);
      }
      logLikelihood += Math.log(Math.max(prob, 1e-10));
    }
    return logLikelihood;
  }

  private buildClusters(
    flows: NetworkFlow[],
    features: number[][],
    assignments: number[],
    means: number[][]
  ): Cluster[] {
    const clusters: Cluster[] = [];
    const colors = this.generateClusterColors(this.k);

    for (let i = 0; i < this.k; i++) {
      const clusterPoints: NetworkFlow[] = [];
      for (let j = 0; j < flows.length; j++) {
        if (assignments[j] === i) {
          clusterPoints.push({ ...flows[j], clusterId: i });
        }
      }

      const protocolDistribution = this.calculateProtocolDistribution(clusterPoints);
      const avgByteCount = clusterPoints.reduce((sum, p) => sum + p.byteCount, 0) / (clusterPoints.length || 1);
      const avgPacketCount = clusterPoints.reduce((sum, p) => sum + p.packetCount, 0) / (clusterPoints.length || 1);
      const avgDuration = clusterPoints.reduce((sum, p) => sum + p.duration, 0) / (clusterPoints.length || 1);

      clusters.push({
        id: i,
        centroid: means[i],
        points: clusterPoints,
        size: clusterPoints.length,
        density: clusterPoints.length / flows.length,
        silhouette: 0,
        protocolDistribution,
        avgByteCount,
        avgPacketCount,
        avgDuration,
        color: colors[i]
      });
    }

    return clusters;
  }

  private calculateProtocolDistribution(points: NetworkFlow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    points.forEach(p => {
      distribution[p.protocol] = (distribution[p.protocol] || 0) + 1;
    });
    return distribution;
  }

  private calculateSilhouetteScore(features: number[][], assignments: number[]): number {
    const n = features.length;
    if (n === 0) return 0;

    const uniqueClusters = Array.from(new Set(assignments)).filter(id => id !== -1);
    let totalScore = 0;
    let validPoints = 0;

    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i];
      if (clusterId === -1) continue;

      validPoints++;

      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && assignments[j] === clusterId) {
          a += euclideanDistance(features[i], features[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;

      let b = Infinity;
      for (const otherCluster of uniqueClusters) {
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

// ==================== Self-Organizing Map (SOM) ====================

export class SelfOrganizingMap {
  private gridSize: number;
  private maxIterations: number;
  private initialLearningRate: number;
  private initialRadius: number;

  constructor(params: AlgorithmParameters) {
    this.gridSize = params.k || 3;
    this.maxIterations = params.maxIterations || 100;
    this.initialLearningRate = 0.1;
    this.initialRadius = this.gridSize / 2;
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
        algorithm: 'Self-Organizing Map',
        parameters: { k: this.gridSize }
      };
    }

    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);
    const dim = normalizedFeatures[0].length;

    // Initialize SOM grid
    const somGrid: number[][][] = Array(this.gridSize).fill(null).map(() =>
      Array(this.gridSize).fill(null).map(() =>
        Array(dim).fill(0).map(() => Math.random())
      )
    );

    // Training
    for (let iter = 0; iter < this.maxIterations; iter++) {
      const learningRate = this.initialLearningRate * (1 - iter / this.maxIterations);
      const radius = this.initialRadius * (1 - iter / this.maxIterations);

      for (const feature of normalizedFeatures) {
        // Find Best Matching Unit (BMU)
        const { x: bmuX, y: bmuY } = this.findBMU(somGrid, feature);

        // Update neighborhood
        for (let x = 0; x < this.gridSize; x++) {
          for (let y = 0; y < this.gridSize; y++) {
            const distance = Math.sqrt(Math.pow(x - bmuX, 2) + Math.pow(y - bmuY, 2));
            
            if (distance <= radius) {
              const influence = Math.exp(-Math.pow(distance, 2) / (2 * Math.pow(radius, 2)));
              
              for (let d = 0; d < dim; d++) {
                somGrid[x][y][d] += learningRate * influence * (feature[d] - somGrid[x][y][d]);
              }
            }
          }
        }
      }
    }

    // Assign points to clusters
    const assignments: number[] = [];
    for (const feature of normalizedFeatures) {
      const { x, y } = this.findBMU(somGrid, feature);
      assignments.push(x * this.gridSize + y);
    }

    // Build clusters from unique assignments
    const uniqueAssignments = Array.from(new Set(assignments));
    const clusters = this.buildClusters(flows, normalizedFeatures, assignments, somGrid, uniqueAssignments);
    const silhouetteScore = this.calculateSilhouetteScore(normalizedFeatures, assignments);
    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise: [],
      iterations: this.maxIterations,
      convergence: true,
      silhouetteScore,
      executionTime,
      algorithm: 'Self-Organizing Map',
      parameters: { k: this.gridSize }
    };
  }

  private findBMU(grid: number[][][], feature: number[]): { x: number; y: number } {
    let minDist = Infinity;
    let bmuX = 0;
    let bmuY = 0;

    for (let x = 0; x < this.gridSize; x++) {
      for (let y = 0; y < this.gridSize; y++) {
        const dist = euclideanDistance(feature, grid[x][y]);
        if (dist < minDist) {
          minDist = dist;
          bmuX = x;
          bmuY = y;
        }
      }
    }

    return { x: bmuX, y: bmuY };
  }

  private buildClusters(
    flows: NetworkFlow[],
    _features: number[][],
    assignments: number[],
    somGrid: number[][][],
    uniqueAssignments: number[]
  ): Cluster[] {
    const clusters: Cluster[] = [];
    const colors = this.generateClusterColors(uniqueAssignments.length);

    for (let i = 0; i < uniqueAssignments.length; i++) {
      const clusterId = uniqueAssignments[i];
      const clusterPoints: NetworkFlow[] = [];

      for (let j = 0; j < flows.length; j++) {
        if (assignments[j] === clusterId) {
          clusterPoints.push({ ...flows[j], clusterId: i });
        }
      }

      const x = Math.floor(clusterId / this.gridSize);
      const y = clusterId % this.gridSize;

      const protocolDistribution = this.calculateProtocolDistribution(clusterPoints);
      const avgByteCount = clusterPoints.reduce((sum, p) => sum + p.byteCount, 0) / (clusterPoints.length || 1);
      const avgPacketCount = clusterPoints.reduce((sum, p) => sum + p.packetCount, 0) / (clusterPoints.length || 1);
      const avgDuration = clusterPoints.reduce((sum, p) => sum + p.duration, 0) / (clusterPoints.length || 1);

      clusters.push({
        id: i,
        centroid: somGrid[x][y],
        points: clusterPoints,
        size: clusterPoints.length,
        density: clusterPoints.length / flows.length,
        silhouette: 0,
        protocolDistribution,
        avgByteCount,
        avgPacketCount,
        avgDuration,
        color: colors[i]
      });
    }

    return clusters;
  }

  private calculateProtocolDistribution(points: NetworkFlow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    points.forEach(p => {
      distribution[p.protocol] = (distribution[p.protocol] || 0) + 1;
    });
    return distribution;
  }

  private calculateSilhouetteScore(features: number[][], assignments: number[]): number {
    const n = features.length;
    if (n === 0) return 0;

    const uniqueClusters = Array.from(new Set(assignments)).filter(id => id !== -1);
    let totalScore = 0;
    let validPoints = 0;

    for (let i = 0; i < n; i++) {
      const clusterId = assignments[i];
      if (clusterId === -1) continue;

      validPoints++;

      let a = 0;
      let sameClusterCount = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j && assignments[j] === clusterId) {
          a += euclideanDistance(features[i], features[j]);
          sameClusterCount++;
        }
      }
      a = sameClusterCount > 0 ? a / sameClusterCount : 0;

      let b = Infinity;
      for (const otherCluster of uniqueClusters) {
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

// ==================== Isolation Forest ====================

export class IsolationForest {
  private nEstimators: number;
  private contamination: number;
  private maxSamples: number;
  private trees: IsolationTree[];

  constructor(params: AlgorithmParameters) {
    this.nEstimators = params.nEstimators || 100;
    this.contamination = params.contamination || 0.1;
    this.maxSamples = 256;
    this.trees = [];
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
        algorithm: 'Isolation Forest',
        parameters: { nEstimators: this.nEstimators, contamination: this.contamination }
      };
    }

    const features = flows.map(f => extractFeatures(f));
    const normalizedFeatures = normalizeFeatures(features);

    // Build forest
    this.trees = [];
    for (let i = 0; i < this.nEstimators; i++) {
      const sampleIndices = this.subsample(normalizedFeatures.length);
      const sample = sampleIndices.map(idx => normalizedFeatures[idx]);
      const tree = this.buildTree(sample, 0, Math.ceil(Math.log2(this.maxSamples)));
      this.trees.push(tree);
    }

    // Calculate anomaly scores
    const scores = normalizedFeatures.map(feature => this.anomalyScore(feature));

    // Determine threshold
    const sortedScores = [...scores].sort((a, b) => b - a);
    const thresholdIndex = Math.floor(this.contamination * scores.length);
    const threshold = sortedScores[thresholdIndex] || 0.5;

    // Assign clusters (normal vs anomaly)
    const normalPoints: NetworkFlow[] = [];
    const anomalyPoints: NetworkFlow[] = [];

    for (let i = 0; i < flows.length; i++) {
      if (scores[i] >= threshold) {
        anomalyPoints.push({ 
          ...flows[i], 
          clusterId: -1, 
          isAnomaly: true,
          anomalyScore: scores[i]
        });
      } else {
        normalPoints.push({ 
          ...flows[i], 
          clusterId: 0,
          isAnomaly: false,
          anomalyScore: scores[i]
        });
      }
    }

    // Build clusters
    const clusters: Cluster[] = [];
    if (normalPoints.length > 0) {
      clusters.push({
        id: 0,
        centroid: calculateCentroid(normalPoints.map(p => extractFeatures(p))),
        points: normalPoints,
        size: normalPoints.length,
        density: normalPoints.length / flows.length,
        silhouette: 0,
        protocolDistribution: this.calculateProtocolDistribution(normalPoints),
        avgByteCount: normalPoints.reduce((sum, p) => sum + p.byteCount, 0) / normalPoints.length,
        avgPacketCount: normalPoints.reduce((sum, p) => sum + p.packetCount, 0) / normalPoints.length,
        avgDuration: normalPoints.reduce((sum, p) => sum + p.duration, 0) / normalPoints.length,
        color: '#4ade80'
      });
    }

    const executionTime = performance.now() - startTime;

    return {
      clusters,
      noise: anomalyPoints,
      iterations: this.nEstimators,
      convergence: true,
      silhouetteScore: 0,
      executionTime,
      algorithm: 'Isolation Forest',
      parameters: { nEstimators: this.nEstimators, contamination: this.contamination }
    };
  }

  private subsample(n: number): number[] {
    const sampleSize = Math.min(this.maxSamples, n);
    const indices: number[] = [];
    const used = new Set<number>();

    while (indices.length < sampleSize) {
      const idx = Math.floor(Math.random() * n);
      if (!used.has(idx)) {
        indices.push(idx);
        used.add(idx);
      }
    }

    return indices;
  }

  private buildTree(data: number[][], currentHeight: number, heightLimit: number): IsolationTree {
    if (currentHeight >= heightLimit || data.length <= 1) {
      return { size: data.length, left: null, right: null, splitAttr: -1, splitValue: 0 };
    }

    const dim = data[0].length;
    const splitAttr = Math.floor(Math.random() * dim);
    
    const values = data.map(d => d[splitAttr]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const splitValue = min + Math.random() * (max - min);

    const leftData = data.filter(d => d[splitAttr] < splitValue);
    const rightData = data.filter(d => d[splitAttr] >= splitValue);

    return {
      size: data.length,
      splitAttr,
      splitValue,
      left: this.buildTree(leftData, currentHeight + 1, heightLimit),
      right: this.buildTree(rightData, currentHeight + 1, heightLimit)
    };
  }

  private anomalyScore(feature: number[]): number {
    const pathLengths = this.trees.map(tree => this.pathLength(feature, tree, 0));
    const avgPathLength = pathLengths.reduce((sum, l) => sum + l, 0) / pathLengths.length;
    
    // Normalize path length
    const expectedPathLength = this.c(this.maxSamples);
    return Math.pow(2, -avgPathLength / expectedPathLength);
  }

  private pathLength(feature: number[], tree: IsolationTree, currentHeight: number): number {
    if (tree.left === null || tree.right === null) {
      return currentHeight + this.c(tree.size);
    }

    if (feature[tree.splitAttr] < tree.splitValue) {
      return this.pathLength(feature, tree.left!, currentHeight + 1);
    } else {
      return this.pathLength(feature, tree.right!, currentHeight + 1);
    }
  }

  private c(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - 2 * (n - 1) / n;
  }

  private calculateProtocolDistribution(points: NetworkFlow[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    points.forEach(p => {
      distribution[p.protocol] = (distribution[p.protocol] || 0) + 1;
    });
    return distribution;
  }
}

interface IsolationTree {
  size: number;
  splitAttr: number;
  splitValue: number;
  left: IsolationTree | null;
  right: IsolationTree | null;
}

// Export factory functions
export const meanShift = (flows: NetworkFlow[], bandwidth?: number): ClusteringResult => {
  const clusterer = new MeanShiftClustering({ bandwidth });
  return clusterer.cluster(flows);
};

export const gaussianMixtureModel = (flows: NetworkFlow[], k: number = 3): ClusteringResult => {
  const clusterer = new GaussianMixtureModel({ k });
  return clusterer.cluster(flows);
};

export const selfOrganizingMap = (flows: NetworkFlow[], gridSize: number = 3): ClusteringResult => {
  const clusterer = new SelfOrganizingMap({ k: gridSize });
  return clusterer.cluster(flows);
};

export const isolationForest = (flows: NetworkFlow[], nEstimators: number = 100, contamination: number = 0.1): ClusteringResult => {
  const clusterer = new IsolationForest({ nEstimators, contamination });
  return clusterer.cluster(flows);
};
