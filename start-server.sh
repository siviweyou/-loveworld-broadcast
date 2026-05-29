#!/bin/bash

echo "Starting Loveworld Networks Broadcast Server..."
echo "=============================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Go to server directory
cd "$(dirname "$0")/server"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ Failed to install dependencies."
        exit 1
    fi
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Creating from example..."
    cp .env.example .env
    echo "✅ Created .env file. Please edit it with your configuration."
fi

# Start the server
echo "🚀 Starting broadcast server..."
echo ""
echo "Server will be available at:"
echo "  • RTMP: rtmp://localhost/live"
echo "  • HLS: http://localhost:8000/live/[stream-key]/index.m3u8"
echo "  • API: http://localhost:3001/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the server
npm start