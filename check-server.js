// Quick server check script
const { exec } = require('child_process');
const http = require('http');

console.log('🔍 Checking broadcast server status...\n');

// Check if ports are in use
function checkPort(port, service) {
  return new Promise((resolve) => {
    const req = http.request({ 
      hostname: 'localhost', 
      port, 
      path: '/',
      method: 'HEAD',
      timeout: 2000 
    }, (res) => {
      console.log(`✅ Port ${port} (${service}) is responding`);
      resolve(true);
    });
    
    req.on('error', () => {
      console.log(`❌ Port ${port} (${service}) is not responding`);
      resolve(false);
    });
    
    req.on('timeout', () => {
      console.log(`⏱️  Port ${port} (${service}) timeout - might be blocked`);
      resolve(false);
    });
    
    req.end();
  });
}

async function runChecks() {
  console.log('=== Port Checks ===');
  const apiPort = await checkPort(3001, 'API Server');
  const httpPort = await checkPort(8000, 'HLS Server');
  
  console.log('\n=== OBS Configuration ===');
  console.log('Server: rtmp://localhost/live');
  console.log('Stream Key: global-main');
  
  console.log('\n=== Quick Fixes ===');
  
  if (!apiPort && !httpPort) {
    console.log('1. Server is NOT running. Start it with:');
    console.log('   cd server && npm start');
    console.log('   or');
    console.log('   ./start-server.sh');
  } else if (apiPort && !httpPort) {
    console.log('1. API server is running but HLS server is not');
    console.log('2. Check if Node Media Server started properly');
  } else {
    console.log('1. Server appears to be running');
    console.log('2. Check OBS settings match exactly:');
    console.log('   - Server: rtmp://localhost/live');
    console.log('   - Stream Key: global-main');
  }
  
  console.log('\n=== Test Connection ===');
  console.log('1. Open browser to: http://localhost:3001/api/status');
  console.log('2. Should see: {"ok":true,"rtmpUrl":"rtmp://localhost/live",...}');
  console.log('3. If error, server needs to be started');
  
  console.log('\n=== Common Issues ===');
  console.log('• Firewall blocking ports 1935, 8000, 3001');
  console.log('• Another app using same ports');
  console.log('• Server not started');
  console.log('• Wrong OBS settings');
}

runChecks().catch(console.error);