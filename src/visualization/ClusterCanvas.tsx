import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { NetworkFlow, Cluster, VisualizationConfig } from '@/types';

interface ClusterCanvasProps {
  flows: NetworkFlow[];
  clusters: Cluster[];
  width?: number;
  height?: number;
  selectedCluster?: number | null;
  onClusterSelect?: (clusterId: number) => void;
  onFlowSelect?: (flow: NetworkFlow) => void;
  config?: Partial<VisualizationConfig>;
  reductionMethod?: 'pca' | 'tsne';
}

interface Point2D {
  x: number;
  y: number;
  flow: NetworkFlow;
  clusterId: number;
  color: string;
}

// ─── Lightweight PCA (2 components) ────────────────────────────────────────
// Runs entirely in this file so we don't depend on the broken utils PCA.
// Uses power-iteration on the centred, normalised feature matrix.

function miniPCA(data: number[][]): [number[], number[]] {
  const n   = data.length;
  const dim = data[0].length;

  // Centre
  const mean = Array(dim).fill(0);
  for (const row of data) for (let j = 0; j < dim; j++) mean[j] += row[j] / n;
  const centred = data.map(row => row.map((v, j) => v - mean[j]));

  // Variance per dimension for normalisation
  const vari = Array(dim).fill(0);
  for (const row of centred) for (let j = 0; j < dim; j++) vari[j] += row[j] ** 2 / n;
  const std = vari.map(v => Math.sqrt(v) || 1);
  const norm = centred.map(row => row.map((v, j) => v / std[j]));

  // Power iteration — two orthogonal vectors
  function powerIter(matrix: number[][], deflate?: number[]): number[] {
    let vec = Array(dim).fill(0).map(() => Math.random() - 0.5);
    if (deflate) {
      // Gram-Schmidt: remove component along `deflate`
      const dot = vec.reduce((s, v, i) => s + v * deflate[i], 0);
      vec = vec.map((v, i) => v - dot * deflate[i]);
    }
    // Normalise
    let len = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    vec = vec.map(v => v / len);

    for (let iter = 0; iter < 60; iter++) {
      // Multiply: cov × vec  (cov = Xᵀ X / n, but we use X (X·vec))
      const proj = matrix.map(row => row.reduce((s, v, j) => s + v * vec[j], 0));
      const newVec = Array(dim).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < dim; j++) newVec[j] += proj[i] * matrix[i][j];
      for (let j = 0; j < dim; j++) newVec[j] /= n;

      if (deflate) {
        const d = newVec.reduce((s, v, i) => s + v * deflate[i], 0);
        for (let j = 0; j < dim; j++) newVec[j] -= d * deflate[j];
      }
      len = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0)) || 1;
      vec = newVec.map(v => v / len);
    }
    return vec;
  }

  const pc1 = powerIter(norm);
  const pc2 = powerIter(norm, pc1);

  const comp1 = norm.map(row => row.reduce((s, v, j) => s + v * pc1[j], 0));
  const comp2 = norm.map(row => row.reduce((s, v, j) => s + v * pc2[j], 0));
  return [comp1, comp2];
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ClusterCanvas: React.FC<ClusterCanvasProps> = ({
  flows,
  clusters,
  width  = 800,
  height = 600,
  selectedCluster = null,
  onClusterSelect,
  onFlowSelect,
  config = {},
}) => {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const pointsRef   = useRef<Point2D[]>([]);
  const animFrameRef = useRef<number>(0);

  const vizConfig = {
    padding:          50,
    showGrid:         true,
    showLabels:       true,
    animationEnabled: false,   // static draw — animation was causing unnecessary repaints
    pointRadius:      4,
    clusterOpacity:   0.75,
    ...config,
  };

  // FIX: useMemo so the map is always in sync with the clusters prop.
  //      useCallback was returning a stale closure when clusters updated.
  const flowClusterMap = useMemo(() => {
    const map = new Map<string, { clusterId: number; color: string }>();
    for (const cluster of clusters) {
      for (const point of cluster.points) {
        map.set(point.id, { clusterId: cluster.id, color: cluster.color });
      }
    }
    return map;
  }, [clusters]);

  // FIX: Use our inline PCA — avoids the broken utils version and gives
  //      proper normalisation so all features contribute equally.
  const get2DCoords = useCallback((): { x: number; y: number }[] => {
    if (flows.length === 0) return [];

    // Sample max 500 flows for performance — canvas gets crowded beyond that anyway
    const sample = flows.length > 500
      ? flows.filter((_, i) => i % Math.ceil(flows.length / 500) === 0)
      : flows;

    const features = sample.map(f => [
      f.byteCount,
      f.packetCount,
      f.duration,
      f.sourcePort,
      f.destinationPort,
      f.ttl,
      f.windowSize,
      f.flags.syn ? 1 : 0,
      f.flags.ack ? 1 : 0,
    ]);

    try {
      const [comp1, comp2] = miniPCA(features);
      return comp1.map((x, i) => ({ x, y: comp2[i] }));
    } catch {
      // Final fallback: spread by timestamp + byteCount so points aren't stacked
      return sample.map(f => ({
        x: (f.timestamp % 1_000_000) / 1_000_000,
        y: f.byteCount,
      }));
    }
  }, [flows]);

  const normalise = useCallback((coords: { x: number; y: number }[], w: number, h: number) => {
    if (coords.length === 0) return [];
    const xs  = coords.map(c => c.x);
    const ys  = coords.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const rX  = maxX - minX || 1;
    const rY  = maxY - minY || 1;
    const pad = vizConfig.padding;
    return coords.map(c => ({
      x: pad + ((c.x - minX) / rX) * (w - 2 * pad),
      y: h - pad - ((c.y - minY) / rY) * (h - 2 * pad),
    }));
  }, [vizConfig.padding]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Grid
    if (vizConfig.showGrid) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth   = 1;
      for (let x = vizConfig.padding; x < W - vizConfig.padding; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, vizConfig.padding); ctx.lineTo(x, H - vizConfig.padding); ctx.stroke();
      }
      for (let y = vizConfig.padding; y < H - vizConfig.padding; y += 50) {
        ctx.beginPath(); ctx.moveTo(vizConfig.padding, y); ctx.lineTo(W - vizConfig.padding, y); ctx.stroke();
      }
    }

    // Axes
    ctx.strokeStyle = '#64748b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(vizConfig.padding, H - vizConfig.padding);
    ctx.lineTo(W - vizConfig.padding, H - vizConfig.padding); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(vizConfig.padding, vizConfig.padding);
    ctx.lineTo(vizConfig.padding, H - vizConfig.padding); ctx.stroke();

    if (flows.length === 0) {
      ctx.fillStyle = '#94a3b8';
      ctx.font      = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('No flows to display', W / 2, H / 2);
      return;
    }

    const raw    = get2DCoords();
    const coords = normalise(raw, W, H);

    // FIX: use the memoised map directly — not called as a function
    const clusterLookup = flowClusterMap;

    // Sample flows to match coords (same sampling as get2DCoords)
    const sample = flows.length > 500
      ? flows.filter((_, i) => i % Math.ceil(flows.length / 500) === 0)
      : flows;

    // Build point list
    pointsRef.current = sample.map((flow, i) => {
      const info      = clusterLookup.get(flow.id);
      const clusterId = info?.clusterId ?? -1;
      // FIX: color from cluster map — not from flow.clusterId which is never set
      const color     = flow.isAnomaly
        ? '#ef4444'
        : (info?.color ?? '#94a3b8');
      return { x: coords[i]?.x ?? 0, y: coords[i]?.y ?? 0, flow, clusterId, color };
    });

    // Cluster hulls
    clusters.forEach(cluster => {
      if (selectedCluster !== null && cluster.id !== selectedCluster) return;
      const pts = pointsRef.current.filter(p => p.clusterId === cluster.id);
      if (pts.length < 3) return;
      const hull = convexHull(pts);
      if (hull.length < 3) return;
      ctx.fillStyle   = cluster.color + '22';
      ctx.strokeStyle = cluster.color;
      ctx.lineWidth   = 1.5;
      ctx.beginPath();
      ctx.moveTo(hull[0].x, hull[0].y);
      hull.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath(); ctx.fill(); ctx.stroke();
    });

    // Points
    pointsRef.current.forEach(pt => {
      ctx.globalAlpha = (selectedCluster !== null && pt.clusterId !== selectedCluster) ? 0.1 : vizConfig.clusterOpacity;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, vizConfig.pointRadius, 0, Math.PI * 2);
      ctx.fillStyle = pt.color;
      ctx.fill();
      if (pt.flow.isAnomaly) {
        ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2; ctx.stroke();
      }
    });
    ctx.globalAlpha = 1;

    // Labels
    if (vizConfig.showLabels) {
      clusters.forEach(cluster => {
        const pts = pointsRef.current.filter(p => p.clusterId === cluster.id);
        if (pts.length === 0) return;
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        ctx.font      = 'bold 11px sans-serif';
        ctx.fillStyle = cluster.color;
        ctx.textAlign = 'left';
        ctx.fillText(`C${cluster.id} (${cluster.size})`, cx + 6, cy - 6);
      });
    }
  }, [flows, clusters, selectedCluster, vizConfig, get2DCoords, normalise, flowClusterMap]);
  useEffect(() => {
    draw();
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [draw]);

  const findNearest = (e: React.MouseEvent<HTMLCanvasElement>): Point2D | null => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: Point2D | null = null;
    let min = Infinity;
    for (const p of pointsRef.current) {
      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < min && d < 20) { min = d; best = p; }
    }
    return best;
  };

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onMouseMove={e => { if (canvasRef.current) canvasRef.current.style.cursor = findNearest(e) ? 'pointer' : 'default'; }}
      onClick={e => {
        const pt = findNearest(e);
        if (!pt) return;
        onFlowSelect?.(pt.flow);
        if (pt.clusterId >= 0) onClusterSelect?.(pt.clusterId);
      }}
      className="border border-gray-200 rounded-lg bg-white w-full"
      style={{ maxWidth: width }}
    />
  );
};

// ─── Convex hull (Graham scan) ───────────────────────────────────────────────

function convexHull(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 3) return pts;
  const sorted = [...pts].sort((a, b) => a.y - b.y || a.x - b.x);
  const pivot  = sorted[0];
  const rest   = sorted.slice(1).sort((a, b) => {
    const da = Math.atan2(a.y - pivot.y, a.x - pivot.x);
    const db = Math.atan2(b.y - pivot.y, b.x - pivot.x);
    return da - db;
  });
  const hull: typeof pts = [pivot];
  for (const p of rest) {
    while (hull.length > 1) {
      const o = hull[hull.length - 2], a = hull[hull.length - 1];
      if ((a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x) <= 0) hull.pop();
      else break;
    }
    hull.push(p);
  }
  return hull;
}

export default ClusterCanvas;