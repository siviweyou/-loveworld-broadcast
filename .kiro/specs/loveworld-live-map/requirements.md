# Requirements Document

## Introduction

The Loveworld Networks Live Interactive Platform is a real-time, community-driven web and mobile platform that combines a global live map with live streaming, event discovery, and community engagement features. Inspired by the real-time interactivity of Waze's live map and the ministry-focused experience of KingsConference, the platform enables Loveworld Networks' global audience to discover, join, and participate in live broadcasts, prayer sessions, partner conferences, and church events worldwide. Participants can check in, react, and engage in real time, creating a shared sense of global community across Loveworld's multiple channels and programs.

---

## Glossary

- **Platform**: The Loveworld Networks Live Interactive Platform (web and mobile application)
- **Live_Map**: The interactive global map component displaying real-time pins, activity indicators, and event overlays
- **Event**: A scheduled or live Loveworld activity including broadcasts, prayer sessions, partner conferences, communion services, and church gatherings
- **Pin**: A map marker representing a church location, live event, or active participant cluster on the Live_Map
- **Activity_Feed**: The real-time scrolling feed showing global participant actions, check-ins, reactions, and engagement events
- **Participant**: An authenticated user actively engaging with the Platform (watching, praying, checking in, reacting)
- **Viewer**: An unauthenticated or passive user browsing the Platform without active engagement
- **Channel**: A Loveworld Networks broadcast channel (LoveworldSAT, LoveWorld USA, LoveWorld Plus, LoveWorld Arabic, LoveWorld Spanish, LoveWorld Asia, LoveWorld Pacific)
- **Stream**: A live or on-demand video feed from a Channel or Event
- **Check_In**: A Participant action that registers their presence at or participation in an Event, reflected on the Live_Map and Activity_Feed
- **Reaction**: A real-time emoji or sentiment response submitted by a Participant during a live Event or Stream
- **Prayer_Counter**: A real-time numeric indicator showing the number of Participants actively engaged in a prayer session
- **Notification_Service**: The backend service responsible for delivering push, in-app, and email notifications
- **Stream_Service**: The backend service responsible for ingesting, transcoding, and delivering live and on-demand video streams
- **Map_Service**: The backend service responsible for managing geographic data, Pin placement, clustering, and real-time map updates
- **Auth_Service**: The backend service responsible for user authentication, authorization, and session management
- **KingsChat**: Loveworld's existing social platform; the Platform MAY integrate with KingsChat for identity and social graph
- **KingsSuite**: The broader Loveworld digital ecosystem including KingsChat, KingsConference, KingsPay, and related apps

---

## Requirements

### Requirement 1: Global Live Map Display

**User Story:** As a Viewer or Participant, I want to see a real-time interactive global map showing live Loveworld events, active church locations, and participant activity, so that I can understand the global reach and current activity of the Loveworld community.

#### Acceptance Criteria

1. THE Live_Map SHALL render an interactive world map with zoom, pan, and region-selection controls on both web and mobile viewports; all controls SHALL meet WCAG 2.1 AA touch and click target size requirements (minimum 44×44 CSS pixels); the map SHALL be functional on the latest two stable releases of Chrome, Firefox, Safari, and Edge.
2. WHEN the Platform loads, THE Map_Service SHALL fetch and display all active Pins (those whose associated Event or church location has status "live" or "open") within the current map viewport within 3 seconds of the DOMContentLoaded event.
3. WHEN a new Event's status field transitions to "live" in the data store, THE Map_Service SHALL add a corresponding Pin to the Live_Map within 5 seconds.
4. WHEN a Participant performs a Check_In, THE Map_Service SHALL update the Pin count for the associated Event or church location within 2 seconds.
5. WHILE an Event is live, THE Live_Map SHALL display a pulsing CSS keyframe animation (1.5-second cycle) on the Event's Pin to distinguish it from inactive Pins.
6. WHEN the number of Pins within a 50×50 pixel tile at the current zoom level exceeds 10, THE Map_Service SHALL cluster those Pins into a single aggregate Pin displaying the total count.
7. WHEN a Viewer taps or clicks a Pin, THE Platform SHALL display a summary card showing the Event name, Channel, live participant count, and a join or watch action button.
8. THE Live_Map SHALL support a minimum of 10,000 concurrent active Pins without degrading map render performance below 30 frames per second (measured via requestAnimationFrame timing) on the latest two stable releases of Chrome, Firefox, Safari, and Edge.
9. IF the Map_Service fails to load Pin data, THEN THE Platform SHALL display the map with a visible, human-readable error message and a retry button that re-triggers the Map_Service fetch, without crashing or navigating away from the page.

---

### Requirement 2: Live Streaming Integration

**User Story:** As a Participant, I want to watch live Loveworld channel broadcasts and special event streams directly within the Platform, so that I can engage with content without leaving the experience.

#### Acceptance Criteria

1. THE Platform SHALL provide an embedded video player capable of playing live HLS and DASH streams from all seven Loveworld Channels.
2. WHEN a Participant selects a Channel or Event stream, THE Stream_Service SHALL render the first video frame within 4 seconds under a standard broadband connection (≥ 5 Mbps).
3. WHILE a Stream is playing, THE Platform SHALL display the viewer count updated at intervals of no more than 10 seconds.
4. IF a Stream's measured bitrate falls below the minimum threshold for the current quality tier (High: 4 Mbps, Medium: 1.5 Mbps, Low: 500 Kbps), THEN THE Stream_Service SHALL switch to the next lower quality tier within 3 seconds to maintain uninterrupted playback.
5. THE Stream_Service SHALL support simultaneous playback for a minimum of 50,000 concurrent viewers per Channel.
6. WHEN a Participant pauses or closes an on-demand Stream, THE Stream_Service SHALL record the playback position; WHEN the Participant resumes the same on-demand Stream, THE Platform SHALL resume from the recorded position. For live Streams, resuming SHALL join the live broadcast at the current live position.
7. IF a live Stream becomes unavailable, THEN THE Platform SHALL display a status message identifying the Channel name and the reason (e.g., "technical difficulties" or "scheduled maintenance") and offer the Participant a list of currently active Channels to switch to.
8. WHERE a Channel offers multiple language audio tracks, THE Platform SHALL allow the Participant to select their preferred audio language before or during playback.
9. THE Platform SHALL display closed captions for Streams that include caption data; captions SHALL be off by default.
10. THE Platform SHALL provide a control allowing the Participant to toggle closed captions on or off at any time during playback.

---

### Requirement 3: Event Discovery and Participation

**User Story:** As a Participant, I want to discover upcoming and live Loveworld events — including prayer conferences, partner conferences, and communion services — and join them directly from the Platform, so that I can stay connected to the ministry calendar and participate in real time.

#### Acceptance Criteria

1. THE Platform SHALL display a searchable, filterable list of Events including live, upcoming, and recently concluded Events (those that ended within the past 24 hours).
2. WHEN a Participant applies a filter (by Channel, Event type, date range, or geographic region), THE Platform SHALL update the Event list and Live_Map Pins within 1 second.
3. WHEN a Participant who is not yet registered selects an upcoming Event, THE Platform SHALL display the Event details including title, description, scheduled start time in the Participant's local timezone, Channel, and a registration action button.
4. WHEN a Participant who is already registered selects an upcoming Event, THE Platform SHALL display the Event details and offer a reminder toggle and a cancel-registration action instead of a registration button.
5. WHEN a Participant registers for an upcoming Event, THE Notification_Service SHALL send a confirmation notification via the Participant's preferred channel (push, in-app, or email) within 60 seconds of registration.
6. WHEN a registered Event is 15 minutes from its scheduled start time, THE Notification_Service SHALL attempt to send a reminder notification to all registered Participants; IF delivery fails for a Participant, THE Notification_Service SHALL retry once after 2 minutes.
7. WHEN a Participant joins a live Event, THE Platform SHALL perform a Check_In on behalf of the Participant and reflect the updated count on the Live_Map within 2 seconds; IF the Check_In fails, THE Platform SHALL display an error message and allow the Participant to continue watching without blocking access to the Stream.
8. THE Platform SHALL support Event registration for a minimum of 500,000 Participants per Event without degrading registration response time beyond 2 seconds.
9. IF a Participant attempts to join an Event that has already concluded, THEN THE Platform SHALL display a message indicating the Event has ended and offer available on-demand recordings or the next scheduled Event of the same type.
10. WHERE an Event is part of a recurring series (e.g., Global Day of Prayer), THE Platform SHALL display the full series schedule and allow the Participant to subscribe to the entire series with a single action, where subscribing means the Participant receives a reminder notification for each future occurrence in the series.

---

### Requirement 4: Real-Time Community Engagement

**User Story:** As a Participant, I want to check in, react, and see what other Participants worldwide are doing in real time, so that I feel connected to the global Loveworld community during live events and broadcasts.

#### Acceptance Criteria

1. WHEN a Participant performs a Check_In during a live Event, THE Activity_Feed SHALL display the Check_In entry within 3 seconds to all Participants viewing the same Event; the entry SHALL include the Participant's display name, Event name, and — IF the Participant has enabled location sharing — the Participant's country or region.
2. WHILE a live Event or Stream is active, THE Platform SHALL provide a set of at least six Reaction types (Praise, Amen, Prayer, Heart, Fire, Hallelujah) that Participants can submit.
3. WHEN a Participant submits a Reaction, THE Platform SHALL display an animated Reaction indicator visible to all Participants viewing the same Event or Stream within 500 milliseconds.
4. WHILE a live prayer session is active, THE Platform SHALL display a Prayer_Counter showing the total number of Participants currently connected to the active prayer session, updated at intervals of no more than 5 seconds.
5. THE Activity_Feed SHALL display a continuous stream of global engagement events (Check_Ins, Reactions, new joiners) for the current Event in reverse chronological order, with a maximum display latency of 3 seconds from event occurrence; the feed SHALL retain a maximum of 500 items, discarding the oldest entries when the cap is reached.
6. WHEN the Activity_Feed receives more than 100 new entries within a 10-second window, THE Platform SHALL throttle the visible feed update rate to one batch per 3 seconds to maintain readability.
7. THE Platform SHALL display a global real-time counter showing the total number of Participants with an active session connection across all Events and Channels, updated at intervals of no more than 10 seconds.
8. IF a Participant's network connection is interrupted during an active session, THEN THE Platform SHALL attempt to reconnect the real-time data connection up to 5 times with exponential backoff; the connection-lost indicator SHALL be non-blocking (the Participant can still view cached content) and SHALL display the current reconnection attempt status; after 5 failed attempts, THE Platform SHALL display a final connection-lost message.

---

### Requirement 5: Church and Ministry Location Directory

**User Story:** As a Viewer or Participant, I want to find Loveworld-affiliated churches and ministry centers near me or in any region on the map, so that I can connect with a local community or plan to attend in-person events.

#### Acceptance Criteria

1. THE Live_Map SHALL display Pins for all registered Loveworld-affiliated church and ministry locations globally.
2. WHEN a Viewer searches for churches by city, country, or postal code, THE Map_Service SHALL return matching church Pins and center the Live_Map on the first result within 2 seconds; IF no matching locations are found, THE Platform SHALL display a "no results found" message with a suggestion to broaden the search.
3. WHEN a Viewer selects a church Pin, THE Platform SHALL display the church's name, address, contact information, service schedule, a link to the church's profile page, and a link to directions via the device's default maps application.
4. WHEN a church hosts a live Event, THE Map_Service SHALL visually distinguish the church's Pin from standard directory Pins using a live indicator overlay.
5. THE Platform SHALL allow authenticated church administrators to submit updates to their church's profile information; submitted updates SHALL be reviewed and either published or rejected within 5 business days; THE Platform SHALL notify the submitting administrator of the moderation decision via in-app notification.
6. IF a Viewer's device location permission is granted, THEN THE Map_Service SHALL automatically center the Live_Map on the Viewer's current location and highlight the three church Pins nearest by straight-line distance on initial load.
7. THE Platform SHALL support a directory of a minimum of 10,000 church and ministry locations with text search response time ≤ 2 seconds and map render time ≤ 3 seconds for the full dataset.

---

### Requirement 6: Multi-Channel Navigation and Channel Guide

**User Story:** As a Participant, I want to browse all Loveworld channels and see what is currently airing or scheduled, so that I can quickly find and switch to the content I want to watch.

#### Acceptance Criteria

1. THE Platform SHALL display a channel guide that is visible across all Platform views, listing all seven Loveworld Channels with their current program title, thumbnail, and live viewer count formatted as a compact number (e.g., "12.3K").
2. WHEN a Participant selects a Channel from the channel guide, THE Platform SHALL load the Channel's live Stream within 4 seconds.
3. THE Platform SHALL display a program schedule for each Channel showing current and upcoming programs with titles, descriptions, and start times in the Participant's local timezone; IF the local timezone cannot be determined, THE Platform SHALL display times in UTC with a UTC label.
4. WHEN a program on a Channel ends and the next program begins, THE Platform SHALL update the channel guide entry within 30 seconds without requiring a page refresh.
5. WHEN a Participant searches for a program by title or keyword, THE Platform SHALL return matching results from the program schedule within 1 second; IF no results are found, THE Platform SHALL display a "no results found" message.
6. WHILE a live broadcast is active on a Channel, THE Platform SHALL display a "Now on Air" indicator on the Live_Map at the Channel's primary broadcast origin location Pin.
7. IF a Channel's live Stream fails to load within 4 seconds, THEN THE Platform SHALL display an error message identifying the Channel and offer the Participant a list of currently active Channels to switch to.

---

### Requirement 7: User Authentication and Profile

**User Story:** As a Participant, I want to create an account or sign in using my existing KingsChat credentials, so that my activity, check-ins, and preferences are saved and I can engage fully with the Platform.

#### Acceptance Criteria

1. THE Auth_Service SHALL support account creation using email and password; email verification SHALL be required before full Platform access is granted; unverified accounts SHALL be restricted to read-only browsing (no check-ins, event registration, or profile saves).
2. THE Auth_Service SHALL support sign-in via KingsChat OAuth 2.0, allowing Participants to use their existing KingsChat identity without creating a separate account.
3. WHEN a Participant signs in, THE Auth_Service SHALL issue a session token with a maximum lifetime of 30 days; any authenticated API request SHALL renew the token and reset the 30-day expiry clock.
4. WHEN a Participant's session token expires, THE Platform SHALL redirect the Participant to the sign-in screen and preserve the Participant's current URL path and query parameters for restoration after successful authentication.
5. THE Platform SHALL allow Participants to set a display name (2–50 characters), profile photo (JPEG or PNG, maximum 5 MB), country, and preferred language in their profile.
6. THE Platform SHALL allow Participants to independently enable or disable push, in-app, and email notifications for each of the following event types: Session alerts (live event start), Check-in activity, and Announcements.
7. IF a Participant attempts to access a feature requiring authentication while unauthenticated, THEN THE Platform SHALL prompt the Participant to sign in or create an account and SHALL preserve the Participant's current URL path and query parameters for restoration after successful authentication.
8. THE Auth_Service SHALL enforce password requirements of a minimum of 8 characters including at least one uppercase letter, one lowercase letter, and one digit.
9. WHEN a Participant requests a password reset, THE Auth_Service SHALL send a reset link to the Participant's registered email address within 60 seconds; the reset link SHALL be valid for 1 hour and SHALL be invalidated after a single use.

---

### Requirement 8: Push Notifications and Alerts

**User Story:** As a Participant, I want to receive timely notifications about live events, prayer sessions starting, and activity in my region, so that I never miss important Loveworld broadcasts or community moments.

#### Acceptance Criteria

1. THE Notification_Service SHALL deliver push notifications to Participants on web (via Web Push API) and mobile (via FCM/APNs) for Events the Participant has registered for or subscribed to.
2. WHEN a Channel begins a special broadcast (e.g., Global Day of Prayer, Global Communion Service), THE Notification_Service SHALL send a push notification to all Participants who have subscribed to that Channel's alerts within 2 minutes of the broadcast going live.
3. WHEN a new Event is added to the Platform within a Participant's subscribed region or Channel, THE Notification_Service SHALL deliver an in-app notification to the Participant within 5 minutes.
4. THE Notification_Service SHALL respect each Participant's notification preferences and SHALL deliver only notification types the Participant has enabled.
5. IF a Participant has not interacted with the Platform for 30 consecutive days, THEN THE Notification_Service SHALL send a re-engagement notification summarizing upcoming Events, no more than once per 30-day period.
6. THE Platform SHALL provide a notification inbox displaying the Participant's last 90 days of received notifications, with read and unread status indicators.

---

### Requirement 9: Accessibility and Internationalization

**User Story:** As a Participant from any region or background, I want the Platform to be accessible and available in my language, so that I can fully participate regardless of ability or language preference.

#### Acceptance Criteria

1. THE Platform SHALL conform to WCAG 2.1 Level AA accessibility standards across all core user interface components.
2. THE Platform SHALL support a minimum of seven interface languages corresponding to Loveworld's Channel regions: English, French, Spanish, Arabic, Portuguese, Mandarin Chinese, and Tagalog.
3. WHEN a Participant selects a preferred language in their profile, THE Platform SHALL render all interface labels, navigation elements, and system messages in the selected language on the next page load.
4. THE Platform SHALL provide text alternatives for all non-text content including map Pins, icons, and Stream thumbnails.
5. THE Platform SHALL ensure all interactive controls are operable via keyboard navigation and are compatible with screen reader software.
6. WHEN displaying dates and times, THE Platform SHALL render them in the Participant's local timezone as determined by the Participant's device or profile setting.

---

### Requirement 10: Performance and Reliability

**User Story:** As a Participant anywhere in the world, I want the Platform to load quickly and remain available during high-traffic global events, so that I can always access live content and community features without interruption.

#### Acceptance Criteria

1. THE Platform SHALL achieve an initial page load time of under 3 seconds on a standard broadband connection (≥ 5 Mbps) for 95% of requests as measured at the CDN edge.
2. THE Platform SHALL maintain a service availability of 99.9% uptime measured on a rolling 30-day basis, excluding scheduled maintenance windows communicated at least 24 hours in advance.
3. WHEN Platform traffic exceeds 80% of current provisioned capacity, THE Platform's infrastructure SHALL automatically scale to accommodate additional load within 60 seconds.
4. THE Platform SHALL serve static assets (scripts, styles, images) via a globally distributed CDN with edge nodes covering all Loveworld Channel regions.
5. IF a backend service becomes unavailable, THEN THE Platform SHALL degrade gracefully by displaying cached or static content for affected features while maintaining availability of unaffected features.
6. THE Platform SHALL log all errors with sufficient context (timestamp, user session ID, request path, error code) to enable root-cause analysis within 1 hour of an incident.
