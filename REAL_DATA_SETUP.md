# Real Network Traffic Capture Setup Guide

## 📋 Overview

This guide covers two approaches to use real network traffic instead of mock data:

- **Option A**: WebSocket Live Capture (Real-time streaming)
- **Option B**: PCAP File Import (Batch processing)

---

## **Option A: WebSocket Live Capture** 🌐

### Prerequisites
```bash
# Windows: Install tcpdump (via Chocolatey)
choco install npcap

# macOS: Already installed with Xcode tools
# Or: brew install tcpdump

# Linux (Ubuntu/Debian)
sudo apt-get install tcpdump
```

### Setup Backend Server

1. **Install dependencies**:
```bash
cd app
npm install ws
npm install --save-dev @types/node
```

2. **Start the backend server** (requires elevated privileges):
```bash
# Linux/macOS
sudo node server.js

# Windows (Admin Command Prompt)
node server.js
```

Expected output:
```
🚀 Network Traffic WebSocket Server starting on ws://localhost:8080
✅ Server listening on http://localhost:8080
📡 WebSocket endpoint: ws://localhost:8080/live
✨ Ready to receive network traffic captures
```

3. **Select network interface** (Linux example):
```bash
# List available interfaces
ifconfig        # macOS/Linux
ipconfig        # Windows

# Set capture interface (optional)
export CAPTURE_INTERFACE=eth0
node server.js
```

4. **Start the frontend** (in a separate terminal):
```bash
npm run dev
```

5. **In Dashboard**: Click "Start Monitoring" → WebSocket connects and streams real packets

### How It Works

```
Your Network Interface
        ↓
     tcpdump
        ↓
  Node.js Server (server.js)
        ↓
   WebSocket (port 8080)
        ↓
   React Dashboard
        ↓
   Clustering & Analysis
```

**Key Features**:
- ✅ Real-time streaming
- ✅ Automatic anomaly alerts
- ✅ All 10 clustering algorithms work on real data
- ⚠️  Requires elevated privileges (sudo/admin)
- ⚠️  CPU intensive for high-traffic networks

---

## **Option B: PCAP File Import** 📁

### Generate PCAP Files

**Method 1: Using tcpdump**
```bash
# Capture 1000 packets to file
tcpdump -i eth0 -c 1000 -w network_capture.pcap

# Capture for 60 seconds
timeout 60 tcpdump -i eth0 -w network_capture.pcap

# Capture specific traffic (e.g., only TCP)
tcpdump -i eth0 tcp -w network_capture.pcap

# Capture without DNS resolution (faster)
tcpdump -i eth0 -n -w network_capture.pcap
```

**Method 2: Using tshark/Wireshark**
```bash
# Install Wireshark
# macOS: brew install wireshark
# Windows: Download from wireshark.org
# Linux: sudo apt-get install wireshark

# Capture with tshark
tshark -i eth0 -w network_capture.pcap -a duration:60
```

**Method 3: Using Zeek (Advanced) **
```bash
# Install Zeek (formerly Bro)
# See: zeek.org/get-zeek/

zeek -i eth0 -C local
```

### Import PCAP in Dashboard

1. **Start frontend**:
```bash
npm run dev
# Open http://localhost:5173
```

2. **Click "Import PCAP"** button in header

3. **Select your .pcap file**:
   - Supports .pcap and .pcapng formats
   - Max file size: 100 MB
   - Automatically merges duplicate flows

4. **Dashboard processes the flows**:
   - Extracts TCP/UDP flows from raw packets
   - Deduplicates by 5-tuple (src IP, dst IP, src port, dst port, protocol)
   - Runs clustering and anomaly detection

### File Format Support

| Format | Support | Notes |
|--------|---------|-------|
| PCAP (.pcap) | ✅ Full | Standard libpcap format |
| PCAPNG (.pcapng) | ⏳ Partial | Extended format (basic support) |
| CSV | ✅ Full | Via export/import in dashboard |
| JSON | ✅ Full | Via export/import in dashboard |

---

## **Comparison: Live vs Import**

| Feature | Live WebSocket | PCAP Import |
|---------|---|---|
| **Real-time** | ✅ Yes | ❌ No |
| **Privileges** | ⚠️ Requires sudo | ✅ None |
| **Setup** | Medium (server) | Easy (files only) |
| **Large files** | ❌ Limited | ✅ High capacity |
| **Accuracy** | ✅ Full packets | ✅ Full packets |
| **Format** | Streaming | Static files |
| **Testing** | Live network | Historical data |

---

## **Advanced Configurations**

### Docker Setup (for easy deployment)

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

EXPOSE 8080 5173

CMD ["node", "server.js"]
```

Run:
```bash
docker build -t network-traffic-capture .
docker run --net=host -p 8080:8080 -p 5173:5173 network-traffic-capture
```

### Filter Specific Traffic

**In server.js**, modify the tcpdump filter:
```javascript
// Capture only HTTP/HTTPS
'tcp port 80 or tcp port 443'

// Capture only DNS
'udp port 53'

// Capture only traffic to/from specific IP
'host 192.168.1.100'

// Exclude internal traffic
'not (src net  192.168.0.0/16 and dst net 192.168.0.0/16)'
```

### Performance Tips

1. **Large networks**: Use sampling
   ```bash
   tcpdump -i eth0 -B 1000 -w capture.pcap
   ```

2. **Memory optimization**: Process in chunks
   ```bash
   # In Dashboard, increase batch size for clustering
   ```

3. **Filter early**: Only capture relevant traffic
   ```bash
   tcpdump -i eth0 'not port 22 and not port 53' -w capture.pcap
   ```

---

## **Troubleshooting**

### WebSocket Connection Failed
```
Error: ws://localhost:8080/live Connection refused
```
**Solution**: Ensure backend server is running
```bash
node server.js  # Check for errors
```

### Permission Denied (tcpdump)
```
Error: tcpdump: Permission denied
```
**Solution**: Use sudo
```bash
sudo node server.js
```

### PCAP Import Fails
```
Error: Invalid PCAP file
```
**Solution**: Verify file format
```bash
file network_capture.pcap
# Should output: "data" or "pcap capture file"

# Verify with tcpdump
tcpdump -r network_capture.pcap | head -5
```

### High CPU Usage
**Causes**: Too many flows or frequent clustering
**Solutions**:
- Reduce refresh rate (in dashboard config)
- Use "Show Anomalies Only" toggle
- Limit flow history (currently 1000 max)
- Use sampling in tcpdump

---

## **Next Steps**

1. **Try both methods**:
   - Generate a small PCAP with tcpdump
   - Import and test clustering
   - Then set up live capture

2. **Test with your network**:
   ```bash
   # Capture your network for 5 minutes
   tcpdump -i eth0 -w my_network.pcap &
   # Browse internet normally...
   # Kill tcpdump after 5 minutes
   ```

3. **Deploy to monitoring**:
   - Set up automated PCAP rotation
   - Configure alerting thresholds
   - Integrate with SIEM systems

---

## **Resources**

- **tcpdump documentation**: https://www.tcpdump.org/
- **Wireshark User Guide**: https://www.wireshark.org/docs/
- **PCAP format**: https://www.tcpdump.org/papers/sniffing-faq.html
- **Zeek documentation**: https://docs.zeek.org/

---

**Questions?** Check the README.md in the project root for additional help.
