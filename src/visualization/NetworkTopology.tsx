import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { NetworkFlow, NetworkNode, NetworkEdge } from '@/types';
import { ProtocolType } from '@/types';

interface NetworkTopologyProps {
  flows: NetworkFlow[];
  width?: number;
  height?: number;
  onNodeSelect?: (node: NetworkNode) => void;
  onEdgeSelect?: (edge: NetworkEdge) => void;
}

export const NetworkTopology: React.FC<NetworkTopologyProps> = ({
  flows,
  width = 800,
  height = 600,
  onNodeSelect,
  onEdgeSelect
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<NetworkNode, NetworkEdge> | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Build network graph from flows
  const buildGraph = useCallback((): { nodes: NetworkNode[]; edges: NetworkEdge[] } => {
    const nodeMap = new Map<string, NetworkNode>();
    const edgeMap = new Map<string, NetworkEdge>();

    flows.forEach(flow => {
      // Create or update source node
      if (!nodeMap.has(flow.sourceIP)) {
        nodeMap.set(flow.sourceIP, {
          id: flow.sourceIP,
          ip: flow.sourceIP,
          type: 'source',
          x: Math.random() * width,
          y: Math.random() * height,
          connections: [],
          flowCount: 0,
          byteCount: 0,
          isAnomaly: false
        });
      }
      const sourceNode = nodeMap.get(flow.sourceIP)!;
      sourceNode.flowCount++;
      sourceNode.byteCount += flow.byteCount;
      sourceNode.isAnomaly = sourceNode.isAnomaly || flow.isAnomaly || false;

      // Create or update destination node
      if (!nodeMap.has(flow.destinationIP)) {
        nodeMap.set(flow.destinationIP, {
          id: flow.destinationIP,
          ip: flow.destinationIP,
          type: 'destination',
          x: Math.random() * width,
          y: Math.random() * height,
          connections: [],
          flowCount: 0,
          byteCount: 0,
          isAnomaly: false
        });
      }
      const destNode = nodeMap.get(flow.destinationIP)!;
      destNode.flowCount++;
      destNode.byteCount += flow.byteCount;
      destNode.isAnomaly = destNode.isAnomaly || flow.isAnomaly || false;

      // Create or update edge
      const edgeKey = `${flow.sourceIP}-${flow.destinationIP}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          source: flow.sourceIP,
          target: flow.destinationIP,
          weight: 0,
          protocol: flow.protocol,
          flowCount: 0,
          byteCount: 0,
          isAnomaly: false
        });
      }
      const edge = edgeMap.get(edgeKey)!;
      edge.weight++;
      edge.flowCount++;
      edge.byteCount += flow.byteCount;
      edge.isAnomaly = edge.isAnomaly || flow.isAnomaly || false;

      // Update connections
      if (!sourceNode.connections.includes(flow.destinationIP)) {
        sourceNode.connections.push(flow.destinationIP);
      }
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values())
    };
  }, [flows, width, height]);

  // Get node color based on type and anomaly status
  const getNodeColor = (node: NetworkNode): string => {
    if (node.isAnomaly) return '#ef4444';
    if (node.type === 'source') return '#3b82f6';
    if (node.type === 'destination') return '#10b981';
    return '#94a3b8';
  };

  // Get node size based on flow count
  const getNodeSize = (node: NetworkNode): number => {
    const baseSize = 8;
    const scaleFactor = Math.log10(node.flowCount + 1);
    return baseSize + scaleFactor * 3;
  };

  // Get edge color based on protocol
  const getEdgeColor = (edge: NetworkEdge): string => {
    const protocolColors: Record<ProtocolType, string> = {
      [ProtocolType.TCP]: '#3b82f6',
      [ProtocolType.UDP]: '#10b981',
      [ProtocolType.ICMP]: '#f59e0b',
      [ProtocolType.HTTP]: '#8b5cf6',
      [ProtocolType.HTTPS]: '#6366f1',
      [ProtocolType.DNS]: '#ec4899',
      [ProtocolType.FTP]: '#f97316',
      [ProtocolType.SSH]: '#14b8a6',
      [ProtocolType.SMTP]: '#84cc16',
      [ProtocolType.UNKNOWN]: '#94a3b8'
    };
    return protocolColors[edge.protocol] || '#94a3b8';
  };

  // Get edge width based on weight
  const getEdgeWidth = (edge: NetworkEdge): number => {
    return Math.max(1, Math.log10(edge.weight) * 2);
  };

  useEffect(() => {
    if (!svgRef.current || flows.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { nodes, edges } = buildGraph();

    // Create container group
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create force simulation
    const simulation = d3.forceSimulation<NetworkNode>(nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkEdge>(edges)
        .id(d => d.id)
        .distance(100)
        .strength(0.5)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 5));

    simulationRef.current = simulation;

    // Create edges
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', d => getEdgeColor(d))
      .attr('stroke-width', d => getEdgeWidth(d))
      .attr('stroke-opacity', 0.6)
      .style('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        if (onEdgeSelect) {
          onEdgeSelect(d);
        }
      });

    // Create edge labels
    const linkLabels = g.append('g')
      .attr('class', 'link-labels')
      .selectAll('text')
      .data(edges)
      .enter()
      .append('text')
      .attr('font-size', '10px')
      .attr('fill', '#666')
      .attr('text-anchor', 'middle')
      .text(d => d.protocol);

    // Create nodes
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => getNodeSize(d))
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => selectedNode === d.id ? '#fbbf24' : '#fff')
      .attr('stroke-width', d => selectedNode === d.id ? 3 : 2)
      .style('cursor', 'pointer')
      .call(d3.drag<SVGCircleElement, NetworkNode>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d.id);
        if (onNodeSelect) {
          onNodeSelect(d);
        }
      });

    // Create node labels
    const nodeLabels = g.append('g')
      .attr('class', 'node-labels')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('font-size', '11px')
      .attr('fill', '#333')
      .attr('dx', d => getNodeSize(d) + 5)
      .attr('dy', 4)
      .text(d => d.ip);

    // Create tooltips
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'topology-tooltip')
      .style('position', 'absolute')
      .style('visibility', 'hidden')
      .style('background', 'rgba(0, 0, 0, 0.8)')
      .style('color', 'white')
      .style('padding', '8px')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none');

    node
      .on('mouseover', (event, d) => {
        tooltip
          .style('visibility', 'visible')
          .html(`
            <strong>IP:</strong> ${d.ip}<br/>
            <strong>Type:</strong> ${d.type}<br/>
            <strong>Flows:</strong> ${d.flowCount}<br/>
            <strong>Bytes:</strong> ${d.byteCount.toLocaleString()}<br/>
            <strong>Connections:</strong> ${d.connections.length}
          `);
      })
      .on('mousemove', (event) => {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px');
      })
      .on('mouseout', () => {
        tooltip.style('visibility', 'hidden');
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NetworkNode).x!)
        .attr('y1', d => (d.source as NetworkNode).y!)
        .attr('x2', d => (d.target as NetworkNode).x!)
        .attr('y2', d => (d.target as NetworkNode).y!);

      linkLabels
        .attr('x', d => ((d.source as NetworkNode).x! + (d.target as NetworkNode).x!) / 2)
        .attr('y', d => ((d.source as NetworkNode).y! + (d.target as NetworkNode).y!) / 2);

      node
        .attr('cx', d => d.x!)
        .attr('cy', d => d.y!);

      nodeLabels
        .attr('x', d => d.x!)
        .attr('y', d => d.y!);
    });

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.remove();
    };
  }, [flows, width, height, buildGraph, onNodeSelect, onEdgeSelect, selectedNode]);

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded-lg bg-white"
      />
      
      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur p-3 rounded-lg shadow-lg text-xs">
        <h4 className="font-semibold mb-2">Node Types</h4>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span>Source</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span>Destination</span>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span>Anomaly</span>
        </div>
        
        <h4 className="font-semibold mb-2 mt-3">Protocols</h4>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(ProtocolType).slice(0, 6).map(([key, protocol]) => {
            const colors: Record<string, string> = {
              TCP: 'bg-blue-500',
              UDP: 'bg-green-500',
              ICMP: 'bg-amber-500',
              HTTP: 'bg-violet-500',
              HTTPS: 'bg-indigo-500',
              DNS: 'bg-pink-500'
            };
            return (
              <div key={key} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${colors[key] || 'bg-gray-400'}`}></div>
                <span>{protocol}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default NetworkTopology;
