# Bug Condition Exploration Report

## Task: Write bug condition exploration test
**Property 1: Bug Condition - Polling Timeout Flickering**  
**Validates: Requirements 1.1, 1.3**

## Test Execution Summary

### Test Files Created:
1. `js/bug-condition-test.js` - Simple bug condition test
2. `js/connectivity-bug.test.js` - Property-based test implementation
3. `js/api.test.js` - Jest-style test (requires Jest framework)

### Test Results:
- **Expected Outcome**: Tests FAIL on unfixed code (confirms bug exists)
- **Actual Outcome**: Tests FAILED as expected ✅
- **Bug Confirmed**: Yes, the bug exists in the unfixed code

## Counterexamples Found

The bug condition exploration surfaced the following counterexamples:

### Counterexample 1: Slow Server Response (9 seconds)
- **Response Time**: 9000ms
- **Timeout Threshold**: 8000ms  
- **Actual Result**: `checkServer()` returns `false` (offline)
- **Expected Result**: `checkServer()` should return `true` (online)
- **Bug Manifestation**: Response time (9s) > Timeout threshold (8s)

### Counterexample 2: Very Slow Response (15 seconds)
- **Response Time**: 15000ms
- **Timeout Threshold**: 8000ms
- **Actual Result**: `checkServer()` returns `false` (offline)
- **Expected Result**: `checkServer()` should return `true` (online)
- **Bug Manifestation**: Response time (15s) > Timeout threshold (8s)

### Counterexample 3: Just Over Timeout (8.001 seconds)
- **Response Time**: 8001ms
- **Timeout Threshold**: 8000ms
- **Actual Result**: `checkServer()` returns `false` (offline)
- **Expected Result**: `checkServer()` should return `true` (online)
- **Bug Manifestation**: Response time (8.001s) > Timeout threshold (8s)

### Counterexample 4: Extremely Slow Response (20 seconds)
- **Response Time**: 20000ms
- **Timeout Threshold**: 8000ms
- **Actual Result**: `checkServer()` returns `false` (offline)
- **Expected Result**: `checkServer()` should return `true` (online)
- **Bug Manifestation**: Response time (20s) > Timeout threshold (8s)

## Root Cause Analysis

Based on the counterexamples and code analysis:

### Primary Root Cause:
1. **Aggressive Timeout Setting**: `apiFetch` uses `AbortSignal.timeout(8000)` (8-second timeout)
2. **Over-simplified Error Handling**: `checkServer` returns `false` for ALL errors including timeout
3. **No Retry Logic**: Single timeout triggers immediate offline status
4. **No Debouncing/Hysteresis**: Rapid status changes cause flickering

### Code Location:
- **File**: `js/api.js`
- **Function**: `apiFetch` (line with `AbortSignal.timeout(8000)`)
- **Function**: `checkServer` (catches all errors and returns `false`)

### Bug Trigger Conditions:
```
isBugCondition(input) = 
  input.responseTime > 8000ms 
  OR input.networkError = true
  AND input.previousStatus = "online"
  AND input.retryCount = 0
```

## Impact Assessment

### User Experience Impact:
- **Status Flickering**: UI shows rapid online/offline toggling
- **False Alarms**: Users see "offline" when server is actually online
- **Confusion**: Contradiction between status indicator and working video playback

### System Impact:
- **Unnecessary Failover**: Could trigger backup systems unnecessarily
- **Alert Fatigue**: Operators receive false offline alerts
- **Monitoring Issues**: Health metrics show false negatives

### Business Impact:
- **Perceived Unreliability**: Platform appears unstable to users
- **Support Burden**: Increased help desk tickets for false issues
- **Trust Erosion**: Users lose confidence in status indicators

## Test Design

### Property 1: Bug Condition - Polling Timeout Flickering
```
FOR ALL responseTime WHERE serverIsActuallyOnline(responseTime) DO
  result := checkServer(responseTime)
  ASSERT result = true  // Should remain online
END FOR
```

### Test Implementation Details:
- **Scope**: Concrete failing cases for deterministic bug
- **Methodology**: Observation-first, then property encoding
- **Validation**: Tests encode expected behavior (will validate fix)
- **Reproducibility**: Specific response times (9s, 15s, etc.) ensure consistent failures

## Next Steps

### For Fix Implementation (Task 3):
1. **Increase Timeout**: Extend `apiFetch` timeout from 8s to 15s+
2. **Add Retry Logic**: Implement exponential backoff (3 retries: 1s, 2s, 4s)
3. **Implement Debouncing**: Require 2+ consecutive failures before showing offline
4. **Improve Error Handling**: Distinguish timeout vs other errors
5. **Add Health Metrics**: Track response times and success rates

### For Test Validation:
1. **Re-run These Tests**: Same tests should PASS after fix implementation
2. **Preservation Tests**: Ensure non-buggy behavior remains unchanged
3. **Integration Tests**: Verify full polling cycle with simulated conditions

## Conclusion

The bug condition exploration successfully:
1. ✅ Confirmed the bug exists in unfixed code
2. ✅ Surface concrete counterexamples demonstrating the bug
3. ✅ Validated the hypothesized root cause
4. ✅ Created tests that encode expected behavior for fix validation
5. ✅ Documented reproducible failure cases for debugging

The tests are now ready to validate the fix implementation in Task 3.