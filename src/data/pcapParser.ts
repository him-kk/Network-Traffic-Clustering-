// PCAP File Parser - Convert PCAP files to NetworkFlow format
// Install: npm install pcapjs (or use built-in parsing)

import type { NetworkFlow } from '@/types';
import { ProtocolType } from '@/types';

/**
 * Parse PCAP file (binary format)
 * PCAP file structure:
 * - Global header (24 bytes)
 * - Packet header (16 bytes) + packet data (repeated)
 */
export function parsePCAPFile(arrayBuffer: ArrayBuffer): NetworkFlow[] {
  const view = new DataView(arrayBuffer);
  const flows: NetworkFlow[] = [];

  // Check PCAP global header magic number
  const magic = view.getUint32(0, true);
  const isLittleEndian = magic === 0xa1b2c3d4;
  const isBigEndian = magic === 0xd4c3b2a1;

  if (!isLittleEndian && !isBigEndian) {
    throw new Error('Invalid PCAP file: magic number mismatch');
  }

  const littleEndian = isLittleEndian;
  let offset = 24; // Skip global header

  // Parse packets
  while (offset < arrayBuffer.byteLength - 16) {
    try {
      // Read packet header
      const tsecHigh = view.getUint32(offset, littleEndian);
      const tsecLow = view.getUint32(offset + 4, littleEndian);
      const inclLen = view.getUint32(offset + 8, littleEndian);
      const origLen = view.getUint32(offset + 12, littleEndian);

      offset += 16;

      if (inclLen === 0 || offset + inclLen > arrayBuffer.byteLength) {
        break;
      }

      // Extract packet data
      const packetData = new Uint8Array(arrayBuffer, offset, inclLen);
      offset += inclLen;

      // Parse packet (Ethernet frame assumed)
      const flow = parseEthernetFrame(packetData, origLen);
      if (flow) {
        flows.push(flow);
      }
    } catch (error) {
      console.error('Error parsing packet:', error);
      break;
    }
  }

  return flows;
}

/**
 * Parse Ethernet frame
 * Structure: DST MAC (6) | SRC MAC (6) | Type (2) | Payload
 */
function parseEthernetFrame(data: Uint8Array, origLen: number): NetworkFlow | null {
  if (data.length < 14) return null;

  const etherType = (data[12] << 8) | data[13];

  // 0x0800 = IPv4
  if (etherType === 0x0800) {
    return parseIPv4Packet(data.slice(14), origLen);
  }

  // 0x0806 = ARP
  if (etherType === 0x0806) {
    return null; // Skip ARP
  }

  return null;
}

/**
 * Parse IPv4 packet
 * Structure: Version+IHL (1) | DSCP+ECN (1) | Length (2) | ID (2) | Flags+Offset (2) |
 *            TTL (1) | Protocol (1) | Checksum (2) | Src IP (4) | Dst IP (4) | ...
 */
function parseIPv4Packet(data: Uint8Array, origLen: number): NetworkFlow | null {
  if (data.length < 20) return null;

  const version = (data[0] >> 4) & 0x0f;
  if (version !== 4) return null;

  const ihl = (data[0] & 0x0f) * 4;
  const ttl = data[8];
  const protocol = data[9];
  const srcIP = `${data[12]}.${data[13]}.${data[14]}.${data[15]}`;
  const dstIP = `${data[16]}.${data[17]}.${data[18]}.${data[19]}`;

  const payload = data.slice(ihl);

  if (protocol === 6) {
    // TCP
    return parseTCPSegment(srcIP, dstIP, payload, ttl, origLen);
  } else if (protocol === 17) {
    // UDP
    return parseUDPDatagram(srcIP, dstIP, payload, ttl, origLen);
  }

  return null;
}

/**
 * Parse TCP segment
 * Structure: Src Port (2) | Dst Port (2) | Seq (4) | Ack (4) | Offset+Flags (2) |
 *            Window (2) | Checksum (2) | Urgent (2) | ...
 */
function parseTCPSegment(
  srcIP: string,
  dstIP: string,
  data: Uint8Array,
  ttl: number,
  origLen: number
): NetworkFlow | null {
  if (data.length < 20) return null;

  const srcPort = (data[0] << 8) | data[1];
  const dstPort = (data[2] << 8) | data[3];
  const flags = data[13];
  const window = (data[14] << 8) | data[15];

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    sourceIP: srcIP,
    destinationIP: dstIP,
    sourcePort: srcPort,
    destinationPort: dstPort,
    protocol: ProtocolType.TCP,
    packetCount: 1,
    byteCount: origLen,
    duration: 0,
    flags: parseTCPFlags(flags),
    ttl,
    windowSize: window,
    payload: Array.from(data.slice(20, Math.min(data.length, 100))),
    isAnomaly: false,
    geoLocation: {
      country: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      asn: 'Unknown',
      isp: 'Unknown'
    }
  };
}

/**
 * Parse UDP datagram
 * Structure: Src Port (2) | Dst Port (2) | Length (2) | Checksum (2) | ...
 */
function parseUDPDatagram(
  srcIP: string,
  dstIP: string,
  data: Uint8Array,
  ttl: number,
  origLen: number
): NetworkFlow | null {
  if (data.length < 8) return null;

  const srcPort = (data[0] << 8) | data[1];
  const dstPort = (data[2] << 8) | data[3];

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    sourceIP: srcIP,
    destinationIP: dstIP,
    sourcePort: srcPort,
    destinationPort: dstPort,
    protocol: ProtocolType.UDP,
    packetCount: 1,
    byteCount: origLen,
    duration: 0,
    flags: { syn: false, ack: false, fin: false, rst: false, psh: false, urg: false },
    ttl,
    windowSize: 0,
    payload: Array.from(data.slice(8, Math.min(data.length, 100))),
    isAnomaly: false,
    geoLocation: {
      country: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0,
      asn: 'Unknown',
      isp: 'Unknown'
    }
  };
}

/**
 * Parse TCP flags byte
 */
function parseTCPFlags(flagsByte: number) {
  return {
    fin: !!(flagsByte & 0x01),
    syn: !!(flagsByte & 0x02),
    rst: !!(flagsByte & 0x04),
    psh: !!(flagsByte & 0x08),
    ack: !!(flagsByte & 0x10),
    urg: !!(flagsByte & 0x20)
  };
}

/**
 * Import PCAP file from File input
 */
export async function importPCAPFromFile(file: File): Promise<NetworkFlow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const arrayBuffer = e.target?.result as ArrayBuffer;
        const flows = parsePCAPFile(arrayBuffer);
        resolve(flows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Merge flows (deduplicate by 5-tuple)
 */
export function mergeFlows(flows: NetworkFlow[]): NetworkFlow[] {
  const flowMap = new Map<string, NetworkFlow>();

  flows.forEach(flow => {
    const key = `${flow.sourceIP}:${flow.sourcePort}-${flow.destinationIP}:${flow.destinationPort}-${flow.protocol}`;
    
    if (flowMap.has(key)) {
      // Merge with existing flow
      const existing = flowMap.get(key)!;
      existing.packetCount += flow.packetCount;
      existing.byteCount += flow.byteCount;
      existing.duration = Math.max(existing.duration, flow.duration);
    } else {
      flowMap.set(key, { ...flow });
    }
  });

  return Array.from(flowMap.values());
}

export default {
  parsePCAPFile,
  importPCAPFromFile,
  mergeFlows
};
