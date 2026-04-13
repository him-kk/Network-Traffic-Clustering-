// WebSocket Server for Live Network Traffic Capture
// Windows version - uses tshark (comes with Wireshark)
// Requires: npm install ws

const WebSocket = require('ws');
const http = require('http');
const { spawn } = require('child_process');
const os = require('os');

const PORT = 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log(`Network Traffic WebSocket Server starting on ws://localhost:${PORT}`);

let captureProcess = null;
const clients = new Set();

const isWindows = process.platform === 'win32';

const TSHARK_PATH = process.env.TSHARK_PATH || (
  isWindows
    ? 'C:\\Program Files\\Wireshark\\tshark.exe'
    : 'tshark'
);

// ---------------------------------------------------------------------------
// Application-layer protocol detection by well-known port.
// This runs FIRST — if a port matches, we use the app name (HTTP, DNS, etc.)
// Falls back to transport name (TCP/UDP) — never produces PROTO_XXX or MUX etc.
// ---------------------------------------------------------------------------
const PORT_TO_PROTOCOL = {
  // Web
  80:    'HTTP',
  8080:  'HTTP',
  8008:  'HTTP',
  3000:  'HTTP',
  8000:  'HTTP',
  443:   'HTTPS',
  8443:  'HTTPS',
  // DNS
  53:    'DNS',
  5353:  'mDNS',
  5355:  'LLMNR',
  // Mail
  25:    'SMTP',
  587:   'SMTP',
  465:   'SMTPS',
  110:   'POP3',
  995:   'POP3S',
  143:   'IMAP',
  993:   'IMAPS',
  // File / remote access
  20:    'FTP',
  21:    'FTP',
  22:    'SSH',
  23:    'Telnet',
  3389:  'RDP',
  5900:  'VNC',
  // Databases
  3306:  'MySQL',
  5432:  'PostgreSQL',
  6379:  'Redis',
  27017: 'MongoDB',
  1433:  'MSSQL',
  1521:  'Oracle',
  // Network services
  67:    'DHCP',
  68:    'DHCP',
  123:   'NTP',
  161:   'SNMP',
  162:   'SNMP',
  389:   'LDAP',
  636:   'LDAPS',
  445:   'SMB',
  137:   'NetBIOS',
  138:   'NetBIOS',
  139:   'NetBIOS',
  // Streaming / VoIP
  554:   'RTSP',
  1935:  'RTMP',
  5060:  'SIP',
  5061:  'SIP',
  // Misc
  179:   'BGP',
  520:   'RIP',
  1900:  'SSDP',
};

// ---------------------------------------------------------------------------
// These are the ONLY non-TCP/UDP protocol names we surface in the UI.
// Everything else (HOPOPT, MUX, GGP, BBN-RCC-MON, …) becomes 'OTHER'.
// This keeps the Protocol Distribution chart clean and meaningful.
// ---------------------------------------------------------------------------
const MEANINGFUL_PROTOS = new Set([
  'ICMP', 'ICMPv6', 'IGMP', 'IPv6', 'GRE', 'ESP',
  'AH',   'OSPF',   'EIGRP','SCTP', 'PIM', 'VRRP',
]);

// ---------------------------------------------------------------------------
// WebSocket connection handler
// ---------------------------------------------------------------------------
wss.on('connection', (ws) => {
  console.log('Client connected');
  clients.add(ws);

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      if (message.type === 'start_capture') {
        startPacketCapture(ws, message.interface);
      } else if (message.type === 'stop_capture') {
        stopPacketCapture(ws);
      } else if (message.type === 'get_interfaces') {
        sendInterfaces(ws);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
    if (clients.size === 0) stopPacketCapture();
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  sendInterfaces(ws);
});

// ---------------------------------------------------------------------------
// Get interfaces using tshark -D
// ---------------------------------------------------------------------------
function sendInterfaces(ws) {
  const tshark = spawn(TSHARK_PATH, ['-D']);
  let output = '';

  tshark.stdout.on('data', (data) => { output += data.toString(); });
  tshark.stderr.on('data', (data) => { output += data.toString(); });

  tshark.on('close', () => {
    const lines = output.trim().split('\n').filter(l => l.trim());

    const interfaces = lines.map(line => {
      let match = line.match(/^(\d+)\.\s+(\S+)\s+\((.+)\)\s*$/);
      if (match) {
        return { index: match[1], name: match[2].trim(), description: match[3].trim() };
      }
      match = line.match(/^(\d+)\.\s+(\S+)\s*$/);
      if (match) {
        return { index: match[1], name: match[2].trim(), description: match[2].trim() };
      }
      const parts = line.split(/\s+/);
      const idx   = (parts[0] || '').replace('.', '');
      const name  = parts[1] || line;
      return { index: idx, name, description: name };
    }).filter(i => i.index);

    ws.send(JSON.stringify({ type: 'interfaces', interfaces, osInterfaces: getOSInterfaces() }));

    console.log(`📡 Found ${interfaces.length} interfaces`);
    interfaces.forEach(i => console.log(`   ${i.index}. ${i.description} (${i.name})`));
  });

  tshark.on('error', () => {
    ws.send(JSON.stringify({
      type: 'error',
      message: `tshark not found at "${TSHARK_PATH}". ` +
               `Install Wireshark: https://www.wireshark.org/download.html`
    }));
  });
}

// ---------------------------------------------------------------------------
// OS network interfaces
// ---------------------------------------------------------------------------
function getOSInterfaces() {
  const ni = os.networkInterfaces();
  const result = [];
  for (const [name, addrs] of Object.entries(ni)) {
    const ipv4 = addrs.find(addr => addr.family === 'IPv4');
    if (ipv4) result.push({ name, ip: ipv4.address, mac: addrs[0]?.mac || 'N/A' });
  }
  return result;
}

function getDefaultInterfaceIndex() {
  return process.env.CAPTURE_INTERFACE || '6';
}

// ---------------------------------------------------------------------------
// Start packet capture
// ---------------------------------------------------------------------------
function startPacketCapture(ws, interfaceIndex) {
  if (captureProcess) {
    ws.send(JSON.stringify({ type: 'error', message: 'Capture already running. Stop it first.' }));
    return;
  }

  const iface = interfaceIndex || getDefaultInterfaceIndex();
  console.log(`Starting packet capture on interface ${iface}...`);

  try {
    // FIX: Use tab separator (not comma) to avoid collisions with quoted CSV fields.
    // tshark's -E separator=, with -E quote=d can still break when fields contain
    // commas. Tab is safe because IP addresses and port numbers never contain tabs.
    captureProcess = spawn(TSHARK_PATH, [
      '-i', iface,
      '-l',
      '-n',
      '-T', 'fields',
      '-e', 'frame.time_epoch',  // 0  — Unix timestamp with decimals
      '-e', 'ip.src',            // 1
      '-e', 'ip.dst',            // 2
      '-e', 'tcp.srcport',       // 3
      '-e', 'tcp.dstport',       // 4
      '-e', 'udp.srcport',       // 5
      '-e', 'udp.dstport',       // 6
      '-e', 'ip.proto',          // 7  — raw IP protocol number
      '-e', 'frame.len',         // 8  — total frame length in bytes
      '-e', 'ip.ttl',            // 9
      '-e', 'tcp.window_size',   // 10
      '-e', 'tcp.flags',         // 11 — hex flags e.g. 0x0002
      '-E', 'separator=\t',      // FIX: tab separator — never appears in field values
      '-E', 'occurrence=f',      // take first occurrence only
      'ip',                      // capture filter: IP traffic only
    ]);

    ws.send(JSON.stringify({
      type: 'capture_started',
      interface: iface,
      message: `Capturing on interface ${iface}...`
    }));

    let lineBuffer = '';

    captureProcess.stdout.on('data', (chunk) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split('\n');
      lineBuffer = lines.pop(); // keep incomplete last line

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const flow = parseTsharkLine(line);
          if (flow) {
            const msg = JSON.stringify({ type: 'flow_data', payload: flow });
            clients.forEach(client => {
              if (client.readyState === WebSocket.OPEN) client.send(msg);
            });
          }
        } catch {
          // skip malformed lines silently
        }
      }
    });

    captureProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (!msg) return;
      if (msg.toLowerCase().includes('error') || msg.toLowerCase().includes('failed')) {
        console.error(`tshark error: ${msg}`);
        clients.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ type: 'error', message: msg }));
          }
        });
      } else {
        console.log(`tshark: ${msg}`);
      }
    });

    captureProcess.on('close', (code) => {
      console.log(`tshark exited with code ${code}`);
      captureProcess = null;
      clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: 'capture_stopped' }));
        }
      });
    });

    captureProcess.on('error', (err) => {
      console.error('Failed to start tshark:', err);
      ws.send(JSON.stringify({
        type: 'error',
        message: `Failed to start tshark: ${err.message}. Is Wireshark installed?`
      }));
      captureProcess = null;
    });

  } catch (error) {
    console.error('Failed to start capture:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: `Failed to start capture: ${error.message}`
    }));
    captureProcess = null;
  }
}

// ---------------------------------------------------------------------------
// Stop packet capture
// ---------------------------------------------------------------------------
function stopPacketCapture(ws) {
  if (captureProcess) {
    console.log('Stopping packet capture...');
    captureProcess.kill();
    captureProcess = null;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'capture_stopped' }));
    }
  }
}

// ---------------------------------------------------------------------------
// Parse a single tshark tab-separated line
// ---------------------------------------------------------------------------
function parseTsharkLine(line) {
  // FIX: split on tab — safe because none of our fields contain tabs
  const fields = line.split('\t');

  const [
    timeEpoch,   // 0
    srcIP,       // 1
    dstIP,       // 2
    tcpSrcPort,  // 3
    tcpDstPort,  // 4
    udpSrcPort,  // 5
    udpDstPort,  // 6
    protoNum,    // 7
    frameLen,    // 8
    ttl,         // 9
    windowSize,  // 10
    tcpFlags,    // 11
  ] = fields;

  if (!srcIP || !dstIP) return null;

  const proto   = parseInt(protoNum, 10);
  let protocol  = 'OTHER';
  let srcPort   = 0;
  let dstPort   = 0;

  if (proto === 6) {
    // TCP
    srcPort  = parseInt(tcpSrcPort, 10) || 0;
    dstPort  = parseInt(tcpDstPort, 10) || 0;
    // FIX: Resolve to app-layer name by port first, fall back to TCP
    protocol = PORT_TO_PROTOCOL[dstPort] || PORT_TO_PROTOCOL[srcPort] || 'TCP';
  } else if (proto === 17) {
    // UDP
    srcPort  = parseInt(udpSrcPort, 10) || 0;
    dstPort  = parseInt(udpDstPort, 10) || 0;
    protocol = PORT_TO_PROTOCOL[dstPort] || PORT_TO_PROTOCOL[srcPort] || 'UDP';
  } else if (proto === 1) {
    protocol = 'ICMP';
  } else if (proto === 58) {
    protocol = 'ICMPv6';
  } else if (proto === 2) {
    protocol = 'IGMP';
  } else if (proto === 89) {
    protocol = 'OSPF';
  } else if (proto === 47) {
    protocol = 'GRE';
  } else if (proto === 50) {
    protocol = 'ESP';
  } else if (proto === 51) {
    protocol = 'AH';
  } else {
    // FIX: Everything else (HOPOPT=0, MUX=18, GGP=3, …) → OTHER
    // Do NOT produce PROTO_${proto} — that creates hundreds of unique labels
    // which floods the chart and triggers 500+ false-positive anomalies.
    protocol = 'OTHER';
  }

  const flagsHex = parseInt(tcpFlags, 16) || 0;
  const flags = {
    syn: !!(flagsHex & 0x002),
    ack: !!(flagsHex & 0x010),
    fin: !!(flagsHex & 0x001),
    rst: !!(flagsHex & 0x004),
    psh: !!(flagsHex & 0x008),
    urg: !!(flagsHex & 0x020),
  };

  return {
    id:              `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp:       timeEpoch ? parseFloat(timeEpoch) * 1000 : Date.now(),
    sourceIP:        srcIP,
    destinationIP:   dstIP,
    sourcePort:      srcPort,
    destinationPort: dstPort,
    protocol,
    packetCount:     1,
    byteCount:       parseInt(frameLen, 10) || 64,
    duration:        0,
    flags,
    ttl:             parseInt(ttl, 10) || 64,
    windowSize:      parseInt(windowSize, 10) || 65535,
    payload:         [],
    isAnomaly:       false,
    geoLocation: {
      country:   'Unknown',
      city:      'Unknown',
      latitude:  0,
      longitude: 0,
      asn:       'Unknown',
      isp:       'Unknown',
    },
  };
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`\nServer running on ws://localhost:${PORT}`);
  console.log(`\nSetup:`);
  console.log(`  1. Install Wireshark: https://www.wireshark.org/download.html`);
  console.log(`  2. Run this server:   node server.cjs`);
  console.log(`  3. Open dashboard, select your interface, click "Start Monitoring"`);
  console.log(`\nOverrides:`);
  console.log(`  TSHARK_PATH="..." node server.cjs`);
  console.log(`  CAPTURE_INTERFACE=6 node server.cjs\n`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  stopPacketCapture();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
