import React, { useRef, useMemo, useState, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
import type { NetworkFlow, Cluster } from '@/types';

interface Cluster3DProps {
  flows: NetworkFlow[];
  clusters: Cluster[];
  selectedCluster?: number | null;
  onClusterSelect?: (clusterId: number) => void;
  onFlowSelect?: (flow: NetworkFlow) => void;
}

interface Point3D {
  position: [number, number, number];
  flow: NetworkFlow;
  clusterId: number;
  color: string;
}

// ─── Inline PCA (3 components) ──────────────────────────────────────────────
// Same approach as ClusterCanvas — avoids the broken utils version.

function miniPCA3(data: number[][]): [number[], number[], number[]] {
  const n   = data.length;
  const dim = data[0].length;

  // Centre and normalise
  const mean = Array(dim).fill(0);
  for (const row of data) for (let j = 0; j < dim; j++) mean[j] += row[j] / n;
  const centred = data.map(row => row.map((v, j) => v - mean[j]));
  const vari    = Array(dim).fill(0);
  for (const row of centred) for (let j = 0; j < dim; j++) vari[j] += row[j] ** 2 / n;
  const std  = vari.map(v => Math.sqrt(v) || 1);
  const norm = centred.map(row => row.map((v, j) => v / std[j]));

  function powerIter(deflations: number[][]): number[] {
    let vec = Array(dim).fill(0).map(() => Math.random() - 0.5);
    // Deflate against already-found components
    for (const d of deflations) {
      const dot = vec.reduce((s, v, i) => s + v * d[i], 0);
      vec = vec.map((v, i) => v - dot * d[i]);
    }
    let len = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    vec = vec.map(v => v / len);

    for (let iter = 0; iter < 60; iter++) {
      const proj   = norm.map(row => row.reduce((s, v, j) => s + v * vec[j], 0));
      const newVec = Array(dim).fill(0);
      for (let i = 0; i < n; i++) for (let j = 0; j < dim; j++) newVec[j] += proj[i] * norm[i][j];
      for (let j = 0; j < dim; j++) newVec[j] /= n;
      for (const d of deflations) {
        const dot = newVec.reduce((s, v, i) => s + v * d[i], 0);
        for (let j = 0; j < dim; j++) newVec[j] -= dot * d[j];
      }
      len = Math.sqrt(newVec.reduce((s, v) => s + v * v, 0)) || 1;
      vec = newVec.map(v => v / len);
    }
    return vec;
  }

  const pc1 = powerIter([]);
  const pc2 = powerIter([pc1]);
  const pc3 = powerIter([pc1, pc2]);

  const project = (pc: number[]) => norm.map(row => row.reduce((s, v, j) => s + v * pc[j], 0));
  return [project(pc1), project(pc2), project(pc3)];
}

function normalise3(vals: number[]): number[] {
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const r   = max - min || 1;
  return vals.map(v => ((v - min) / r - 0.5) * 10);
}

// ─── Point cloud ─────────────────────────────────────────────────────────────

const PointCloud: React.FC<{
  points: Point3D[];
  selectedCluster: number | null;
  onPointClick: (point: Point3D) => void;
}> = ({ points, selectedCluster, onPointClick }) => {
  const meshRef  = useRef<THREE.InstancedMesh>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const geometry = useMemo(() => new THREE.SphereGeometry(0.05, 8, 8), []);
  const material = useMemo(() => new THREE.MeshBasicMaterial(), []);

  useFrame(() => {
    if (!meshRef.current) return;
    const matrix = new THREE.Matrix4();
    const color  = new THREE.Color();

    points.forEach((pt, i) => {
      matrix.setPosition(...pt.position);
      meshRef.current!.setMatrixAt(i, matrix);
      if (hovered === i)                                                   color.set('#ffffff');
      else if (selectedCluster !== null && pt.clusterId !== selectedCluster) color.set('#333333');
      else                                                                   color.set(pt.color);
      meshRef.current!.setColorAt(i, color);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) onPointClick(points[e.instanceId]);
  }, [points, onPointClick]);

  if (points.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, points.length]}
      onClick={handleClick}
      onPointerMove={e => { if (e.instanceId !== undefined) setHovered(e.instanceId); }}
      onPointerOut={() => setHovered(null)}
    />
  );
};

// ─── Cluster bounding box ────────────────────────────────────────────────────

const ClusterHull: React.FC<{
  points: Point3D[];
  cluster: Cluster;
  isSelected: boolean;
}> = ({ points, cluster, isSelected }) => {
  const pts = points.filter(p => p.clusterId === cluster.id);
  if (pts.length < 4) return null;

  const pos = pts.map(p => p.position);
  const min = pos.reduce((a, p) => [Math.min(a[0], p[0]), Math.min(a[1], p[1]), Math.min(a[2], p[2])], [ Infinity,  Infinity,  Infinity]);
  const max = pos.reduce((a, p) => [Math.max(a[0], p[0]), Math.max(a[1], p[1]), Math.max(a[2], p[2])], [-Infinity, -Infinity, -Infinity]);

  const size:   [number, number, number] = [max[0]-min[0], max[1]-min[1], max[2]-min[2]];
  const center: [number, number, number] = [(min[0]+max[0])/2, (min[1]+max[1])/2, (min[2]+max[2])/2];

  return (
    <mesh position={center}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={cluster.color} transparent opacity={isSelected ? 0.3 : 0.1} wireframe={!isSelected} />
    </mesh>
  );
};

// ─── Cluster label ───────────────────────────────────────────────────────────

const ClusterLabel: React.FC<{ points: Point3D[]; cluster: Cluster }> = ({ points, cluster }) => {
  const pts = points.filter(p => p.clusterId === cluster.id);
  if (pts.length === 0) return null;

  const cx = pts.reduce((s, p) => s + p.position[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.position[1], 0) / pts.length;
  const cz = pts.reduce((s, p) => s + p.position[2], 0) / pts.length;

  return (
    <Text position={[cx, cy + 0.5, cz]} fontSize={0.2} color={cluster.color} anchorX="center" anchorY="middle">
      {`C${cluster.id} (${cluster.size})`}
    </Text>
  );
};

// ─── Scene ───────────────────────────────────────────────────────────────────

const Scene: React.FC<Cluster3DProps> = ({ flows, clusters, selectedCluster, onClusterSelect, onFlowSelect }) => {

  // FIX: Build flowId → {clusterId, color} from cluster.points (same fix as ClusterCanvas).
  //      flow.clusterId on the original flows array is never set by kmeans.
  const clusterLookup = useMemo(() => {
    const map = new Map<string, { clusterId: number; color: string }>();
    for (const c of clusters) {
      for (const p of c.points) map.set(p.id, { clusterId: c.id, color: c.color });
    }
    return map;
  }, [clusters]);

  const points3D = useMemo((): Point3D[] => {
    if (flows.length === 0) return [];

    // Sample max 500 for performance
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

    let xs: number[], ys: number[], zs: number[];
    try {
      [xs, ys, zs] = miniPCA3(features);
    } catch {
      // Fallback: spread by index, byteCount, packetCount
      xs = sample.map((_, i) => i);
      ys = sample.map(f => f.byteCount);
      zs = sample.map(f => f.packetCount);
    }

    const nx = normalise3(xs);
    const ny = normalise3(ys);
    const nz = normalise3(zs);

    return sample.map((flow, i) => {
      const info      = clusterLookup.get(flow.id);
      const clusterId = info?.clusterId ?? -1;
      const color     = flow.isAnomaly ? '#ef4444' : (info?.color ?? '#94a3b8');
      return {
        position: [nx[i], ny[i], nz[i]] as [number, number, number],
        flow,
        clusterId,
        color,
      };
    });
  }, [flows, clusterLookup]);

  const handlePointClick = useCallback((pt: Point3D) => {
    onFlowSelect?.(pt.flow);
    if (pt.clusterId >= 0) onClusterSelect?.(pt.clusterId);
  }, [onFlowSelect, onClusterSelect]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <gridHelper args={[20, 20, '#444444', '#222222']} />
      <axesHelper args={[5]} />

      <PointCloud
        points={points3D}
        selectedCluster={selectedCluster ?? null}
        onPointClick={handlePointClick}
      />

      {clusters.map(c => (
        <ClusterHull key={c.id} points={points3D} cluster={c} isSelected={selectedCluster === c.id} />
      ))}
      {clusters.map(c => (
        <ClusterLabel key={`lbl-${c.id}`} points={points3D} cluster={c} />
      ))}

      <OrbitControls enablePan enableZoom enableRotate />
    </>
  );
};

// ─── Main export ─────────────────────────────────────────────────────────────

export const Cluster3D: React.FC<Cluster3DProps> = (props) => (
  <div className="w-full h-[600px] bg-gray-900 rounded-lg overflow-hidden">
    <Canvas camera={{ position: [8, 8, 8], fov: 60 }} gl={{ antialias: true }}>
      <Scene {...props} />
    </Canvas>
  </div>
);

export default Cluster3D;