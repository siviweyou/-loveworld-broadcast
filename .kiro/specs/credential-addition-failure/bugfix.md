# Bugfix Requirements Document

## Introduction

The Loveworld Networks Live platform experiences credential addition failures when trying to add new church credentials. The failure occurs because 5centsCDN API calls fail (due to invalid API key, permissions issues, or API problems), and the original server code doesn't handle these failures gracefully, causing credential creation to fail entirely.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN 5centsCDN API calls fail (invalid API key, permissions issues, or API problems) THEN the system fails to create credentials entirely

1.2 WHEN CDN_ENABLED is true and FIVECENTS_API_KEY is configured THEN the system attempts to create 5centsCDN credentials before local credentials

1.3 WHEN create5centsPushCredential() throws an error THEN the credential creation endpoint returns a 502 error without creating local credentials

1.4 WHEN the server has no API_SECRET configured THEN authentication is disabled but credential creation still fails due to CDN issues

### Expected Behavior (Correct)

2.1 WHEN 5centsCDN API calls fail THEN the system SHALL fall back to creating local RTMP server credentials

2.2 WHEN CDN_ENABLED is true but CDN credential creation fails THEN the system SHALL continue with local credential creation

2.3 WHEN create5centsPushCredential() throws an error THEN the system SHALL catch the error, log a warning, and proceed with local credential creation

2.4 WHEN credential creation is requested THEN the system SHALL always return a credential (either CDN or local) unless there are fundamental server errors

### Unchanged Behavior (Regression Prevention)

3.1 WHEN 5centsCDN API calls succeed THEN the system SHALL CONTINUE TO create CDN credentials as before

3.2 WHEN CDN_ENABLED is false THEN the system SHALL CONTINUE TO create local credentials as before

3.3 WHEN the server has valid API_SECRET configured THEN the system SHALL CONTINUE TO require authentication for credential creation

3.4 WHEN credential creation succeeds THEN the system SHALL CONTINUE TO save credentials to credentials.json and return them to the frontend

3.5 WHEN the frontend calls createCredential() THEN the system SHALL CONTINUE TO return credential details including RTMP URL, stream key, and HLS URL