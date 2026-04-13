// Utility functions for clustering algorithms

import type { NetworkFlow } from '@/types';
import { DistanceMetric } from '@/types';

// Feature extraction from network flows
export function extractFeatures(flow: NetworkFlow): number[] {
  return [
    // Normalized features for clustering
    flow.byteCount,
    flow.packetCount,
    flow.duration,
    flow.sourcePort,
    flow.destinationPort,
    flow.ttl,
    flow.windowSize,
    // Protocol encoding (one-hot-like)
    flow.protocol === 'TCP' ? 1 : 0,
    flow.protocol === 'UDP' ? 1 : 0,
    flow.protocol === 'HTTP' ? 1 : 0,
    flow.protocol === 'HTTPS' ? 1 : 0,
    flow.protocol === 'DNS' ? 1 : 0,
    // Time-based features
    new Date(flow.timestamp).getHours(),
    new Date(flow.timestamp).getDay(),
    // Flag features
    flow.flags.syn ? 1 : 0,
    flow.flags.ack ? 1 : 0,
    flow.flags.fin ? 1 : 0,
    flow.flags.rst ? 1 : 0,
    flow.flags.psh ? 1 : 0,
    flow.flags.urg ? 1 : 0
  ];
}

// Feature normalization using min-max scaling
export function normalizeFeatures(features: number[][]): number[][] {
  if (features.length === 0) return [];
  
  const dim = features[0].length;
  
  // Calculate min and max for each dimension
  const mins = new Array(dim).fill(Infinity);
  const maxs = new Array(dim).fill(-Infinity);
  
  for (const feature of features) {
    for (let i = 0; i < dim; i++) {
      mins[i] = Math.min(mins[i], feature[i]);
      maxs[i] = Math.max(maxs[i], feature[i]);
    }
  }
  
  // Normalize features
  return features.map(feature => {
    return feature.map((value, i) => {
      const range = maxs[i] - mins[i];
      return range > 0 ? (value - mins[i]) / range : 0;
    });
  });
}

// Z-score normalization
export function zScoreNormalize(features: number[][]): number[][] {
  if (features.length === 0) return [];
  
  const dim = features[0].length;
  
  // Calculate mean and standard deviation for each dimension
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(0);
  
  for (const feature of features) {
    for (let i = 0; i < dim; i++) {
      means[i] += feature[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    means[i] /= features.length;
  }
  
  for (const feature of features) {
    for (let i = 0; i < dim; i++) {
      stds[i] += Math.pow(feature[i] - means[i], 2);
    }
  }
  
  for (let i = 0; i < dim; i++) {
    stds[i] = Math.sqrt(stds[i] / features.length);
  }
  
  // Normalize features
  return features.map(feature => {
    return feature.map((value, i) => {
      return stds[i] > 0 ? (value - means[i]) / stds[i] : 0;
    });
  });
}

// Calculate distance between two points
export function calculateDistance(
  point1: number[],
  point2: number[],
  metric: DistanceMetric
): number {
  switch (metric) {
    case DistanceMetric.EUCLIDEAN:
      return euclideanDistance(point1, point2);
    case DistanceMetric.MANHATTAN:
      return manhattanDistance(point1, point2);
    case DistanceMetric.COSINE:
      return cosineDistance(point1, point2);
    case DistanceMetric.CHEBYSHEV:
      return chebyshevDistance(point1, point2);
    case DistanceMetric.MINKOWSKI:
      return minkowskiDistance(point1, point2, 3);
    default:
      return euclideanDistance(point1, point2);
  }
}

// Euclidean distance
export function euclideanDistance(point1: number[], point2: number[]): number {
  let sum = 0;
  for (let i = 0; i < point1.length; i++) {
    sum += Math.pow(point1[i] - point2[i], 2);
  }
  return Math.sqrt(sum);
}

// Manhattan distance
export function manhattanDistance(point1: number[], point2: number[]): number {
  let sum = 0;
  for (let i = 0; i < point1.length; i++) {
    sum += Math.abs(point1[i] - point2[i]);
  }
  return sum;
}

// Cosine distance
export function cosineDistance(point1: number[], point2: number[]): number {
  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;
  
  for (let i = 0; i < point1.length; i++) {
    dotProduct += point1[i] * point2[i];
    norm1 += Math.pow(point1[i], 2);
    norm2 += Math.pow(point2[i], 2);
  }
  
  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);
  
  if (norm1 === 0 || norm2 === 0) return 1;
  
  return 1 - (dotProduct / (norm1 * norm2));
}

// Chebyshev distance
export function chebyshevDistance(point1: number[], point2: number[]): number {
  let max = 0;
  for (let i = 0; i < point1.length; i++) {
    max = Math.max(max, Math.abs(point1[i] - point2[i]));
  }
  return max;
}

// Minkowski distance
export function minkowskiDistance(point1: number[], point2: number[], p: number): number {
  let sum = 0;
  for (let i = 0; i < point1.length; i++) {
    sum += Math.pow(Math.abs(point1[i] - point2[i]), p);
  }
  return Math.pow(sum, 1 / p);
}

// Calculate centroid of a set of points
export function calculateCentroid(points: number[][]): number[] {
  if (points.length === 0) return [];
  
  const dim = points[0].length;
  const centroid = new Array(dim).fill(0);
  
  for (const point of points) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += point[i];
    }
  }
  
  for (let i = 0; i < dim; i++) {
    centroid[i] /= points.length;
  }
  
  return centroid;
}

// Calculate variance of a set of points
export function calculateVariance(points: number[][]): number[] {
  if (points.length === 0) return [];
  
  const centroid = calculateCentroid(points);
  const dim = points[0].length;
  const variance = new Array(dim).fill(0);
  
  for (const point of points) {
    for (let i = 0; i < dim; i++) {
      variance[i] += Math.pow(point[i] - centroid[i], 2);
    }
  }
  
  for (let i = 0; i < dim; i++) {
    variance[i] /= points.length;
  }
  
  return variance;
}

// Calculate covariance matrix
export function calculateCovarianceMatrix(points: number[][]): number[][] {
  if (points.length === 0) return [];
  
  const centroid = calculateCentroid(points);
  const dim = points[0].length;
  const covariance: number[][] = Array(dim).fill(null).map(() => Array(dim).fill(0));
  
  for (const point of points) {
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        covariance[i][j] += (point[i] - centroid[i]) * (point[j] - centroid[j]);
      }
    }
  }
  
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      covariance[i][j] /= points.length;
    }
  }
  
  return covariance;
}

// Matrix operations
export function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [];
  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < b.length; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }
  return result;
}

export function transpose(matrix: number[][]): number[][] {
  return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

// Principal Component Analysis (PCA)
export function pca(features: number[][], components: number = 2): { components: number[][]; explainedVariance: number[] } {
  if (features.length === 0) return { components: [], explainedVariance: [] };
  
  // Normalize features
  const normalized = normalizeFeatures(features);
  
  // Calculate covariance matrix
  const covMatrix = calculateCovarianceMatrix(normalized);
  
  // Power iteration to find eigenvectors (simplified)
  const eigenvectors: number[][] = [];
  const eigenvalues: number[] = [];
  
  for (let c = 0; c < components; c++) {
    let vector = Array(covMatrix.length).fill(0).map(() => Math.random());
    
    // Normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    vector = vector.map(v => v / norm);
    
    // Power iteration
    for (let iter = 0; iter < 100; iter++) {
      // Multiply with covariance matrix
      const newVector = covMatrix.map(row => 
        row.reduce((sum, val, i) => sum + val * vector[i], 0)
      );
      
      // Normalize
      const newNorm = Math.sqrt(newVector.reduce((sum, v) => sum + v * v, 0));
      vector = newVector.map(v => v / newNorm);
    }
    
    eigenvectors.push(vector);
    
    // Calculate eigenvalue
    const eigenvalue = covMatrix.reduce((sum, row, i) => 
      sum + row.reduce((s, val, j) => s + val * vector[j], 0) * vector[i], 0
    );
    eigenvalues.push(eigenvalue);
    
    // Deflate covariance matrix
    for (let i = 0; i < covMatrix.length; i++) {
      for (let j = 0; j < covMatrix.length; j++) {
        covMatrix[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }
  
  // Project data onto principal components
  const projected = normalized.map(point => {
    return eigenvectors.map(eigenvector => {
      return point.reduce((sum, val, i) => sum + val * eigenvector[i], 0);
    });
  });
  
  // Calculate explained variance
  const totalVariance = eigenvalues.reduce((sum, v) => sum + v, 0);
  const explainedVariance = eigenvalues.map(v => v / totalVariance);
  
  return { components: projected, explainedVariance };
}

// t-SNE (t-Distributed Stochastic Neighbor Embedding) - Simplified
export function tsne(features: number[][], dimensions: number = 2, perplexity: number = 30, iterations: number = 100): number[][] {
  if (features.length === 0) return [];
  
  // Initialize randomly
  const n = features.length;
  const result: number[][] = Array(n).fill(null).map(() => 
    Array(dimensions).fill(0).map(() => (Math.random() - 0.5) * 0.01)
  );
  
  // Calculate pairwise affinities in high-dimensional space
  const P = calculatePairwiseAffinities(features, perplexity);
  
  // Gradient descent
  const learningRate = 200;
  const momentum = 0.5;
  const gains = Array(n).fill(null).map(() => Array(dimensions).fill(1));
  const previousUpdate = Array(n).fill(null).map(() => Array(dimensions).fill(0));
  
  for (let iter = 0; iter < iterations; iter++) {
    // Calculate pairwise affinities in low-dimensional space
    const Q = calculateLowDimAffinities(result);
    
    // Calculate gradient
    const gradient = calculateGradient(P, Q, result);
    
    // Update with momentum and adaptive learning rate
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dimensions; d++) {
        // Adaptive gains
        if (Math.sign(gradient[i][d]) !== Math.sign(previousUpdate[i][d])) {
          gains[i][d] *= 0.8;
        } else {
          gains[i][d] += 0.2;
        }
        gains[i][d] = Math.max(gains[i][d], 0.01);
        
        // Update
        const update = momentum * previousUpdate[i][d] - learningRate * gains[i][d] * gradient[i][d];
        result[i][d] += update;
        previousUpdate[i][d] = update;
      }
    }
    
    // Center the result
    const mean = Array(dimensions).fill(0);
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dimensions; d++) {
        mean[d] += result[i][d];
      }
    }
    for (let d = 0; d < dimensions; d++) {
      mean[d] /= n;
    }
    for (let i = 0; i < n; i++) {
      for (let d = 0; d < dimensions; d++) {
        result[i][d] -= mean[d];
      }
    }
  }
  
  return result;
}

function calculatePairwiseAffinities(features: number[][], perplexity: number): number[][] {
  const n = features.length;
  const P = Array(n).fill(null).map(() => Array(n).fill(0));
  
  for (let i = 0; i < n; i++) {
    // Find beta (precision) for this point
    let beta = 1;
    let minBeta = -Infinity;
    let maxBeta = Infinity;
    const tolerance = 1e-5;
    
    for (let iter = 0; iter < 50; iter++) {
      let sumP = 0;
      const distances: number[] = [];
      
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const dist = euclideanDistance(features[i], features[j]);
          distances[j] = Math.exp(-dist * dist * beta);
          sumP += distances[j];
        }
      }
      
      // Calculate entropy
      let H = 0;
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          const p = distances[j] / sumP;
          H += p * Math.log(p + 1e-10);
        }
      }
      H = -H;
      
      const diffH = H - Math.log(perplexity);
      
      if (Math.abs(diffH) < tolerance) break;
      
      if (diffH > 0) {
        minBeta = beta;
        beta = maxBeta === Infinity ? beta * 2 : (beta + maxBeta) / 2;
      } else {
        maxBeta = beta;
        beta = minBeta === -Infinity ? beta / 2 : (beta + minBeta) / 2;
      }
    }
    
    // Calculate final affinities
    let sumP = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const dist = euclideanDistance(features[i], features[j]);
        P[i][j] = Math.exp(-dist * dist * beta);
        sumP += P[i][j];
      }
    }
    
    for (let j = 0; j < n; j++) {
      P[i][j] /= sumP;
    }
  }
  
  // Symmetrize
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      P[i][j] = (P[i][j] + P[j][i]) / (2 * n);
      P[j][i] = P[i][j];
    }
  }
  
  return P;
}

function calculateLowDimAffinities(points: number[][]): number[][] {
  const n = points.length;
  const Q = Array(n).fill(null).map(() => Array(n).fill(0));
  let sumQ = 0;
  
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = euclideanDistance(points[i], points[j]);
      const q = 1 / (1 + dist * dist);
      Q[i][j] = q;
      Q[j][i] = q;
      sumQ += 2 * q;
    }
  }
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      Q[i][j] /= sumQ;
    }
  }
  
  return Q;
}

function calculateGradient(P: number[][], Q: number[][], points: number[][]): number[][] {
  const n = points.length;
  const dim = points[0].length;
  const gradient = Array(n).fill(null).map(() => Array(dim).fill(0));
  
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        const dist = euclideanDistance(points[i], points[j]);
        const factor = 4 * (P[i][j] - Q[i][j]) / (1 + dist * dist);
        
        for (let d = 0; d < dim; d++) {
          gradient[i][d] += factor * (points[i][d] - points[j][d]);
        }
      }
    }
  }
  
  return gradient;
}

// Silhouette analysis
export function silhouetteAnalysis(features: number[][], assignments: number[]): { score: number; perCluster: number[] } {
  const n = features.length;
  if (n === 0) return { score: 0, perCluster: [] };
  
  const uniqueClusters = Array.from(new Set(assignments)).filter(id => id !== -1);
  const perClusterScores: number[] = [];
  
  let totalScore = 0;
  let validPoints = 0;
  
  for (const clusterId of uniqueClusters) {
    let clusterScore = 0;
    let clusterPoints = 0;
    
    for (let i = 0; i < n; i++) {
      if (assignments[i] !== clusterId) continue;
      
      validPoints++;
      clusterPoints++;
      
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
      
      // Silhouette score for point i
      const maxAB = Math.max(a, b);
      const score = maxAB > 0 ? (b - a) / maxAB : 0;
      clusterScore += score;
      totalScore += score;
    }
    
    perClusterScores.push(clusterPoints > 0 ? clusterScore / clusterPoints : 0);
  }
  
  return {
    score: validPoints > 0 ? totalScore / validPoints : 0,
    perCluster: perClusterScores
  };
}

// Elbow method for optimal k
export function elbowMethod(features: number[][], maxK: number = 10): { k: number; inertias: number[] } {
  const inertias: number[] = [];
  
  for (let k = 1; k <= maxK; k++) {
    // Simple k-means
    const normalized = normalizeFeatures(features);
    const centroids: number[][] = [];
    const usedIndices = new Set<number>();
    
    while (centroids.length < k && usedIndices.size < normalized.length) {
      const randomIndex = Math.floor(Math.random() * normalized.length);
      if (!usedIndices.has(randomIndex)) {
        centroids.push([...normalized[randomIndex]]);
        usedIndices.add(randomIndex);
      }
    }
    
    // Run a few iterations
    for (let iter = 0; iter < 20; iter++) {
      const assignments = normalized.map(point => {
        let minDist = Infinity;
        let closest = 0;
        for (let i = 0; i < centroids.length; i++) {
          const dist = euclideanDistance(point, centroids[i]);
          if (dist < minDist) {
            minDist = dist;
            closest = i;
          }
        }
        return closest;
      });
      
      // Update centroids
      for (let i = 0; i < k; i++) {
        const clusterPoints = normalized.filter((_, idx) => assignments[idx] === i);
        if (clusterPoints.length > 0) {
          centroids[i] = calculateCentroid(clusterPoints);
        }
      }
    }
    
    // Calculate inertia
    let inertia = 0;
    for (let i = 0; i < normalized.length; i++) {
      const point = normalized[i];
      let minDist = Infinity;
      for (const centroid of centroids) {
        minDist = Math.min(minDist, euclideanDistance(point, centroid));
      }
      inertia += minDist * minDist;
    }
    
    inertias.push(inertia);
  }
  
  // Find elbow point
  const optimalK = findElbowPoint(inertias);
  
  return { k: optimalK, inertias };
}

function findElbowPoint(values: number[]): number {
  if (values.length < 3) return 1;
  
  const n = values.length;
  const firstPoint = { x: 0, y: values[0] };
  const lastPoint = { x: n - 1, y: values[n - 1] };
  
  let maxDistance = 0;
  let elbowIndex = 0;
  
  for (let i = 0; i < n; i++) {
    const distance = pointToLineDistance(
      { x: i, y: values[i] },
      firstPoint,
      lastPoint
    );
    
    if (distance > maxDistance) {
      maxDistance = distance;
      elbowIndex = i;
    }
  }
  
  return elbowIndex + 1;
}

function pointToLineDistance(
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
