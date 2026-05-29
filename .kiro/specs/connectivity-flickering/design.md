# Connectivity Flickering Bugfix Design

## Overview

The connectivity flickering bug occurs because the polling logic in the Loveworld Networks Live platform uses aggressive timeouts and lacks proper error handling. When the API server responds slowly (due to CDN integration, network latency, or server load), the frontend incorrectly reports "offline" status, causing the UI to flicker between online and offline states. This fix will implement robust polling with retry logic, debouncing, and appropriate timeouts to provide stable status reporting while maintaining all existing functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when polling requests fail due to timeout or transient errors causing incorrect offline status
- **Property (P)**: The desired behavior when polling - stable status reporting with appropriate retry logic and debouncing
- **Preservation**: Existing HLS video playback, feed updates, and user interactions that must remain unchanged
- **apiFetch**: The function in `js/api.js` that handles HTTP requests with timeout signals
- **checkServer**: The function in `js/api.js` that checks server status by calling `/api/status`
- **startPolling**: The function in `js/api.js` that initiates 5-second polling intervals
- **serverOnline**: The boolean state variable that tracks server connectivity status

## Bug Details

### Bug Condition

The bug manifests when the API polling logic encounters timeout errors, network latency, or server response delays. The `apiFetch` function uses an 8-second timeout via `AbortSignal.timeout(8000)`, and the `checkServer` function returns `false` for any error (including timeout). This causes the polling logic to immediately mark the server as offline, triggering UI updates that show flickering status.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type PollingContext
  OUTPUT: boolean
  
  RETURN input.responseTime > TIMEOUT_THRESHOLD
         OR input.networkError = true
         OR input.serverError = true
         AND input.previousStatus = "online"
         AND input.retryCount < MAX_RETRIES
END FUNCTION
```

### Examples

- **Example 1**: Server under load takes 9 seconds to respond to `/api/status` → `apiFetch` times out after 8 seconds → `checkServer` returns `false` → UI shows "offline" despite server being online
- **Example 2**: Transient network blip causes fetch to fail → `checkServer` catches error and returns `false` → UI shows "offline" → Next poll succeeds → UI shows "online" → Creates flickering effect
- **Example 3**: CDN integration in server causes occasional 10-second response times → Every other poll times out → UI flickers between "online" and "offline" every 5 seconds
- **Edge Case**: Server genuinely offline for extended period → System should correctly show "offline" after retry logic exhausts

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- HLS video playback must continue to work exactly as before
- Feed updates and data synchronization must remain unchanged
- User interactions with the platform must not be affected
- Credential management and admin functions must continue working
- Real-time simulation and activity feed must remain functional

**Scope:**
All inputs that do NOT involve polling timeouts or transient network errors should be completely unaffected by this fix. This includes:
- Mouse clicks and user interface interactions
- HLS video playback and player controls
- Map interactions and church search functionality
- Meeting room operations and event management
- Broadcast control room operations

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Aggressive Timeout Setting**: The 8-second timeout in `apiFetch` is too short for servers under load or with CDN integration
   - CDN API calls in the server can add latency
   - Network conditions may vary
   - Server processing time may exceed 8 seconds during peak load

2. **No Retry Logic**: The `checkServer` function returns `false` on first failure without retry attempts
   - Transient network errors cause immediate status change
   - No exponential backoff or retry mechanism
   - Single failure triggers offline status

3. **No Debouncing/Hysteresis**: Status changes happen immediately without smoothing
   - Each poll independently determines status
   - No consideration of previous successful polls
   - Rapid toggling between states causes flickering

4. **Error Handling Over-simplification**: The `checkServer` function catches all errors and returns `false`
   - Doesn't distinguish between timeout and other errors
   - No logging or debugging information
   - Same treatment for all error types

## Correctness Properties

Property 1: Bug Condition - Stable Status Reporting

_For any_ polling context where the server is actually online but responds slowly or experiences transient errors, the fixed polling logic SHALL maintain "online" status through appropriate retry mechanisms and timeout adjustments, preventing unnecessary status flickering.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Unchanged Platform Functionality

_For any_ user interaction, video playback, or data operation that does not involve polling failures, the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality including HLS playback, feed updates, and user interface interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `js/api.js`

**Function**: `apiFetch`, `checkServer`, `startPolling`

**Specific Changes**:
1. **Increase Timeout**: Extend `apiFetch` timeout from 8 seconds to 15 seconds to accommodate server load and CDN integration
2. **Add Retry Logic**: Implement retry mechanism in `checkServer` with exponential backoff (3 retries with 1s, 2s, 4s delays)
3. **Implement Debouncing**: Add status debouncing logic to prevent rapid toggling (require 2 consecutive failures before showing offline)
4. **Improve Error Handling**: Distinguish between timeout errors and other errors, with appropriate logging
5. **Add Health Metrics**: Track response times and success rates for monitoring and debugging

**File**: `js/app.js`

**Function**: Polling callbacks

**Specific Changes**:
1. **Smooth UI Transitions**: Add CSS transitions or visual feedback for status changes
2. **Status Persistence**: Maintain status for minimum duration before allowing change
3. **Error Display**: Show informative messages for different error types

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate slow server responses, network timeouts, and transient errors. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Slow Response Test**: Simulate server response taking 9 seconds (will fail on unfixed code due to 8-second timeout)
2. **Transient Error Test**: Simulate one failed request followed by success (will fail on unfixed code showing flickering)
3. **CDN Latency Test**: Simulate variable response times (5-12 seconds) (will fail on unfixed code with intermittent failures)
4. **Network Blip Test**: Simulate network failure for one polling cycle (will fail on unfixed code showing offline)

**Expected Counterexamples**:
- Status changes from online to offline when response time exceeds 8 seconds
- Single failed request causes immediate offline status
- Rapid toggling between online/offline states
- Possible causes: timeout too short, no retry logic, no debouncing

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedPollingLogic(input)
  ASSERT stableStatusReporting(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalPollingLogic(input) = fixedPollingLogic(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Normal Response Preservation**: Observe that quick server responses (< 3 seconds) work correctly on unfixed code, then write test to verify this continues after fix
2. **Video Playback Preservation**: Observe that HLS playback works on unfixed code, then write test to verify this continues after fix
3. **User Interaction Preservation**: Observe that all UI interactions work on unfixed code, then write tests to verify this continues after fix
4. **Feed Updates Preservation**: Observe that feed updates work on unfixed code, then write tests to verify this continues after fix

### Unit Tests

- Test `apiFetch` with various timeout scenarios
- Test `checkServer` retry logic with simulated failures
- Test status debouncing with rapid state changes
- Test error handling for different error types

### Property-Based Tests

- Generate random response times (1-20 seconds) and verify stable status reporting
- Generate random network error patterns and verify retry logic works correctly
- Test that all non-polling functionality remains unchanged across many scenarios
- Verify status persistence and debouncing across random state sequences

### Integration Tests

- Test full polling cycle with simulated slow server responses
- Test UI status indicator behavior under various network conditions
- Test that HLS playback continues during status transitions
- Test that user interactions are not blocked by polling logic