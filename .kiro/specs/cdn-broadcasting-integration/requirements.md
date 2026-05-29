# Requirements Document

## Introduction

This feature integrates 5centscdn.net as the live broadcasting CDN for the Loveworld Networks Live platform. The integration replaces the current mock data in the Broadcast Control Room with real CDN-backed ingest and playback endpoints. The scope is limited to live broadcasting only — no storage, recording, or VOD functionality is included in this phase.

Church encoders (OBS or hardware encoders) publish live video over RTMP or RTMPS to 5centscdn.net ingest endpoints. The CDN transcodes and packages the stream into HLS for global viewer delivery. The Broadcast Control Room UI reflects real stream status, and operators can provision ingest credentials, monitor feed health, and manage push destinations through the existing interface.

## Glossary

- **CDN_Service**: The 5centscdn.net live streaming CDN that receives ingest streams and delivers HLS playback globally.
- **Ingest_Endpoint**: The RTMP or RTMPS URL and stream key issued by the CDN_Service for a specific live channel.
- **Stream_Key**: A secret credential that authenticates an encoder's publish connection to the CDN_Service.
- **HLS_Manifest**: The `.m3u8` playlist URL served by the CDN_Service for viewer playback.
- **Broadcast_Channel**: A named live stream resource on the CDN_Service, corresponding to a Loveworld channel (e.g., LoveworldSAT, LoveWorld USA).
- **Church_Feed**: An ingest connection from a church encoder to the CDN_Service, identified by a unique stream key.
- **Push_Destination**: An outbound RTMP or SRT relay target that the CDN_Service forwards the live program to (e.g., YouTube, regional relay).
- **Control_Room**: The Broadcast Control Room view in the Loveworld Networks Live frontend.
- **Operator**: An authenticated Loveworld broadcast administrator who manages channels and feeds.
- **Stream_Status**: The current state of a live stream resource — one of `idle`, `live`, or `error`.
- **Provision_API**: The backend HTTP API that mediates between the Control_Room and the CDN_Service.
- **Webhook**: An HTTP callback sent by the CDN_Service to the Provision_API when a stream lifecycle event occurs.

---

## Requirements

### Requirement 1: Provision Live Ingest Credentials

**User Story:** As an Operator, I want to provision a live ingest endpoint for a church encoder, so that the church can publish its feed to the CDN and appear in the Control Room.

#### Acceptance Criteria

1. WHEN an Operator submits the "Add Church Feed" form with a church name, city, and protocol (one of RTMPS or SRT), THE Provision_API SHALL create a Church_Feed resource on the CDN_Service and return a unique Ingest_Endpoint URL and Stream_Key.
2. WHEN the CDN_Service returns a successful provisioning response, THE Control_Room SHALL display the generated Ingest_Endpoint URL and Stream_Key to the Operator within 2 seconds of form submission.
3. THE Control_Room SHALL display the Stream_Key exactly once after provisioning and SHALL NOT display it again on subsequent page loads or view refreshes.
4. IF the CDN_Service returns an error during provisioning, THEN THE Provision_API SHALL return an error response containing a human-readable message that identifies the failure reason (e.g., "CDN quota exceeded", "invalid protocol"), and THE Control_Room SHALL display that message alongside any Ingest_Endpoint URL or Stream_Key that was returned before the error, without suppressing either.
5. THE Provision_API SHALL support both RTMPS and SRT as the ingest protocol for a Church_Feed.
6. IF the Operator submits the "Add Church Feed" form with a missing church name, city, or protocol, THEN THE Control_Room SHALL display a field-level validation error and SHALL NOT submit the request to the Provision_API.

---

### Requirement 2: Display Real-Time Stream Status

**User Story:** As an Operator, I want to see the live status of each church feed in the Control Room, so that I can monitor which feeds are active and healthy.

#### Acceptance Criteria

1. WHEN a church encoder connects and begins publishing to its Ingest_Endpoint, THE CDN_Service SHALL send a Webhook to the Provision_API.
2. WHEN the Provision_API receives a valid stream-started Webhook, THE Provision_API SHALL update the Church_Feed status to `live` and THE Control_Room SHALL reflect the `live` status within 10 seconds of the Webhook receipt.
3. WHEN a church encoder disconnects or stops publishing, THE CDN_Service SHALL send a Webhook to the Provision_API.
4. WHEN the Provision_API receives a valid stream-stopped Webhook, THE Provision_API SHALL update the Church_Feed status to `idle` and THE Control_Room SHALL reflect the `idle` status within 10 seconds of the Webhook receipt.
5. IF the CDN_Service sends a Webhook with an unrecognised stream identifier, THEN THE Provision_API SHALL log the event and return HTTP 200 without modifying any Church_Feed record.
6. WHEN the Provision_API successfully processes a valid Webhook, THE Provision_API SHALL return HTTP 200.
7. WHILE a Church_Feed is `live`, THE Control_Room SHALL display the Stream_Status, bitrate (in kbps), and latency (in milliseconds) for that feed.
8. WHILE a Church_Feed is `live`, THE Control_Room SHALL refresh the bitrate and latency values at an interval no greater than 15 seconds.

---

### Requirement 3: Deliver HLS Playback to Viewers

**User Story:** As a viewer, I want to watch a live Loveworld channel through the web player, so that I can participate in broadcasts from anywhere.

#### Acceptance Criteria

1. WHEN a Broadcast_Channel is `live`, THE Control_Room SHALL provide an HLS_Manifest URL such that the Video.js player loads the stream and reaches a playing state without the Operator or viewer manually setting the src or type attributes.
2. THE CDN_Service SHALL deliver the HLS_Manifest with a target segment duration no greater than 4 seconds to maintain low viewer latency.
3. IF a viewer's browser does not support native HLS, THEN THE Control_Room SHALL attempt to use the Video.js HLS plugin to play the stream without requiring a browser extension; IF the plugin cannot initialise, THEN THE Control_Room SHALL NOT display an error message to the viewer and the player SHALL remain in its pre-load idle state.
4. WHILE a Broadcast_Channel is `live`, THE Control_Room SHALL display the live viewer count for that channel, updated at an interval no greater than 30 seconds.
5. IF the HLS_Manifest URL returns 3 consecutive failures within a 30-second window, THEN THE Control_Room SHALL display an error state in the player and render a visible retry button that, when activated, attempts to reload the HLS_Manifest URL.

---

### Requirement 4: Manage Broadcast Channels

**User Story:** As an Operator, I want to create and manage named broadcast channels on the CDN, so that each Loveworld channel has its own ingest and playback endpoint.

#### Acceptance Criteria

1. WHEN an Operator submits the "Create Channel" form with a channel name, slug, and playback domain, THE Provision_API SHALL create a Broadcast_Channel resource on the CDN_Service and return the Ingest_Endpoint URL, Stream_Key, and HLS_Manifest URL.
2. WHILE the Control_Room is displaying the Broadcast view, THE Control_Room SHALL list all provisioned Broadcast_Channels with their current Stream_Status (one of `idle`, `live`, or `error`), HLS_Manifest URL, and Ingest_Endpoint URL.
3. WHEN an Operator activates the copy action for an HLS_Manifest URL and the clipboard write succeeds, THE Control_Room SHALL display a "Copied" confirmation message.
4. WHEN an Operator activates the copy action for an HLS_Manifest URL and the clipboard write fails, THE Control_Room SHALL display the HLS_Manifest URL in a visible text field so the Operator can copy it manually.
5. IF a Broadcast_Channel slug already exists on the CDN_Service, THEN THE Provision_API SHALL return an HTTP 409 conflict response and THE Control_Room SHALL display an inline error on the slug field prompting the Operator to choose a different slug.
6. IF the CDN_Service returns an error during channel creation, THEN THE Provision_API SHALL return a descriptive error response and THE Control_Room SHALL display the error message without closing the "Create Channel" form.
7. WHEN an Operator requests deletion of a Broadcast_Channel whose Stream_Status is `idle`, THE Provision_API SHALL delete the Broadcast_Channel on the CDN_Service and THE Control_Room SHALL remove it from the channel list.
8. IF an Operator requests deletion of a Broadcast_Channel whose Stream_Status is `live` or `error`, THEN THE Provision_API SHALL return an HTTP 409 response and THE Control_Room SHALL display an error message stating the channel cannot be deleted while active.

---

### Requirement 5: Configure Push Destinations

**User Story:** As an Operator, I want to add outbound push destinations so that the live program is simultaneously delivered to YouTube, regional CDNs, or partner platforms.

#### Acceptance Criteria

1. WHEN an Operator submits the "Add Destination" form with a destination name, URL, and protocol type (one of RTMP, RTMPS, HLS, or SRT), THE Provision_API SHALL register the Push_Destination against the active Broadcast_Channel on the CDN_Service.
2. IF an Operator submits the "Add Destination" form with a destination URL that is already registered against the same Broadcast_Channel, THEN THE Provision_API SHALL return an HTTP 409 response and THE Control_Room SHALL display an inline error indicating the destination already exists.
3. WHILE the Broadcast_Channel is `live`, WHEN a Push_Destination is registered, THE CDN_Service SHALL begin forwarding the live stream to the Push_Destination within 30 seconds of registration.
4. WHEN an Operator pauses a Push_Destination, THE Provision_API SHALL instruct the CDN_Service to stop forwarding to that destination.
5. WHEN the CDN_Service confirms the forwarding has stopped, THE Control_Room SHALL update the destination status to `paused`.
6. IF the CDN_Service fails to reach a Push_Destination URL for 3 consecutive delivery attempts within 90 seconds, THEN THE Provision_API SHALL update the destination status to `error`.
7. WHEN a Push_Destination status becomes `error`, THE Control_Room SHALL display the error state to the Operator.
8. WHEN the CDN_Service begins forwarding to a Push_Destination, THE Provision_API SHALL update the destination status to `sending`.
9. WHILE the Control_Room is displaying the Broadcast view, THE Control_Room SHALL display the current status (`sending`, `paused`, or `error`) for each Push_Destination and SHALL refresh the status within 5 seconds of any status change.

---

### Requirement 6: Secure Credential Handling

**User Story:** As a platform administrator, I want stream keys and CDN API credentials to be handled securely, so that unauthorised parties cannot hijack a broadcast or access the CDN account.

#### Acceptance Criteria

1. THE Provision_API SHALL store all Stream_Keys encrypted at rest.
2. THE Provision_API SHALL NOT include a Stream_Key in any API response after the initial provisioning response.
3. THE Provision_API SHALL store CDN_Service API credentials exclusively in server-side environment variables and SHALL NOT expose them to the Control_Room frontend.
4. WHEN an Operator submits a key rotation request for a Church_Feed or Broadcast_Channel, THE Provision_API SHALL request a new Stream_Key from the CDN_Service, store it encrypted, and invalidate the previous key within 60 seconds of the rotation request.
5. IF the CDN_Service returns an error during key rotation, THEN THE Provision_API SHALL retain the existing Stream_Key unchanged and SHALL return an error response to the Operator.
6. THE Provision_API SHALL validate the authenticity of every incoming Webhook using the signature or shared secret provided by the CDN_Service before processing its payload.
7. THE Provision_API SHALL require authenticated Operator sessions for all channel provisioning, destination management, and stream key rotation endpoints; IF a request arrives without a valid session, THEN THE Provision_API SHALL return HTTP 401.

---

### Requirement 7: Replace Mock Data with Live CDN Data

**User Story:** As an Operator, I want the Control Room to reflect real CDN data instead of hardcoded mock values, so that the displayed information is accurate and actionable.

#### Acceptance Criteria

1. WHEN the Control_Room loads the Broadcast view, THE Control_Room SHALL fetch current Broadcast_Channel and Church_Feed data from the Provision_API rather than from the static `LW_DATA` object in `js/data.js`.
2. WHEN the Provision_API does not respond within 10 seconds of a request, THE Control_Room SHALL display a connection error banner and SHALL render an empty channel and feed list — mock data SHALL NOT be displayed.
3. WHEN the Provision_API is reachable, THE Control_Room SHALL update the "Live inputs", "CDN viewers", and "Push destinations" metric counters using data returned by the Provision_API.
4. WHEN the Provision_API is unreachable, THE Control_Room SHALL display zeros for all metric counters.
5. WHILE the Control_Room is displaying the Broadcast view, THE Control_Room SHALL poll the Provision_API for updated feed and channel status at an interval no greater than 15 seconds; IF a poll cycle fails, THE Control_Room SHALL retain the last successfully fetched data and SHALL NOT display an additional error for each failed poll.
6. IF the Provision_API returns an HTTP 401 authentication error, THEN THE Control_Room SHALL redirect the Operator to the sign-in flow.
