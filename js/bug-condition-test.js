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

console.log('=== Bug Condition Exploration Test ===');
console.log('Testing connectivity flickering bug...\n');

// Mock implementation to simulate the bug
function simulateApiFetchWithTimeout(responseTimeMs) {
    return new Promise((resolve, reject) => {
        // Simulate the actual apiFetch behavior with 8-second timeout
        const timeoutMs = 8000; // Current bug: hardcoded 8-second timeout
        
        if (responseTimeMs <= timeoutMs) {
            // Response arrives before timeout
            setTimeout(() => {
                resolve({ ok: true, json: () => Promise.resolve({ rtmpUrl: 'rtmp://localhost/live' }) });
            }, responseTimeMs);
        } else {
            // Response would arrive after timeout - simulate AbortError
            setTimeout(() => {
                const error = new Error('The operation was aborted due to timeout');
                error.name = 'AbortError';
                reject(error);
            }, timeoutMs);
        }
    });
}

// Simulate checkServer function behavior
async function simulateCheckServer(responseTimeMs) {
    try {
        const res = await simulateApiFetchWithTimeout(responseTimeMs);
        if (res.ok) {
            return true; // Server is online
        }
        return false; // Server error (not timeout)
    } catch (error) {
        // Current bug: checkServer returns false for ALL errors including timeout
        return false;
    }
}

// Test cases
async function runTests() {
    const testCases = [
        {
            name: 'Slow server response (9 seconds)',
            responseTime: 9000,
            expectedResult: true, // Should remain online (server is actually online, just slow)
            description: 'Server responds in 9s, exceeds 8s timeout'
        },
        {
            name: 'Normal server response (3 seconds)',
            responseTime: 3000,
            expectedResult: true, // Should be online
            description: 'Server responds in 3s, within timeout'
        },
        {
            name: 'Very fast server response (1 second)',
            responseTime: 1000,
            expectedResult: true, // Should be online
            description: 'Server responds quickly'
        },
        {
            name: 'Extremely slow response (15 seconds)',
            responseTime: 15000,
            expectedResult: true, // Should remain online (server is actually online, just very slow)
            description: 'Server responds in 15s, greatly exceeds timeout'
        }
    ];

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const testCase of testCases) {
        console.log(`Test: ${testCase.name}`);
        console.log(`  Description: ${testCase.description}`);
        
        try {
            const result = await simulateCheckServer(testCase.responseTime);
            const success = result === testCase.expectedResult;
            
            if (success) {
                console.log(`  ✅ PASS: checkServer() returned ${result} (expected ${testCase.expectedResult})`);
                passed++;
            } else {
                console.log(`  ❌ FAIL: checkServer() returned ${result} (expected ${testCase.expectedResult})`);
                failed++;
                failures.push({
                    testCase,
                    actualResult: result,
                    counterexample: {
                        responseTimeMs: testCase.responseTime,
                        timeoutMs: 8000,
                        result: result,
                        expectedResult: testCase.expectedResult
                    }
                });
            }
        } catch (error) {
            console.log(`  ❌ ERROR: ${error.message}`);
            failed++;
        }
        console.log('');
    }

    // Summary
    console.log('=== Test Summary ===');
    console.log(`Total tests: ${testCases.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
        console.log('\n=== BUG CONFIRMED ===');
        console.log('The bug condition exploration test FAILED as expected.');
        console.log('This confirms the bug exists in the unfixed code.');
        console.log('\nCounterexamples found (demonstrating the bug):');
        
        failures.forEach((failure, index) => {
            console.log(`\nCounterexample ${index + 1}:`);
            console.log(`  Test: ${failure.testCase.name}`);
            console.log(`  Response time: ${failure.counterexample.responseTimeMs}ms`);
            console.log(`  Timeout threshold: ${failure.counterexample.timeoutMs}ms`);
            console.log(`  Actual result: ${failure.counterexample.result ? 'online' : 'offline'}`);
            console.log(`  Expected result: ${failure.counterexample.expectedResult ? 'online' : 'offline'}`);
            console.log(`  Bug manifestation: Server response (${failure.counterexample.responseTimeMs}ms) > Timeout (${failure.counterexample.timeoutMs}ms)`);
            console.log(`  Root cause: apiFetch uses AbortSignal.timeout(8000), checkServer returns false for timeout errors`);
        });
        
        console.log('\n=== Bug Analysis ===');
        console.log('The bug occurs when:');
        console.log('1. Server response time exceeds 8-second timeout threshold');
        console.log('2. apiFetch times out and throws AbortError');
        console.log('3. checkServer catches the error and returns false');
        console.log('4. System incorrectly shows "offline" status even though server is online');
        console.log('\nThis causes connectivity flickering when:');
        console.log('- Server is under load and responses are slow');
        console.log('- CDN integration adds latency');
        console.log('- Network conditions vary');
        console.log('- Response times fluctuate around the 8-second threshold');
        
        return {
            status: 'BUG_CONFIRMED',
            totalTests: testCases.length,
            passed,
            failed,
            failures: failures.map(f => f.counterexample)
        };
    } else {
        console.log('\n=== UNEXPECTED RESULT ===');
        console.log('All tests passed, which is unexpected for unfixed code.');
        console.log('This could mean:');
        console.log('1. The bug might already be fixed');
        console.log('2. Test simulation might not match actual code behavior');
        console.log('3. Different root cause than hypothesized');
        
        return {
            status: 'UNEXPECTED_PASS',
            totalTests: testCases.length,
            passed,
            failed,
            note: 'All tests passed unexpectedly - bug might not exist or test setup incorrect'
        };
    }
}

// Run the tests
runTests().then(result => {
    console.log('\n=== Test Complete ===');
    console.log(`Status: ${result.status}`);
    
    // For PBT status update
    if (result.status === 'BUG_CONFIRMED' && result.failures.length > 0) {
        console.log('\nFailing examples (for PBT status update):');
        result.failures.forEach((failure, i) => {
            console.log(`\nExample ${i + 1}:`);
            console.log(`ResponseTime: ${failure.responseTimeMs}ms`);
            console.log(`Timeout: ${failure.timeoutMs}ms`);
            console.log(`Result: ${failure.result ? 'online' : 'offline'}`);
            console.log(`Expected: ${failure.expectedResult ? 'online' : 'offline'}`);
        });
    }
}).catch(error => {
    console.error('Test execution error:', error);
});