// Data import/export utilities for PCAP, CSV, and JSON
import type { NetworkFlow } from '@/types';

// --- CSV ---
export function exportFlowsToCSV(flows: NetworkFlow[]): string {
  if (!flows.length) return '';
  const headers = Object.keys(flows[0]);
  const csvRows = [headers.join(',')];
  for (const flow of flows) {
    const row = headers.map(h => JSON.stringify((flow as any)[h] ?? ''));
    csvRows.push(row.join(','));
  }
  return csvRows.join('\n');
}

export function importFlowsFromCSV(csv: string): NetworkFlow[] {
  const [headerLine, ...lines] = csv.trim().split(/\r?\n/);
  const headers = headerLine.split(',');
  return lines.map(line => {
    const values = line.split(',');
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = JSON.parse(values[i] || 'null'); });
    return obj as NetworkFlow;
  });
}

// --- JSON ---
export function exportFlowsToJSON(flows: NetworkFlow[]): string {
  return JSON.stringify(flows, null, 2);
}

export function importFlowsFromJSON(json: string): NetworkFlow[] {
  return JSON.parse(json) as NetworkFlow[];
}

// --- PCAP ---
// Minimal PCAP parser/exporter (for demonstration; real-world use requires a full parser)
export function exportFlowsToPCAP(flows: NetworkFlow[]): ArrayBuffer {
  // Placeholder: implement PCAP export logic or use a library
  return new ArrayBuffer(0);
}

export function importFlowsFromPCAP(pcap: ArrayBuffer): NetworkFlow[] {
  // Placeholder: implement PCAP import logic or use a library
  return [];
}
