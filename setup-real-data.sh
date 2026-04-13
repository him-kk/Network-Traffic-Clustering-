#!/bin/bash
# Quick setup script for real network traffic capture

echo "🚀 Network Traffic Capture - Setup Wizard"
echo "=========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it from https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"
echo ""

# Check if tcpdump is installed
if ! command -v tcpdump &> /dev/null; then
    echo "⚠️  tcpdump is not installed."
    echo "Install with:"
    echo "  macOS: brew install tcpdump"
    echo "  Linux (Ubuntu): sudo apt-get install tcpdump"
    echo "  Windows: Download npcap from https://npcap.com/"
    echo ""
fi

echo "📦 Installing dependencies..."
npm install ws
npm install --save-dev @types/node

echo ""
echo "✅ Setup complete!"
echo ""
echo "📌 Next steps:"
echo ""
echo "Option A - Live WebSocket Capture:"
echo "  1. sudo node server.js          # Start backend"
echo "  2. npm run dev                  # In separate terminal, start frontend"
echo "  3. Open http://localhost:5173"
echo "  4. Click 'Start Monitoring'"
echo ""
echo "Option B - Import PCAP File:"
echo "  1. Generate PCAP: tcpdump -i eth0 -w capture.pcap -c 1000"
echo "  2. npm run dev"
echo "  3. Click 'Import PCAP' button"
echo "  4. Select your .pcap file"
echo ""
echo "📖 See REAL_DATA_SETUP.md for detailed instructions"
echo ""
