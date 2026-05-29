const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('=== Running Real API Integration Test Suite ===\n');

// 1. Setup Sandbox Environment
const fetchMockCalls = [];
let mockFetchHandler = null;

// Global browser mocks
global.LW_CONFIG = {
  BROADCAST_SERVER_URL: 'http://localhost:3001',
  DEFAULT_RTMP_URL: 'rtmp://localhost/live',
  API_SECRET: ''
};

global.fetch = (url, options) => {
  fetchMockCalls.push({ url, options });
  if (mockFetchHandler) {
    return mockFetchHandler(url, options);
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ ok: true, rtmpUrl: 'rtmp://localhost/live' })
  });
};

// Evaluate api.js in the global sandbox context
const apiJsContent = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');
vm.runInThisContext(apiJsContent);

// Ensure LWAPI was loaded
if (typeof LWAPI === 'undefined') {
  console.error('❌ Failed to load LWAPI from api.js');
  process.exit(1);
}
console.log('✅ LWAPI loaded successfully from api.js\n');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSuite() {
  let passed = 0;
  let failed = 0;

  // ------------------------------------------------------------
  // Test 1: Check Fetch Timeout of 15s (15000ms)
  // ------------------------------------------------------------
  console.log('Test 1: Slow response (10s) should NOT time out (Timeout increased to 15s)');
  fetchMockCalls.length = 0;
  mockFetchHandler = (url, options) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve({
          ok: true,
          json: () => Promise.resolve({ ok: true, rtmpUrl: 'rtmp://localhost/live' })
        });
      }, 10000); // 10 seconds (exceeds old 8s, within new 15s)
      
      if (options.signal) {
        options.signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          reject(err);
        });
      }
    });
  };

  try {
    const start = Date.now();
    const result = await LWAPI.checkServer();
    const duration = Date.now() - start;
    
    if (result === true && duration >= 10000) {
      console.log(`  ✅ PASS: checkServer succeeded after ${Math.round(duration/1000)}s (Old code would have aborted at 8s)`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: checkServer returned ${result} in ${duration}ms`);
      failed++;
    }
  } catch (err) {
    console.log('  ❌ FAIL:', err.message);
    failed++;
  }
  console.log('');

  // ------------------------------------------------------------
  // Test 2: Retry Logic in checkServer
  // ------------------------------------------------------------
  console.log('Test 2: checkServer should retry up to 3 times on failure');
  fetchMockCalls.length = 0;
  
  // Make fetch fail
  mockFetchHandler = () => Promise.reject(new Error('Network failure'));

  try {
    const start = Date.now();
    const result = await LWAPI.checkServer();
    const duration = Date.now() - start;
    
    // We expect 3 fetch calls with exponential backoff delays (1s, 2s) => total duration ~ 3 seconds
    if (result === false && fetchMockCalls.length === 3 && duration >= 3000) {
      console.log(`  ✅ PASS: checkServer returned false after exactly ${fetchMockCalls.length} attempts and ${Math.round(duration/1000)}s`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: checkServer returned ${result}, attempts: ${fetchMockCalls.length}, duration: ${duration}ms`);
      failed++;
    }
  } catch (err) {
    console.log('  ❌ FAIL:', err.message);
    failed++;
  }
  console.log('');

  // ------------------------------------------------------------
  // Test 3: Status Debouncing in startPolling
  // ------------------------------------------------------------
  console.log('Test 3: startPolling should require 2 consecutive failures before declaring offline');
  fetchMockCalls.length = 0;
  
  let updateCount = 0;
  let offlineCount = 0;
  
  // Mock successful response initially, then fail
  let shouldFail = false;
  mockFetchHandler = (url) => {
    if (url.includes('/api/status')) {
      if (shouldFail) {
        return Promise.reject(new Error('Transient failure'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, rtmpUrl: 'rtmp://localhost/live' })
      });
    }
    // getFeeds
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve([])
    });
  };

  LWAPI.startPolling(
    () => { updateCount++; },
    () => { offlineCount++; }
  );

  // Allow first poll (tick is synchronous) to complete successfully
  await sleep(100); 
  
  // Verify initially online
  const initialOnlineState = LWAPI.isOnline();
  
  // Trigger failures
  shouldFail = true;
  
  // Wait for next poll (polling is every 5000ms + 3000ms retry time, let's wait 8500ms)
  console.log('  Waiting 8.5s for the first failure poll and its retries to finish...');
  await sleep(8500);
  const stateAfterFirstFailure = LWAPI.isOnline();
  const offlineCountAfterFirstFailure = offlineCount;
  
  // Wait for second poll (another 5500ms)
  console.log('  Waiting 5.5s for the second consecutive failure poll and its retries to finish...');
  await sleep(5500);
  const stateAfterSecondFailure = LWAPI.isOnline();
  const offlineCountAfterSecondFailure = offlineCount;
  
  LWAPI.stopPolling();

  if (initialOnlineState === true &&
      stateAfterFirstFailure === true && offlineCountAfterFirstFailure === 0 &&
      stateAfterSecondFailure === false && offlineCountAfterSecondFailure === 1) {
    console.log('  ✅ PASS: Polling status successfully debounced (Offline state triggered only on 2nd consecutive failure)');
    passed++;
  } else {
    console.log('  ❌ FAIL:');
    console.log(`    - Initial online: ${initialOnlineState} (expected: true)`);
    console.log(`    - After 1st failure - online: ${stateAfterFirstFailure} (expected: true), offline calls: ${offlineCountAfterFirstFailure} (expected: 0)`);
    console.log(`    - After 2nd failure - online: ${stateAfterSecondFailure} (expected: false), offline calls: ${offlineCountAfterSecondFailure} (expected: 1)`);
    failed++;
  }
  console.log('');

  // ------------------------------------------------------------
  // Final Summary
  // ------------------------------------------------------------
  console.log('=== Verification Summary ===');
  console.log(`Total test scenarios: ${passed + failed}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
  }
}

runSuite().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
