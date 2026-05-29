# Implementation Plan

## Overview

This implementation plan follows the bug condition methodology for fixing the credential addition failure bug. The bug occurs when 5centsCDN API calls fail, causing credential creation to fail entirely. A partial fix has already been implemented in `server/index.js` with a try-catch block around `create5centsPushCredential()`. This plan verifies and completes the fix while ensuring no regressions.

## Tasks

### Phase 1: Bug Exploration (Before Fix)

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - CDN API Failure Fallback
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope the property to the concrete failing case(s) to ensure reproducibility
  - Test that when CDN_ENABLED is true and create5centsPushCredential() throws an error, credential creation should still succeed with local credentials
  - Test cases to simulate:
    1. Invalid API key - simulate authentication error
    2. Network failure - simulate timeout or connection error
    3. API permission error - simulate "not allowed" error
    4. API quota exceeded - simulate rate limit error
  - Assertions should match Expected Behavior from design:
    - Response status should be 201 Created (not 502)
    - Response should include valid credential with provider "local"
    - Response should include valid streamKey, rtmpUrl, hlsUrl
    - Credential should be saved to credentials.json
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Successful CDN and Local Credential Creation
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Test cases to observe and preserve:
    1. Successful CDN credential creation - when CDN_ENABLED is true and API calls succeed
    2. Local credential creation when CDN_ENABLED is false
    3. API authentication with valid API_SECRET
    4. Credential saving to credentials.json
    5. Response format consistency (fields: id, name, type, city, streamKey, rtmpUrl, hlsUrl, provider, cdnId, playbackRtmp, createdAt)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

### Phase 2: Fix Implementation

- [ ] 3. Fix for credential addition failure when 5centsCDN API calls fail

  - [ ] 3.1 Verify and complete the partial fix implementation
    - **Note**: A partial fix has already been implemented in `server/index.js` (try-catch added around `create5centsPushCredential()`)
    - Verify the existing try-catch block properly catches all CDN API errors (lines 365-371 in server/index.js)
    - Ensure fallback to local credential creation works correctly when `cdnCredential` is `null` (lines 372-380)
    - Verify response format consistency (include `provider` field as "5centsCDN" or "local") (line 377)
    - Ensure proper logging for both success and failure cases (lines 368, 378)
    - Verify HTTP status codes are correct (201 Created for successful credential creation) (line 380)
    - Check that error handling doesn't return 502 for CDN failures (line 383 should only catch SyntaxError)
    - Verify that `generateStreamKey()` is called when CDN fails (line 373)
    - Ensure local RTMP URL and HLS URL are constructed correctly (lines 374-375)
    - _Bug_Condition: isBugCondition(input) where CDN_ENABLED = true AND create5centsPushCredential(input.name) throws error_
    - _Expected_Behavior: expectedBehavior(result) from design - system should fall back to local credential creation_
    - _Preservation: Preservation Requirements from design - successful CDN and local credential creation must remain unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - CDN API Failure Fallback
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: Expected Behavior Properties from design_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Successful CDN and Local Credential Creation
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

### Phase 3: Validation

- [ ] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": "wave-1",
      "name": "Exploration & Preservation Testing",
      "tasks": ["1. Write bug condition exploration test", "2. Write preservation property tests (BEFORE implementing fix)"]
    },
    {
      "id": "wave-2", 
      "name": "Fix Implementation",
      "tasks": ["3.1 Verify and complete the partial fix implementation"],
      "dependsOn": ["wave-1"]
    },
    {
      "id": "wave-3",
      "name": "Fix Validation",
      "tasks": ["3.2 Verify bug condition exploration test now passes", "3.3 Verify preservation tests still pass"],
      "dependsOn": ["wave-2"]
    },
    {
      "id": "wave-4",
      "name": "Final Checkpoint",
      "tasks": ["4. Checkpoint - Ensure all tests pass"],
      "dependsOn": ["wave-3"]
    }
  ]
}
```

## Notes

- **Partial Fix Already Implemented**: The server code already has a try-catch block around `create5centsPushCredential()` (lines 365-371 in `server/index.js`). This task focuses on verifying and completing this fix.
- **Property-Based Testing**: Both exploration and preservation tests use property-based testing for stronger guarantees.
- **Observation-First Methodology**: Preservation tests follow observation-first approach - observe behavior on unfixed code, then write tests to preserve that behavior.
- **Bug Condition Methodology**: Follows C(X) = bug condition, P(result) = expected behavior, ¬C(X) = non-buggy inputs to preserve.
- **Line References**: Specific line numbers in `server/index.js` are provided for the existing implementation.