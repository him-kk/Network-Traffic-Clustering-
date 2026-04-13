# PCAP File Import - Quick Reference

## Generate PCAP Files

### Quick capture (1000 packets):
```bash
tcpdump -i eth0 -c 1000 -w network.pcap
```

### Capture for specific duration (60 seconds):
```bash
timeout 60 tcpdump -i eth0 -w network.pcap
```

### Capture specific traffic types:
```bash
# Only TCP
$ tcpdump -i eth0 tcp -w tcp_traffic.pcap

# Only DNS traffic
$ tcpdump -i eth0 udp port 53 -w dns_traffic.pcap

# Only HTTP/HTTPS
$ tcpdump -i eth0 'tcp port 80 or tcp port 443' -w web_traffic.pcap

# Exclude SSH and DNS
$ tcpdump -i eth0 'not (port 22 or port 53)' -w no_ssh_dns.pcap
```

### High-performance capture:
```bash
# Skip DNS resolution (much faster)
$ tcpdump -i eth0 -n -w network.pcap

# Use larger buffer
$ tcpdump -i eth0 -B 1000 -w network.pcap

# Write directly (no intermediate buffer)
$ tcpdump -i eth0 -U -w network.pcap
```

## Import in Dashboard

1. Start dashboard: `npm run dev`
2. Click **"Import PCAP"** button (top right)
3. Drag & drop or browse for `.pcap` file
4. Dashboard auto-processes and displays flows

## What Happens During Import

```
PCAP File
    ↓
Parse Ethernet Frames (MAC addresses)
    ↓
Extract IPv4 Packets (IP header)
    ↓
Parse TCP/UDP (ports, flags)
    ↓
Convert to NetworkFlow Objects
    ↓
Merge Duplicate 5-Tuples
    ↓
Add to Dashboard
    ↓
Run Clustering & Anomaly Detection
```

## Supported PCAP Formats

| Format | Extension | Support |
|--------|-----------|---------|
| Libpcap | .pcap | ✅ Full |
| PCAPNG | .pcapng | ✅ Full |
| Tcpdump | .tcpdump | ✅ Full |

## File Size Limits

- **Max file size**: 100 MB
- **Typical packets per MB**: ~1000-10000 (depends on packet size)
- **Processing time**: ~1-5 seconds for 100k flows

## Examples

### Analyze your home network:
```bash
# Terminal 1
$ tcpdump -i en0 -n -w home_network.pcap -c 5000

# Perform normal internet activity (browse, email, etc.)

# Terminal 2 - Start dashboard
$ npm run dev

# In browser
# 1. Click Import PCAP
# 2. Select home_network.pcap  
# 3. Analyze your actual traffic patterns
```

### Analyze server response times:
```bash
$ tcpdump -i eth0 'host 10.0.0.100' -w server_traffic.pcap -a duration:300

# Import and clusterize server connections
```

### Network behavior baseline:
```bash
# Capture normal day
$ tcpdump -i eth0 -n -w baseline.pcap &

# Leave running for 8 hours...

# Import and analyze "normal" traffic clusters
```

## Troubleshooting

### File not recognized:
```bash
# Verify file format
$ file my_capture.pcap
# Should output: pcap capture file

# Verify with tcpdump 
$ tcpdump -r my_capture.pcap | head -5
```

### File too large:
```bash
# Split into smaller files
$ tcpdump -r large.pcap -w small_part.pcap -c 10000

# Or import only specific traffic
$ tcpdump -r large.pcap -w filtered.pcap 'tcp port 80'
```

### Empty results after import:
```bash
# Ensure file contains TCP/UDP (not only ARP, etc.)
$ tcpdump -r capture.pcap 'tcp or udp' | head -5

# Re-capture with TCP/UDP filter
$ tcpdump -i eth0 'tcp or udp' -w network.pcap
```

## Performance Tips

- **For large networks**: Use `-c` limit to cap packets
- **For high traffic**: Use BPF filters to reduce data
- **For analysis**: Save multiple smaller PCAP files
- **For storage**: Compress: `gzip network.pcap`

## Next Steps

1. ✅ Capture your network
2. ✅ Import PCAP file
3. ✅ Explore clustering results  
4. ✅ Identify traffic patterns
5. ✅ Test anomaly detection
6. ✅ Export analysis results
