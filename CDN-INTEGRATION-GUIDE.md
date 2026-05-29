# 5cent CDN Integration Guide

Your Loveworld Networks broadcasting platform is now integrated with 5cent CDN for global streaming distribution.

## What's Been Configured

✅ **API Key Integration**: Your 5cent CDN API key has been added to the system
✅ **Environment Configuration**: `.env` file created with all necessary credentials
✅ **Server Integration**: Automatic CDN stream creation when broadcasts start
✅ **Frontend Updates**: CDN status badges added to the broadcast control room
✅ **Global Distribution**: Streams are automatically distributed to global CDN edge locations

## How It Works

1. **Stream Ingestion**: Churches stream to your local RTMP server using OBS or other encoders
2. **Local Processing**: The server converts RTMP to HLS for local playback
3. **CDN Distribution**: When a stream starts, the server automatically creates a 5cent CDN stream
4. **Global Delivery**: The CDN distributes the stream to edge locations worldwide
5. **Automatic Cleanup**: When streams end, CDN resources are automatically released

## Getting Started

### 1. Start the Broadcast Server
```bash
cd server
npm install  # If not already done
npm start
```

### 2. Open the Platform
Open `index.html` in your browser or serve it with a local web server.

### 3. Generate Stream Credentials
1. Click "Add Church Feed" in the Broadcast Control Room
2. Enter church details and generate credentials
3. Copy the RTMP URL and Stream Key

### 4. Configure OBS
1. Open OBS Settings → Stream
2. Service: Custom
3. Server: Use the RTMP URL from step 3
4. Stream Key: Use the Stream Key from step 3

### 5. Start Streaming
1. Click "Start Streaming" in OBS
2. Watch the feed appear in the Broadcast Control Room
3. See the 🌍 CDN badge appear when the stream is distributed globally

## CDN Features

### Automatic Global Distribution
- Streams are automatically distributed to 5cent's global CDN network
- Viewers connect to the nearest edge location for lowest latency
- No manual configuration required

### Status Indicators
- **🌍 CDN**: Stream is being distributed globally via 5cent CDN
- **📡 Local**: Stream is only available locally (if CDN is disabled or fails)

### Monitoring
- Check the "Active Delivery" panel for CDN status
- View global edge traffic in the "Edge reach" section
- Monitor viewer counts in the "CDN viewers" metric

## Testing the Integration

Run the test script to verify everything is working:
```bash
node test-cdn-integration.js
```

## Troubleshooting

### CDN Not Activating
1. Check that the server is running: `http://localhost:3001/api/status`
2. Verify API key in `server/.env`
3. Check server logs for CDN creation errors

### Stream Not Appearing
1. Verify OBS is configured with the correct RTMP URL and Stream Key
2. Check that the stream key matches a generated credential
3. Look for RTMP connection logs in the server console

### Playback Issues
1. Local HLS: `http://localhost:8000/live/[stream-key]/index.m3u8`
2. CDN URL: Available in the feed details (click "Preview")
3. Check browser console for playback errors

## Advanced Configuration

### Environment Variables (`server/.env`)
```
FIVECENTS_API_KEY=de54c6a305e552620817c5e4a03954e3
FIVECENTS_ACCOUNT_ID=10244
FIVECENTS_API_PROFILE_ID=1151
STORAGE_ENABLED=false  # Set to true to enable recording
```

### Production Deployment
For production use, update:
1. `SERVER_HOST` to your domain
2. Configure SSL certificates
3. Set up proper firewall rules
4. Enable storage if recording is needed

## Support

For 5cent CDN-specific issues:
- 5cent CDN Dashboard: https://console.5centscdn.com
- API Documentation: https://docs.5centscdn.com

For platform issues:
- Check server logs for errors
- Verify network connectivity
- Test with the provided test script

---

**Your Loveworld Networks platform is now ready for global broadcasting!** 🎥🌍