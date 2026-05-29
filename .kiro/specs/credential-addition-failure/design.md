# Credential Addition Failure Bugfix Design

## Overview

The Loveworld Networks Live platform experiences credential addition failures when 5centsCDN API calls fail. The bug occurs when the server attempts to create CDN credentials but the API calls fail due to invalid API keys, permissions issues, or API problems. The original server code didn't handle these failures gracefully, causing credential creation to fail entirely. The fix implements a fallback mechanism that allows local credential creation to proceed even when CDN operations fail, ensuring system resilience and uninterrupted service.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when `create5centsPushCredential()` throws an error while `CDN_ENABLED` is true
- **Property (P)**: The desired behavior when CDN API calls fail - system should fall back to local credential creation
- **Preservation**: Existing successful CDN credential creation and local credential creation that must remain unchanged by the fix
- **create5centsPushCredential()**: The function in `server/index.js` that creates CDN push credentials via 5centsCDN API
- **CDN_ENABLED**: Boolean configuration flag indicating whether CDN integration is active
- **FIVECENTS_API_KEY**: Environment variable containing the 5centsCDN API key

## Bug Details

### Bug Condition

The bug manifests when a user attempts to create a new credential through the `/api/credentials` endpoint while `CDN_ENABLED` is true. The `create5centsPushCredential()` function throws an error due to API failures, and the original code didn't catch this error, causing the entire credential creation process to fail with a 502 error.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type CredentialCreationRequest
  OUTPUT: boolean
  
  RETURN CDN_ENABLED = true
         AND create5centsPushCredential(input.name) throws error
         AND credentialCreationFailsEntirely()
END FUNCTION
```

### Examples

- **Example 1**: Invalid API key - When `FIVECENTS_API_KEY` is invalid or expired, `create5centsPushCredential()` throws authentication error, causing 502 response
- **Example 2**: API permissions issue - When API key lacks "Livestreams/Push Streams" permission, API returns "not allowed" error, causing 502 response
- **Example 3**: Network timeout - When 5centsCDN API is unreachable or times out, function throws network error, causing 502 response
- **Example 4**: API quota exceeded - When API rate limit is exceeded, function throws quota error, causing 502 response
- **Edge Case**: Valid API key but CDN disabled - Should create local credentials successfully (not a bug condition)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Successful CDN credential creation must continue to work exactly as before
- Local credential creation when `CDN_ENABLED` is false must continue to work exactly as before
- API authentication with `API_SECRET` must continue to work exactly as before
- Credential saving to `credentials.json` must continue to work exactly as before
- Frontend credential response format must remain unchanged

**Scope:**
All inputs that do NOT involve CDN API failures should be completely unaffected by this fix. This includes:
- Valid CDN API calls that succeed
- Local credential creation when `CDN_ENABLED` is false
- All other API endpoints (`/api/status`, `/api/feeds`, `/api/program`)
- Authentication and authorization flows

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Missing Error Handling**: The original code didn't wrap `create5centsPushCredential()` in a try-catch block
   - The function could throw various errors (network, authentication, API errors)
   - Without error handling, these exceptions propagate up and cause 502 errors

2. **No Fallback Mechanism**: The code didn't implement a fallback to local credential creation
   - When CDN fails, the system should still be able to create local credentials
   - Local RTMP server credentials should be generated as a backup

3. **Insufficient Logging**: Error details weren't properly logged for debugging
   - Operators need visibility into why CDN operations fail
   - Proper logging helps diagnose API key issues, permission problems, etc.

4. **Graceful Degradation Missing**: The system lacked resilience patterns
   - A single point of failure (CDN API) shouldn't break the entire credential creation flow
   - The system should degrade gracefully when external dependencies fail

## Correctness Properties

Property 1: Bug Condition - CDN Failure Fallback

_For any_ credential creation request where `CDN_ENABLED` is true and `create5centsPushCredential()` throws an error, the fixed credential creation endpoint SHALL catch the error, log a warning, and proceed to create local RTMP server credentials, returning a successful response with local credential details.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Successful CDN and Local Credential Creation

_For any_ input where the bug condition does NOT hold (either `CDN_ENABLED` is false, or `create5centsPushCredential()` succeeds), the fixed function SHALL produce exactly the same behavior as the original function, preserving all existing functionality for successful CDN credential creation and local credential creation.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `server/index.js`

**Function**: Credential creation endpoint handler (POST `/api/credentials`)

**Specific Changes**:
1. **Add Try-Catch Block**: Wrap `create5centsPushCredential()` call in try-catch
   - Catch all errors from the CDN API call
   - Log detailed warning with error message for debugging
   - Set `cdnCredential` to `null` on failure

2. **Implement Fallback Logic**: Add conditional logic for local credential creation
   - If `cdnCredential` is `null` (due to failure or `CDN_ENABLED` false), generate local credentials
   - Use `generateStreamKey()` for local stream key generation
   - Use local RTMP URL and HLS URL construction

3. **Maintain Response Consistency**: Ensure response format remains consistent
   - Include `provider` field indicating "5centsCDN" or "local"
   - Include all required fields: `id`, `name`, `type`, `city`, `streamKey`, `rtmpUrl`, `hlsUrl`, etc.
   - Maintain backward compatibility for frontend consumption

4. **Enhance Logging**: Add informative logging for both success and failure cases
   - Log successful CDN credential creation with provider details
   - Log CDN failures with error messages for operator visibility
   - Log local credential creation as fallback

5. **Error Response Improvement**: Maintain proper HTTP status codes
   - Return 201 Created for successful credential creation (both CDN and local)
   - Only return error status for fundamental issues (invalid JSON, missing name)
   - Do not return 502 for CDN failures since fallback exists

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate CDN API failures and assert that credential creation still succeeds with local credentials. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Invalid API Key Test**: Simulate credential creation with invalid `FIVECENTS_API_KEY` (will fail on unfixed code)
2. **Network Failure Test**: Simulate network timeout when calling 5centsCDN API (will fail on unfixed code)
3. **API Permission Test**: Simulate "not allowed" error from CDN API (will fail on unfixed code)
4. **CDN Disabled Test**: Test with `CDN_ENABLED=false` (should pass on unfixed code)

**Expected Counterexamples**:
- Credential creation returns 502 error when CDN API fails
- No local credentials are created as fallback
- Error details may not be properly logged

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := createCredential_fixed(input)
  ASSERT result.status = 201
  ASSERT result.provider = "local"
  ASSERT result.streamKey is valid
  ASSERT result.rtmpUrl matches local RTMP pattern
  ASSERT result.hlsUrl matches local HLS pattern
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT createCredential_original(input) = createCredential_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for successful CDN and local credential creation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Successful CDN Preservation**: Observe that valid CDN API calls create CDN credentials on unfixed code, then write test to verify this continues after fix
2. **Local Credential Preservation**: Observe that local credential creation works on unfixed code when `CDN_ENABLED=false`, then write test to verify this continues after fix
3. **Response Format Preservation**: Verify that response format remains identical for all successful cases
4. **Authentication Preservation**: Verify that API authentication continues to work correctly

### Unit Tests

- Test credential creation with mocked CDN API success
- Test credential creation with mocked CDN API failure (verify fallback)
- Test credential creation with `CDN_ENABLED=false` (verify local only)
- Test error cases (missing name, invalid JSON)
- Test authentication requirements

### Property-Based Tests

- Generate random credential creation requests and verify CDN success/failure handling
- Generate random API error types and verify graceful fallback
- Test that all non-CDN-failure inputs produce identical results before and after fix
- Test edge cases (empty names, special characters, long names)

### Integration Tests

- Test full credential creation flow with real (or mocked) CDN API
- Test that created credentials work with RTMP streaming
- Test that credentials are properly saved to `credentials.json`
- Test that frontend can successfully use created credentials
- Test credential deletion and cleanup
