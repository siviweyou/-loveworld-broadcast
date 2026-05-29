// Quick test to check server configuration
const fs = require('fs');
const path = require('path');

console.log('=== Server Configuration Test ===\n');

// Check .env file
const envPath = path.join(__dirname, 'server', '.env');
if (fs.existsSync(envPath)) {
  console.log('✅ .env file exists');
  const envContent = fs.readFileSync(envPath, 'utf8');
  if (envContent.includes('FIVECENTS_API_KEY=de54c6a305e552620817c5e4a03954e3')) {
    console.log('✅ 5cent CDN API key is configured');
  } else {
    console.log('❌ 5cent CDN API key not found in .env');
  }
} else {
  console.log('❌ .env file not found');
}

// Check credentials
const credsPath = path.join(__dirname, 'server', 'credentials.json');
if (fs.existsSync(credsPath)) {
  console.log('✅ credentials.json exists');
  const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8'));
  console.log(`✅ ${Object.keys(creds).length} stream keys configured`);
  
  if (creds['global-main']) {
    console.log('✅ "global-main" stream key exists');
    console.log(`   RTMP: ${creds['global-main'].rtmpUrl}`);
    console.log(`   Stream Key: ${creds['global-main'].streamKey}`);
  } else {
    console.log('❌ "global-main" stream key not found');
  }
} else {
  console.log('❌ credentials.json not found');
}

// Check package.json
const packagePath = path.join(__dirname, 'server', 'package.json');
if (fs.existsSync(packagePath)) {
  console.log('✅ package.json exists');
  const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  if (pkg.dependencies && pkg.dependencies['node-media-server']) {
    console.log('✅ node-media-server dependency found');
  }
}

console.log('\n=== OBS Configuration ===');
console.log('Server: rtmp://localhost/live');
console.log('Stream Key: global-main');
console.log('\n=== To Start Server ===');
console.log('1. Open terminal in this folder');
console.log('2. Run: ./start-server.sh');
console.log('3. Or: cd server && npm start');
console.log('\n=== To Test Stream ===');
console.log('1. Start the server');
console.log('2. Configure OBS with above settings');
console.log('3. Click "Start Streaming" in OBS');
console.log('4. Open: http://localhost:8000/live/global-main/index.m3u8');
console.log('5. Check: http://localhost:3001/api/feeds for status');