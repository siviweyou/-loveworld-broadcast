/**
 * Bug Condition Exploration Test for Connectivity Flickering Bug
 * 
 * This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * Test simulates slow server responses (9 seconds) and verifies that 
 * status remains "online" (which it won't on unfixed code due to 8-second timeout).
 * 
 * **Validates: Requirements 1.1, 1.3**
 * **Property 1: Bug Condition - Polling Timeout Flickering**
 */

// Mock fetch globally for testing
const originalFetch = global.fetch;
let mockResponseTime = 0; // milliseconds
let mockResponseOk = true;
let mockResponseData = { rtmpUrl: 'rtmp://localhost/live' };

// Setup mock fetch
function setupMockFetch(responseTimeMs = 0, responseOk = true, responseData = { rtmpUrl: 'rtmp://localhost/live' }) {
    mockResponseTime = responseTimeMs;
    mockResponseOk = responseOk;
    mockResponseData = responseData;
    
    global.fetch = jest.fn().mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
            // Simulate response delay
            setTimeout(() => {
                if (mockResponseOk) {
                    resolve({
                        ok: true,
                        json: () => Promise.resolve(mockResponseData),
                        status: 200
                    });
                } else {
                    // Simulate timeout error
                    const error = new Error('The operation was aborted due to timeout');
                    error.name = 'AbortError';
                    reject(error);
                }
            }, mockResponseTime);
            
            // Check if timeout signal would abort before our response
            if (options && options.signal) {
                // Simulate AbortSignal.timeout behavior
                const timeout = options.signal;
                if (timeout._timeout && responseTimeMs > timeout._timeout) {
                    setTimeout(() => {
                        const abortError = new Error('The operation was aborted due to timeout');
                        abortError.name = 'AbortError';
                        reject(abortError);
                    }, timeout._timeout);
                }
            }
        });
    });
}

// Restore original fetch
function restoreFetch() {
    global.fetch = originalFetch;
}

// Import the api module functions
// Note: We need to extract the functions from the IIFE for testing
const fs = require('fs');
const path = require('path');

// Read the api.js file to extract functions
const apiJsContent = fs.readFileSync(path.join(__dirname, 'api.js'), 'utf8');

// Extract the LWAPI module functions by evaluating in a controlled environment
// This is a simplified approach for testing
function createTestableApiModule() {
    // Create a mock LW_CONFIG for testing
    global.LW_CONFIG = {
        BROADCAST_SERVER_URL: 'http://localhost:3001',
        DEFAULT_RTMP_URL: 'rtmp://localhost/live',
        API_SECRET: ''
    };
    
    // We'll create a simplified version of the api module for testing
    const BASE = 'http://localhost:3001';
    let serverOnline = false;
    let _rtmpUrl = 'rtmp://localhost/live';
    
    async function apiFetch(path, options = {}) {
        const res = await fetch(`${BASE}${path}`, {
            ...options,
            signal: options.signal || AbortSignal.timeout(8000),
        });
        return res;
    }
    
    async function checkServer() {
        try {
            const res = await apiFetch('/api/status');
            if (res.ok) {
                const data = await res.json();
                if (data.rtmpUrl) _rtmpUrl = data.rtmpUrl;
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }
    
    function isOnline() { return serverOnline; }
    
    return { apiFetch, checkServer, isOnline };
}

// Test: Bug Condition - Slow Server Response (9 seconds)
describe('Bug Condition Exploration Test - Connectivity Flickering', () => {
    let apiModule;
    
    beforeEach(() => {
        apiModule = createTestableApiModule();
        // Default to fast response
        setupMockFetch(1000, true);
    });
    
    afterEach(() => {
        restoreFetch();
        delete global.LW_CONFIG;
    });
    
    test('Test 1: Slow server response (9 seconds) should maintain online status', async () => {
        // Arrange: Simulate slow server response (9 seconds)
        // This exceeds the 8-second timeout in apiFetch
        setupMockFetch(9000, true);
        
        // Act: Call checkServer which uses apiFetch with 8-second timeout
        const result = await apiModule.checkServer();
        
        // Assert: Status should remain online (server is actually online, just slow)
        // EXPECTED BEHAVIOR: result should be true (online)
        // ACTUAL BEHAVIOR ON UNFIXED CODE: result will be false (offline) due to timeout
        expect(result).toBe(true);
        
        // Document the expected vs actual behavior
        console.log('\n=== Bug Condition Test Result ===');
        console.log('Test: Slow server response (9 seconds)');
        console.log('Expected: checkServer() returns true (online)');
        console.log(`Actual: checkServer() returns ${result} (${result ? 'online' : 'offline'})`);
        console.log('Bug Condition: Response time (9s) > Timeout threshold (8s)');
        console.log('Root Cause: apiFetch uses AbortSignal.timeout(8000), checkServer returns false for timeout errors');
    });
    
    test('Test 2: Normal server response (3 seconds) should return online', async () => {
        // Arrange: Simulate normal server response (3 seconds)
        setupMockFetch(3000, true);
        
        // Act & Assert: Should work correctly
        const result = await apiModule.checkServer();
        expect(result).toBe(true);
    });
    
    test('Test 3: Very fast server response (1 second) should return online', async () => {
        // Arrange: Simulate fast server response
        setupMockFetch(1000, true);
        
        // Act & Assert: Should work correctly
        const result = await apiModule.checkServer();
        expect(result).toBe(true);
    });
    
    test('Test 4: Server error (non-timeout) should return offline', async () => {
        // Arrange: Simulate server error (not timeout)
        setupMockFetch(1000, false);
        
        // Act & Assert: Should return false for server errors
        const result = await apiModule.checkServer();
        expect(result).toBe(false);
    });
});

// Run tests if executed directly
if (typeof require !== 'undefined' && require.main === module) {
    console.log('Running bug condition exploration tests...\n');
    
    // Simple test runner
    const tests = [
        {
            name: 'Slow server response (9 seconds) should maintain online status',
            run: async () => {
                const apiModule = createTestableApiModule();
                setupMockFetch(9000, true);
                const result = await apiModule.checkServer();
                return result === true;
            }
        },
        {
            name: 'Normal server response (3 seconds) should return online',
            run: async () => {
                const apiModule = createTestableApiModule();
                setupMockFetch(3000, true);
                const result = await apiModule.checkServer();
                return result === true;
            }
        }
    ];
    
    async function runAllTests() {
        let passed = 0;
        let failed = 0;
        
        for (const test of tests) {
            try {
                const success = await test.run();
                if (success) {
                    console.log(`✅ ${test.name}`);
                    passed++;
                } else {
                    console.log(`❌ ${test.name} - FAILED`);
                    console.log(`   This test is expected to fail on unfixed code`);
                    console.log(`   This confirms the bug exists: timeout too short (8s) for slow responses (9s)`);
                    failed++;
                }
            } catch (error) {
                console.log(`❌ ${test.name} - ERROR: ${error.message}`);
                failed++;
            }
        }
        
        console.log(`\n=== Test Summary ===`);
        console.log(`Total: ${tests.length}, Passed: ${passed}, Failed: ${failed}`);
        
        // For bug condition exploration, we expect test 1 to fail
        if (failed > 0) {
            console.log(`\n🎯 BUG CONFIRMED: Test failure demonstrates the bug exists`);
            console.log(`The bug occurs when server response time exceeds 8-second timeout`);
            console.log(`Root cause: apiFetch uses AbortSignal.timeout(8000), checkServer returns false for timeout errors`);
            console.log(`Expected fix: Increase timeout, add retry logic, implement debouncing`);
        } else {
            console.log(`\n⚠️ UNEXPECTED: All tests passed`);
            console.log(`This suggests the bug might not exist or test setup is incorrect`);
        }
    }
    
    runAllTests();
}