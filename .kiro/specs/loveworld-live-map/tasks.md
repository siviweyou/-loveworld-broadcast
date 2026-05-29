# Implementation Plan: Loveworld Networks Live Interactive Platform

## Overview

This plan converts the feature design into incremental coding tasks for a code-generation agent. Each task builds on the previous, wiring components together progressively. The stack is TypeScript/Node.js (Auth, Event, Engagement, Notification, Channel Guide, Profile services), Go (Map Service, Stream Service), React (web frontend), Socket.IO (WebSocket Gateway), PostgreSQL/Redis/TimescaleDB (data stores), and Apache Kafka (message broker).

---

## Tasks

- [ ] 1. Project scaffolding and shared infrastructure
  - [ ] 1.1 Initialize monorepo structure with workspaces
    - Create root `package.json` with workspaces: `services/*`, `frontend`, `shared`
    - Add `turbo.json` (or `nx.json`) pipeline config for build, test, lint tasks
    - Add root `.eslintrc`, `.prettierrc`, `tsconfig.base.json`
    - Create `docker-compose.yml` with PostgreSQL, Redis, TimescaleDB, Kafka, Zookeeper containers
    - _Requirements: 10.1, 10.2_
  - [ ] 1.2 Create shared TypeScript types package (`shared/types`)
    - Define and export all data model interfaces: `User`, `Event`, `Church`, `Channel`, `Program`, `EventRegistration`, `Reaction`, `CheckIn`, `ActivityFeedEntry`, `Notification`, `NotificationPreferences`, `GeoPoint`, `ServiceScheduleEntry`
    - Define shared error response shape `{ error: { code, message, requestId } }`
    - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1_
  - [ ] 1.3 Create shared validation utilities package (`shared/validation`)
    - Implement `validatePassword(s: string): boolean` enforcing ≥8 chars, ≥1 uppercase, ≥1 lowercase, ≥1 digit
    - Implement `validateDisplayName(s: string): boolean` enforcing 2–50 chars
    - Implement `validateBCP47(tag: string): boolean` for language tag validation
    - Implement `validateISO3166(code: string): boolean` for country code validation
    - _Requirements: 7.5, 7.8_
  - [ ]* 1.4 Write property tests for shared validation utilities
    - **Property 21: Password validator accepts valid passwords and rejects invalid ones**
    - **Validates: Requirements 7.8**
    - Use fast-check to generate arbitrary strings and verify `validatePassword` accepts iff all four conditions hold
  - [ ] 1.5 Set up database migration tooling
    - Add `db-migrate` or `node-pg-migrate` to the services workspace
    - Create initial migration: `users`, `events`, `churches`, `channels`, `programs`, `event_registrations`, `reactions`, `check_ins`, `activity_feed`, `notifications` tables with correct indexes and constraints
    - Create TimescaleDB hypertable migration for `viewer_counts` and `reaction_aggregates`
    - _Requirements: 3.8, 10.2_
  - [ ] 1.6 Configure API Gateway (Kong) routing skeleton
    - Write `kong.yml` declarative config with service routes for Auth, Map, Stream, Event, Engagement, Notification, Channel Guide, Profile, and WebSocket Gateway
    - Add JWT validation plugin pointing to Auth Service public key endpoint
    - Add rate-limiting plugin (1000 req/min per IP for unauthenticated, 5000 req/min per user for authenticated)
    - _Requirements: 7.3, 10.2_

- [ ] 2. Auth Service (Node.js/TypeScript)
  - [ ] 2.1 Scaffold Auth Service with Express + TypeScript
    - Initialize `services/auth` with `express`, `pg`, `bcrypt`, `jsonwebtoken`, `nodemailer`, `zod`
    - Generate RS256 key pair; expose public key at `GET /auth/.well-known/jwks.json`
    - Implement structured JSON logger middleware (timestamp, service, requestId, userId, path, errorCode)
    - _Requirements: 7.1, 7.3, 10.6_
  - [ ] 2.2 Implement registration and email verification endpoints
    - `POST /auth/register`: validate email + password (use `validatePassword`), hash with bcrypt (cost 12), insert user with `emailVerified=false`, send verification email via SendGrid/SES within 60 s
    - `POST /auth/verify-email`: validate token, set `emailVerified=true`
    - Unverified accounts receive a JWT with `verified: false` claim; API Gateway rejects write-action routes for unverified tokens
    - _Requirements: 7.1, 7.8_
  - [ ]* 2.3 Write property test for unverified account write rejection
    - **Property 17: Unverified accounts are rejected for all write actions**
    - **Validates: Requirements 7.1**
    - Use fast-check to generate arbitrary write-action requests with `emailVerified=false` tokens and assert 403 response
  - [ ] 2.4 Implement login and JWT issuance
    - `POST /auth/login`: verify email + password, issue RS256 JWT with 30-day expiry, `userId`, `email`, `verified` claims
    - Middleware: on every authenticated request, reissue token with fresh 30-day expiry and return in `X-Refreshed-Token` header
    - _Requirements: 7.3_
  - [ ]* 2.5 Write property test for session token expiry reset
    - **Property 18: Session token expiry resets on every authenticated request**
    - **Validates: Requirements 7.3**
    - Use fast-check to generate tokens with arbitrary remaining lifetimes (1 s – 30 days) and assert new expiry = now + 30 days ≥ old expiry
  - [ ] 2.6 Implement KingsChat OAuth 2.0 PKCE flow
    - `GET /auth/oauth/kingschat`: generate PKCE code verifier/challenge, redirect to KingsChat authorization endpoint
    - `GET /auth/oauth/kingschat/callback`: exchange code for tokens, upsert user with `kingsChatId`, issue platform JWT
    - Store `redirect_after_auth` URL in session cookie for post-auth restoration
    - _Requirements: 7.2, 7.4, 7.7_
  - [ ]* 2.7 Write property test for post-authentication URL restoration
    - **Property 19: Post-authentication URL restoration is lossless**
    - **Validates: Requirements 7.4, 7.7**
    - Use fast-check to generate arbitrary URL paths + query strings and assert round-trip preservation after auth redirect
  - [ ] 2.8 Implement password reset flow
    - `POST /auth/password-reset/request`: generate signed reset token (1-hour expiry), send email within 60 s, store token hash in DB
    - `POST /auth/password-reset/confirm`: validate token not expired and not used, update password hash, mark token as used
    - _Requirements: 7.9_
  - [ ]* 2.9 Write property test for password reset link single-use and time-bounded behavior
    - **Property 22: Password reset link is single-use and time-bounded**
    - **Validates: Requirements 7.9**
    - Use fast-check to generate reset tokens at arbitrary times and assert: first use within 1 h succeeds and invalidates; second use rejected; use after 1 h rejected
  - [ ] 2.10 Auth Service checkpoint
    - Ensure all Auth Service unit and property tests pass; verify JWT public key endpoint is reachable by Kong

- [ ] 3. Map Service (Go)
  - [ ] 3.1 Scaffold Map Service with Go + Gin
    - Initialize `services/map` Go module with `gin`, `pgx/v5`, `go-redis/v9`, `gopter` (PBT)
    - Implement structured JSON logger middleware with all required fields (timestamp, service, requestId, userId, path, errorCode)
    - Connect to PostgreSQL with PostGIS extension; create `churches` and `map_pins` tables with `GEOGRAPHY(POINT)` columns and GIST indexes
    - _Requirements: 5.7, 10.6_
  - [ ] 3.2 Implement geo-clustering algorithm
    - Port or integrate Supercluster grid-based clustering logic in Go
    - `ClusterPins(pins []Pin, zoom int, tileSize int) []ClusteredPin`: for any tile with >10 pins → 1 cluster with count=N; ≤10 pins → N individual pins
    - Implement viewport bounding box query: `GET /map/pins?bbox={w,s,e,n}&zoom={z}` using PostGIS `ST_MakeEnvelope` + `ST_Within`
    - _Requirements: 1.2, 1.6, 1.8_
  - [ ]* 3.3 Write property test for pin clustering
    - **Property 2: Pin clustering reduces tile density**
    - **Validates: Requirements 1.6**
    - Use gopter to generate arbitrary sets of N pin positions within a tile; assert N>10 → 1 cluster with count=N; N≤10 → N individual pins
  - [ ] 3.4 Implement church directory CRUD and text+geo search
    - `GET /map/churches?q={query}&lat={}&lng={}&radius={}`: full-text search via PostgreSQL `tsvector` + `ST_DWithin` geo filter; return results within 2 s for 10K records
    - `GET /map/churches/{id}`: return full church record
    - `POST /map/churches/{id}/update-request`: store pending update, notify admin queue
    - _Requirements: 5.1, 5.2, 5.3, 5.5, 5.7_
  - [ ] 3.5 Implement nearest-three church selection
    - `GET /map/churches/nearest?lat={}&lng={}`: Haversine distance sort, return top 3 (or all if <3 exist), ordered by ascending distance
    - _Requirements: 5.6_
  - [ ]* 3.6 Write property test for nearest-three church selection
    - **Property 13: Nearest-three church selection is distance-correct**
    - **Validates: Requirements 5.6**
    - Use gopter to generate arbitrary user locations and church datasets; assert result is exactly the 3 nearest by Haversine distance, ordered ascending
  - [ ] 3.7 Implement real-time pin update subscription
    - Subscribe to `map:pin:updates` Redis Stream via `XREAD BLOCK`
    - On new entry, publish `pin:update` delta to WebSocket Gateway via Redis pub/sub channel `ws:broadcast:global`
    - _Requirements: 1.3, 1.4_
  - [ ]* 3.8 Write property test for live pin indicator
    - **Property 1: Live status pins display a live indicator**
    - **Validates: Requirements 1.5, 5.4**
    - Use fast-check (via WASM test runner or separate TS test) to generate pin records with arbitrary status values; assert `status="live"` → live indicator present; other statuses → no indicator
  - [ ] 3.9 Map Service checkpoint
    - Ensure all Map Service tests pass; verify viewport query returns results within 3 s for 10K pins dataset

- [ ] 4. Stream Service (Go)
  - [ ] 4.1 Scaffold Stream Service with Go + Gin
    - Initialize `services/stream` Go module with `gin`, `pgx/v5`, `go-redis/v9`, `gobreaker`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL (`streams`, `playback_positions` tables) and Redis (viewer count keys)
    - _Requirements: 2.1, 10.6_
  - [ ] 4.2 Implement channel listing and manifest proxying
    - `GET /streams/channels`: return all channels with status and viewer count (read from Redis cache, fallback to DB)
    - `GET /streams/channels/{id}/manifest`: proxy HLS/DASH manifest URL, inject auth token as query param, set appropriate cache headers
    - Wrap upstream manifest fetch in `gobreaker` circuit breaker (open after 5 failures, half-open after 30 s)
    - _Requirements: 2.1, 2.2, 6.1, 6.2_
  - [ ] 4.3 Implement viewer count tracking
    - On WebSocket `join:event` / `leave:event` events (consumed from Redis pub/sub): `INCR`/`DECR` `viewer:count:{channelId}` in Redis
    - Background goroutine: every 10 s, read all viewer count keys and write to TimescaleDB `viewer_counts` hypertable
    - `GET /streams/channels` response includes `viewerCount` from Redis
    - _Requirements: 2.3, 2.5_
  - [ ] 4.4 Implement playback position persistence
    - `POST /streams/playback/position`: upsert `(userId, streamId, positionSeconds)` in PostgreSQL; for live streams, ignore and return current live edge
    - `GET /streams/playback/position/{streamId}`: return saved position for authenticated user; return live edge for live streams
    - _Requirements: 2.6_
  - [ ]* 4.5 Write property test for playback position round-trip
    - **Property 6: Playback position round-trip preserves value**
    - **Validates: Requirements 2.6**
    - Use gopter to generate arbitrary (streamId, positionSeconds) pairs; assert save→retrieve returns identical value for VOD; assert live streams always return live edge
  - [ ] 4.6 Implement ABR quality tier selection function
    - Pure function `SelectQualityTier(bitrateMbps float64, currentTier QualityTier) QualityTier`
    - Thresholds: ≥4 Mbps → High; 1.5–4 Mbps → Medium; 0.5–1.5 Mbps → Low
    - No tier switch when current tier's minimum threshold is satisfied
    - _Requirements: 2.4_
  - [ ]* 4.7 Write property test for ABR quality tier selection
    - **Property 5: ABR quality tier selection is monotonically correct**
    - **Validates: Requirements 2.4**
    - Use gopter to generate arbitrary bitrate values and current tiers; assert returned tier is always the highest tier whose threshold ≤ measured bitrate; assert no unnecessary switches
  - [ ] 4.8 Stream Service checkpoint
    - Ensure all Stream Service tests pass; verify manifest proxy returns first frame within 4 s under test conditions

- [ ] 5. Event Service (Node.js/TypeScript)
  - [ ] 5.1 Scaffold Event Service with Express + TypeScript
    - Initialize `services/event` with `express`, `pg`, `zod`, `kafkajs`, `opossum`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL via PgBouncer connection pool; create `events`, `event_series`, `event_registrations` tables
    - _Requirements: 3.1, 10.6_
  - [ ] 5.2 Implement event CRUD and filter/search endpoints
    - `GET /events?status=&channel=&type=&region=&from=&to=`: parameterized query with all filter combinations; return results within 1 s
    - `GET /events/{id}`: return full event record
    - Publish `event.created` to Kafka on new event creation
    - _Requirements: 3.1, 3.2_
  - [ ] 5.3 Implement event registration endpoints
    - `POST /events/{id}/register`: upsert on `(userId, eventId)` (idempotent); increment `registrationCount` counter; publish `event.registered` to Kafka
    - `DELETE /events/{id}/register`: set status to `cancelled`; publish cancellation event to Kafka
    - Enforce 500K concurrent registration throughput via PgBouncer + connection pooling
    - _Requirements: 3.3, 3.4, 3.8_
  - [ ] 5.4 Implement series management endpoints
    - `GET /events/series/{seriesId}`: return series with all occurrences
    - `POST /events/series/{seriesId}/subscribe`: register user for all future occurrences; publish `series.subscribed` to Kafka
    - _Requirements: 3.10_
  - [ ] 5.5 Implement concluded event handling
    - On `GET /events/{id}` for concluded events: include `onDemandRecordingUrl` if available and `nextScheduledEvent` of same type
    - _Requirements: 3.9_
  - [ ] 5.6 Event Service checkpoint
    - Ensure all Event Service tests pass; verify registration endpoint handles concurrent load in integration test

- [ ] 6. Engagement Service (Node.js/TypeScript)
  - [ ] 6.1 Scaffold Engagement Service with Express + TypeScript
    - Initialize `services/engagement` with `express`, `pg`, `ioredis`, `kafkajs`, `opossum`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL (`check_ins`, `reactions` tables) and Redis (Streams, counters)
    - _Requirements: 4.1, 10.6_
  - [ ] 6.2 Implement check-in endpoint
    - `POST /engagement/checkin`: validate auth + event exists; insert `CheckIn` record; `XADD engagement:events:{eventId}` to Redis Stream; publish `checkin.created` to Kafka
    - Include `country`/`region` only if `locationSharingEnabled=true` on user profile
    - _Requirements: 3.7, 4.1_
  - [ ] 6.3 Implement reaction endpoint
    - `POST /engagement/reaction`: validate reaction type is one of 6 valid types; insert `Reaction` record; `XADD engagement:events:{eventId}` to Redis Stream
    - _Requirements: 4.2, 4.3_
  - [ ] 6.4 Implement activity feed with cursor pagination
    - `GET /engagement/feed/{eventId}?cursor={}`: cursor-based pagination over `activity_feed` table; return entries in reverse-chronological order; enforce 500-item cap (delete oldest on insert when count=500)
    - _Requirements: 4.5_
  - [ ]* 6.5 Write property test for activity feed ordering and size cap
    - **Property 10: Activity feed maintains reverse-chronological order and size cap**
    - **Validates: Requirements 4.5**
    - Use fast-check to generate arbitrary sequences of feed entries; assert always reverse-chronological; assert cap at 500 with oldest evicted
  - [ ] 6.6 Implement feed throttle logic
    - Sliding window counter per event room in Redis: `INCR feed:window:{eventId}` with 10-s TTL
    - When counter >100 in window: switch WebSocket Gateway emission to batched mode (one `feed:batch` per 3 s)
    - _Requirements: 4.6_
  - [ ]* 6.7 Write property test for feed throttle
    - **Property 11: Feed throttle limits visible update rate under burst conditions**
    - **Validates: Requirements 4.6**
    - Use fast-check to generate burst sequences >100 events in 10 s; assert emitted batches ≤ ⌊10/3⌋+1 = 4 per 10-s window
  - [ ] 6.8 Implement prayer counter
    - `GET /engagement/prayer-counter/{sessionId}`: return current count from Redis sorted set `prayer:session:{sessionId}`
    - `GET /engagement/global-count`: return global participant count from Redis key `global:participant:count`
    - Background job: every 5 s, read sorted set cardinality and `XADD prayer:count:{sessionId}` to Redis Stream
    - _Requirements: 4.4, 4.7_
  - [ ] 6.9 Engagement Service checkpoint
    - Ensure all Engagement Service tests pass; verify check-in and reaction endpoints respond within 500 ms

- [ ] 7. Notification Service (Node.js/TypeScript)
  - [ ] 7.1 Scaffold Notification Service with Express + TypeScript
    - Initialize `services/notification` with `express`, `pg`, `kafkajs`, `web-push`, `firebase-admin`, `@sendgrid/mail`, `opossum`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL (`notifications` table); configure Kafka consumer group for `event.registered`, `event.starting`, `event.created`, `stream.live`, `user.inactive` topics
    - _Requirements: 8.1, 10.6_
  - [ ] 7.2 Implement notification preference filtering
    - `filterNotification(userId, notificationType, channel): boolean`: read user's `NotificationPreferences` from DB/cache; return true only if that type+channel combination is enabled
    - Apply filter before every delivery attempt
    - _Requirements: 8.4_
  - [ ]* 7.3 Write property test for notification preference filtering
    - **Property 23: Notification delivery respects participant preferences**
    - **Validates: Requirements 8.4**
    - Use fast-check to generate arbitrary preference objects and notification types; assert disabled types are never delivered; enabled types always proceed
  - [ ] 7.4 Implement push notification delivery (Web Push + FCM/APNs)
    - Web Push: use `web-push` library with VAPID keys; store push subscriptions in DB
    - Mobile: use `firebase-admin` SDK for FCM; APNs via FCM gateway
    - On delivery failure: schedule exactly one retry after 2 minutes using a delayed Kafka message or DB-backed job queue
    - _Requirements: 8.1, 8.2, 3.5, 3.6_
  - [ ]* 7.5 Write property test for notification retry scheduling
    - **Property 8: Notification retry is scheduled exactly once on failure**
    - **Validates: Requirements 3.6**
    - Use fast-check to generate delivery failure scenarios; assert exactly one retry scheduled after 2 min; assert no retry on success; assert no second retry after first retry
  - [ ] 7.6 Implement Kafka consumer handlers
    - `event.registered` → send confirmation notification within 60 s
    - `event.starting` (15-min pre-start) → send reminder to all registered participants
    - `stream.live` → send push to channel subscribers within 2 min
    - `event.created` → send in-app notification to region/channel subscribers within 5 min
    - `user.inactive` (30-day inactivity) → send re-engagement notification (max once per 30 days)
    - _Requirements: 3.5, 3.6, 8.2, 8.3, 8.5_
  - [ ]* 7.7 Write property test for re-engagement notification idempotency
    - **Property 24: Re-engagement notifications are idempotent within 30-day windows**
    - **Validates: Requirements 8.5**
    - Use fast-check to generate participants with arbitrary last-notification timestamps; assert no second re-engagement notification within 30-day window
  - [ ] 7.8 Implement notification inbox endpoint
    - `GET /notifications?cursor={}`: return last 90 days of notifications for authenticated user, cursor-paginated, with `readAt` status
    - `PUT /notifications/{id}/read`: mark notification as read
    - _Requirements: 8.6_
  - [ ] 7.9 Notification Service checkpoint
    - Ensure all Notification Service tests pass; verify confirmation notification delivered within 60 s in integration test

- [ ] 8. Channel Guide Service (Node.js/TypeScript)
  - [ ] 8.1 Scaffold Channel Guide Service with Express + TypeScript
    - Initialize `services/channel-guide` with `express`, `pg`, `kafkajs`, `opossum`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL (`channels`, `programs` tables); configure Kafka consumer for `channel.program.changed`
    - _Requirements: 6.1, 10.6_
  - [ ] 8.2 Implement channel and schedule endpoints
    - `GET /channels`: return all 7 channels with current program, thumbnail, viewer count (formatted as compact number e.g. "12.3K")
    - `GET /channels/{id}/schedule?tz={timezone}`: return current + upcoming programs with times converted to requested timezone; fallback to UTC with "UTC" label if timezone invalid
    - _Requirements: 6.1, 6.3_
  - [ ]* 8.3 Write property test for program schedule timezone conversion
    - **Property 15: Program schedule timezone conversion is correct**
    - **Validates: Requirements 6.3, 9.6**
    - Use fast-check to generate arbitrary UTC timestamps and IANA timezone identifiers; assert correct local time conversion; assert UTC fallback when timezone unknown; assert bijectivity (no two distinct UTC times map to same local string)
  - [ ] 8.4 Implement program search endpoint
    - `GET /channels/search?q={query}`: full-text search over `programs.title` and `programs.description` using PostgreSQL `tsvector`; return results within 1 s; return "no results" shape when empty
    - _Requirements: 6.5_
  - [ ] 8.5 Implement Kafka consumer for program transitions
    - Consume `channel.program.changed` topic; update `channels.currentProgramId` in DB and Redis cache
    - Publish `program:changed` event to Redis pub/sub for WebSocket Gateway fan-out within 30 s
    - _Requirements: 6.4_
  - [ ] 8.6 Channel Guide Service checkpoint
    - Ensure all Channel Guide Service tests pass; verify schedule endpoint returns correct timezone-converted times

- [ ] 9. Profile Service (Node.js/TypeScript)
  - [ ] 9.1 Scaffold Profile Service with Express + TypeScript
    - Initialize `services/profile` with `express`, `pg`, `multer`, `sharp`, `aws-sdk` (S3), `opossum`
    - Implement structured JSON logger middleware
    - Connect to PostgreSQL (`users` table for profile fields)
    - _Requirements: 7.5, 7.6, 10.6_
  - [ ] 9.2 Implement profile read and update endpoints
    - `GET /profile`: return authenticated user's profile fields
    - `PUT /profile`: validate and update `displayName` (2–50 chars), `country` (ISO 3166-1), `preferredLanguage` (BCP 47), `locationSharingEnabled`; use shared validation utilities from task 1.3
    - `PUT /profile/notification-preferences`: update `NotificationPreferences` object; validate all boolean fields present
    - _Requirements: 7.5, 7.6_
  - [ ]* 9.3 Write property test for profile data round-trip
    - **Property 20: Profile data round-trip preserves all fields**
    - **Validates: Requirements 7.5, 7.6**
    - Use fast-check to generate valid profile update payloads (valid display names, country codes, language tags, preference booleans); assert save→retrieve returns identical values for all fields
  - [ ] 9.4 Implement profile photo upload endpoint
    - `POST /profile/photo`: accept multipart upload; validate MIME type (JPEG/PNG only) and size (≤5 MB); resize to 256×256 with `sharp`; upload to S3; update `profilePhotoUrl` in DB
    - _Requirements: 7.5_
  - [ ] 9.5 Profile Service checkpoint
    - Ensure all Profile Service tests pass; verify photo upload rejects files >5 MB and non-image MIME types

- [ ] 10. WebSocket Gateway (Socket.IO Cluster)
  - [ ] 10.1 Scaffold WebSocket Gateway with Socket.IO + Redis adapter
    - Initialize `services/websocket-gateway` with `socket.io`, `@socket.io/redis-adapter`, `ioredis`, `axios`
    - Configure Socket.IO cluster with Redis Streams adapter for cross-node pub/sub
    - Implement JWT authentication middleware: validate `Authorization` header or `auth.token` handshake param using Auth Service public key
    - _Requirements: 4.8, 10.2_
  - [ ] 10.2 Implement room management and join/leave events
    - Handle `join:event {eventId}`: add socket to room `event:{eventId}`; increment viewer count in Redis; subscribe to `engagement:events:{eventId}` Redis Stream
    - Handle `leave:event {eventId}`: remove from room; decrement viewer count
    - Handle `join:channel {channelId}`: add to room `channel:{channelId}`
    - Auto-join `global` room on connect; `INCR global:participant:count`; `DECR` on disconnect
    - _Requirements: 4.7, 2.3_
  - [ ] 10.3 Implement server→client event fan-out
    - Redis Stream consumer: read `engagement:events:{eventId}`, emit `reaction:new`, `checkin:new`, `feed:batch` to room `event:{eventId}`
    - Redis Stream consumer: read `map:pin:updates`, emit `pin:update` to room `global`
    - Redis Stream consumer: read `prayer:count:{sessionId}`, emit `prayer:count` to subscribed rooms
    - Redis pub/sub: on `program:changed`, emit `program:changed` to room `channel:{channelId}`
    - Every 10 s: emit `viewer:count` to each `channel:{channelId}` room; every 10 s: emit `global:count` to `global` room
    - _Requirements: 1.3, 1.4, 4.1, 4.3, 4.4, 4.7, 6.4_
  - [ ] 10.4 Implement client→server reaction and check-in forwarding
    - Handle `reaction:submit {eventId, type}`: validate type is one of 6 valid reaction types; forward to Engagement Service `POST /engagement/reaction` via HTTP; on failure, return error to client only (do not block)
    - Handle `checkin:submit {eventId}`: forward to Engagement Service `POST /engagement/checkin`; on failure, emit error event to client but keep socket connected
    - _Requirements: 4.2, 4.3, 3.7_
  - [ ] 10.5 Implement reconnection config and connection-lost banner trigger
    - Configure Socket.IO client options: `reconnectionAttempts: 5`, delays 1s/2s/4s/8s/16s, `randomizationFactor: 0.5`
    - After 5 failed attempts, emit local `connection:failed` event for UI to display persistent error banner
    - _Requirements: 4.8_
  - [ ]* 10.6 Write property test for reconnection exponential backoff
    - **Property 12: Reconnection follows exponential backoff and terminates after 5 attempts**
    - **Validates: Requirements 4.8**
    - Use fast-check to simulate arbitrary sequences of connection failures; assert delays follow 1s/2s/4s/8s/16s sequence; assert exactly 5 attempts then stop; assert no 6th attempt
  - [ ] 10.7 WebSocket Gateway checkpoint
    - Ensure all WebSocket Gateway tests pass; verify fan-out latency <500 ms for reaction events in integration test

- [ ] 11. Frontend: i18n setup
  - [ ] 11.1 Configure i18next with all 7 language locales
    - Install `i18next`, `react-i18next`, `i18next-browser-languagedetector`
    - Create `src/i18n/i18n.ts` with language detection (profile preference → browser → fallback to `en`)
    - Create locale JSON files for `en`, `fr`, `es`, `ar`, `pt`, `zh`, `tl` under `src/i18n/locales/`
    - Populate all 7 locale files with complete key coverage for all UI strings (map, player, events, engagement, channels, auth, notifications, profile, errors)
    - _Requirements: 9.2, 9.3_
  - [ ]* 11.2 Write property test for i18n string coverage
    - **Property 25: All supported languages have complete UI string coverage**
    - **Validates: Requirements 9.2, 9.3**
    - Use fast-check to enumerate all keys in the `en` base locale and all 6 other locales; assert every key resolves to a non-empty, non-null string that is not the key name itself

- [ ] 12. Frontend: Auth UI
  - [ ] 12.1 Implement SignInForm and SignUpForm components
    - `SignInForm.tsx`: email + password fields, submit calls `POST /auth/login`, stores JWT in `httpOnly` cookie via BFF or `localStorage` with XSS mitigations
    - `SignUpForm.tsx`: email + password + display name fields, client-side `validatePassword` + `validateDisplayName` before submit, calls `POST /auth/register`
    - Both forms: ARIA labels, error messages linked via `aria-describedby`, keyboard-navigable, WCAG 2.1 AA touch targets
    - _Requirements: 7.1, 7.8, 9.1, 9.5_
  - [ ] 12.2 Implement KingsChatOAuthButton component
    - `KingsChatOAuthButton.tsx`: renders accessible button, on click redirects to `GET /auth/oauth/kingschat` with current URL stored for post-auth restoration
    - _Requirements: 7.2, 7.4_
  - [ ] 12.3 Implement useAuth hook
    - `useAuth.ts`: manages auth state (user, token, loading, error); handles token refresh via `X-Refreshed-Token` response header; exposes `signIn`, `signOut`, `signUp` actions
    - On token expiry: redirect to sign-in preserving current URL path + query params
    - _Requirements: 7.3, 7.4, 7.7_

- [ ] 13. Frontend: Live Map component
  - [ ] 13.1 Implement LiveMap component with MapLibre GL JS
    - `LiveMap.tsx`: initialize MapLibre GL JS map with zoom/pan/region-selection controls; all controls meet WCAG 2.1 AA 44×44 px touch targets
    - Load map tiles from configured provider (Mapbox or OpenFreeMap)
    - On mount: fetch `GET /map/pins?bbox=&zoom=` for current viewport; render pins as GeoJSON source + symbol layer
    - On viewport change (debounced 300 ms): re-fetch pins for new bbox
    - _Requirements: 1.1, 1.2, 1.8_
  - [ ] 13.2 Implement PinCluster and LivePinPulse components
    - `PinCluster.tsx`: render cluster markers with count badge; on click, zoom to cluster bounds
    - `LivePinPulse.tsx`: CSS keyframe animation overlay (1.5-s cycle) applied to pins with `status="live"`; no animation for non-live pins
    - _Requirements: 1.5, 1.6_
  - [ ]* 13.3 Write property test for live pin indicator rendering
    - **Property 1: Live status pins display a live indicator**
    - **Validates: Requirements 1.5, 5.4**
    - Use fast-check to generate pin data with arbitrary status values; render with React Testing Library; assert `status="live"` → pulsing animation class present; other statuses → absent
  - [ ] 13.4 Implement PinCard component
    - `PinCard.tsx`: renders on pin tap/click; displays event name, channel identifier, live participant count, join/watch action button; all four fields required (assert non-empty in render)
    - Accessible: focus-trapped modal/popover, `role="dialog"`, `aria-label`, keyboard-dismissible
    - _Requirements: 1.7, 9.1, 9.5_
  - [ ]* 13.5 Write property test for pin card completeness
    - **Property 3: Pin tap/click renders complete summary card**
    - **Validates: Requirements 1.7**
    - Use fast-check to generate arbitrary event pin data; render PinCard; assert all four required fields (name, channel, participant count, action button) are present and non-empty
  - [ ] 13.6 Implement useMapPins hook with WebSocket integration
    - `useMapPins.ts`: manages pin state; subscribes to `pin:update` WebSocket events; applies delta updates to local pin state within 5 s of event status change
    - _Requirements: 1.3, 1.4_
  - [ ] 13.7 Implement map error state and retry
    - `ErrorBoundary.tsx` wrapping `LiveMap`: on Map Service failure, render human-readable error message + retry button; retry re-triggers `GET /map/pins`; no crash or navigation
    - _Requirements: 1.9_
  - [ ]* 13.8 Write property test for map error state
    - **Property 4: Map error state is non-crashing and recoverable**
    - **Validates: Requirements 1.9**
    - Use fast-check to simulate arbitrary Map Service failure responses (network error, 5xx, timeout); assert error state renders with message + retry button; assert no unhandled exception thrown
  - [ ] 13.9 Implement church directory search on map
    - Search input in map UI calls `GET /map/churches?q=&lat=&lng=`; centers map on first result; renders church pins; shows "no results" message when empty
    - On church pin click: render church detail card (name, address, contact, service schedule, profile link, directions link)
    - _Requirements: 5.2, 5.3_
  - [ ]* 13.10 Write property test for church pin card completeness
    - **Property 14: Church pin card renders all required fields**
    - **Validates: Requirements 5.3**
    - Use fast-check to generate arbitrary church records with complete profile data; render church detail card; assert all 6 required fields present
  - [ ] 13.11 Implement "Now on Air" indicator on channel origin pins
    - For channel pins with `status="live"`: render "Now on Air" overlay; for `"offline"` or `"maintenance"`: no indicator
    - _Requirements: 6.6_
  - [ ]* 13.12 Write property test for Now on Air indicator
    - **Property 16: Now on Air indicator appears on live channel origin pins**
    - **Validates: Requirements 6.6**
    - Use fast-check to generate channel records with arbitrary status values; render channel pin; assert `status="live"` → indicator present; other statuses → absent
  - [ ] 13.13 Map component checkpoint
    - Ensure all map component tests pass; verify 10K pins render at ≥30 fps in performance test

- [ ] 14. Frontend: Video Player component
  - [ ] 14.1 Implement VideoPlayer component with Video.js + HLS/DASH
    - `VideoPlayer.tsx`: initialize Video.js with `@videojs/http-streaming` (VHS) plugin; accept `src` (HLS/DASH manifest URL) and `type` props
    - Call `GET /streams/channels/{id}/manifest` to get proxied manifest URL before initializing player
    - _Requirements: 2.1, 2.2_
  - [ ] 14.2 Implement PlayerControls, QualitySelector, AudioTrackSelector
    - `PlayerControls.tsx`: accessible play/pause/volume/fullscreen controls; all controls keyboard-navigable with visible focus indicators; ARIA labels on all buttons
    - `QualitySelector.tsx`: expose ABR quality override (High/Medium/Low/Auto); call `SelectQualityTier` logic on bitrate measurement
    - `AudioTrackSelector.tsx`: list available audio language tracks from manifest; allow selection before or during playback
    - _Requirements: 2.4, 2.8, 9.1, 9.5_
  - [ ] 14.3 Implement closed captions toggle
    - Captions off by default; `PlayerControls` includes caption toggle button; enable/disable VTT/WebVTT track in Video.js
    - _Requirements: 2.9, 2.10_
  - [ ] 14.4 Implement playback position persistence
    - On pause/close of VOD stream: call `POST /streams/playback/position` with current `currentTime`
    - On resume: call `GET /streams/playback/position/{streamId}`; seek to returned position; for live streams, seek to live edge
    - _Requirements: 2.6_
  - [ ] 14.5 Implement stream unavailability error state
    - On stream load failure (timeout >4 s or error): display status message with channel name + reason; render list of currently active channels from `GET /streams/channels`
    - _Requirements: 2.7, 6.7_
  - [ ] 14.6 Video Player component checkpoint
    - Ensure all player component tests pass; verify first frame renders within 4 s in integration test

- [ ] 15. Frontend: Event Discovery UI
  - [ ] 15.1 Implement EventList and EventCard components
    - `EventList.tsx`: searchable + filterable list (by channel, type, date range, region); on filter change, call `GET /events?...` and update list + map pins within 1 s
    - `EventCard.tsx`: display event title, type, status badge, scheduled time in local timezone, channel name, participant count
    - _Requirements: 3.1, 3.2_
  - [ ] 15.2 Implement EventDetail component with registration flow
    - `EventDetail.tsx`: display full event details with scheduled start in local timezone
    - If user NOT registered: show registration button → call `POST /events/{id}/register`
    - If user IS registered: show reminder toggle + cancel-registration button → call `DELETE /events/{id}/register`
    - These two states are mutually exclusive; never show both simultaneously
    - _Requirements: 3.3, 3.4_
  - [ ]* 15.3 Write property test for event registration UI state
    - **Property 7: Event registration UI reflects registration state correctly**
    - **Validates: Requirements 3.3, 3.4**
    - Use fast-check to generate arbitrary (event, user, registrationStatus) combinations; render EventDetail; assert registered → reminder+cancel shown, not register button; unregistered → register button shown, not reminder+cancel; states mutually exclusive
  - [ ] 15.4 Implement SeriesSchedule component
    - `SeriesSchedule.tsx`: display full series schedule; "Subscribe to series" button calls `POST /events/series/{seriesId}/subscribe`
    - _Requirements: 3.10_
  - [ ] 15.5 Implement concluded event handling in EventDetail
    - When event status is `"concluded"`: display "Event has ended" message; show on-demand recording link if available; show next scheduled event of same type
    - _Requirements: 3.9_

- [ ] 16. Frontend: Community Engagement UI
  - [ ] 16.1 Implement ReactionBar component
    - `ReactionBar.tsx`: 6 reaction buttons (Praise, Amen, Prayer, Heart, Fire, Hallelujah); on click, emit `reaction:submit` via WebSocket; display animated reaction indicator within 500 ms
    - Each button: accessible label, keyboard-activatable, WCAG 2.1 AA touch target
    - _Requirements: 4.2, 4.3, 9.1_
  - [ ] 16.2 Implement ActivityFeed component
    - `ActivityFeed.tsx`: virtualized scrolling list (react-window or react-virtual) for performance; display entries in reverse-chronological order; max 500 items (evict oldest)
    - Subscribe to `reaction:new`, `checkin:new`, `feed:batch` WebSocket events via `useActivityFeed` hook
    - Show "Live updates paused" indicator when Engagement Service is unavailable
    - _Requirements: 4.1, 4.5, 4.6_
  - [ ] 16.3 Implement useActivityFeed hook with throttling
    - `useActivityFeed.ts`: manage feed state; apply throttle: when >100 entries in 10-s window, batch updates to one render per 3 s
    - _Requirements: 4.6_
  - [ ] 16.4 Implement CheckInButton component
    - `CheckInButton.tsx`: on click, emit `checkin:submit` via WebSocket; on failure, display error message but keep video player accessible
    - _Requirements: 3.7, 4.1_
  - [ ] 16.5 Implement PrayerCounter component
    - `PrayerCounter.tsx`: display real-time prayer session count; subscribe to `prayer:count` WebSocket events; update at ≤5-s intervals
    - _Requirements: 4.4_
  - [ ] 16.6 Implement global participant counter
    - Display global count in persistent header/footer; subscribe to `global:count` WebSocket events; update at ≤10-s intervals
    - _Requirements: 4.7_
  - [ ] 16.7 Implement OfflineBanner and reconnection status
    - `OfflineBanner.tsx`: non-blocking banner showing reconnection attempt number (1–5); after 5 failures, show final "Connection lost" message
    - Wire to `connection:failed` Socket.IO event from `useWebSocket` hook
    - _Requirements: 4.8_

- [ ] 17. Frontend: Channel Guide UI
  - [ ] 17.1 Implement ChannelGuide and ChannelCard components
    - `ChannelGuide.tsx`: persistent sidebar (web) / bottom sheet (mobile); list all 7 channels with current program title, thumbnail, viewer count (compact format e.g. "12.3K"); subscribe to `program:changed` and `viewer:count` WebSocket events
    - `ChannelCard.tsx`: on click, load channel stream within 4 s; show "Now on Air" badge for live channels
    - _Requirements: 6.1, 6.2, 6.4_
  - [ ] 17.2 Implement ProgramSchedule component
    - `ProgramSchedule.tsx`: display current + upcoming programs with titles, descriptions, start times in local timezone (UTC fallback with label)
    - _Requirements: 6.3_
  - [ ] 17.3 Implement program search in channel guide
    - Search input calls `GET /channels/search?q=`; display results within 1 s; show "no results found" when empty
    - _Requirements: 6.5_

- [ ] 18. Frontend: Notifications UI
  - [ ] 18.1 Implement NotificationInbox component
    - `NotificationInbox.tsx`: display last 90 days of notifications with read/unread indicators; cursor-paginated list; call `PUT /notifications/{id}/read` on item click
    - _Requirements: 8.6_
  - [ ] 18.2 Implement NotificationBadge component
    - `NotificationBadge.tsx`: show unread count badge on notification icon; update on new `in_app` notification received via WebSocket or polling
    - _Requirements: 8.6_

- [ ] 19. Frontend: Profile UI
  - [ ] 19.1 Implement ProfileEditor component
    - `ProfileEditor.tsx`: form for display name (2–50 chars), profile photo upload (JPEG/PNG ≤5 MB), country (ISO 3166-1 dropdown), preferred language (7-option dropdown); client-side validation using shared utilities; submit calls `PUT /profile` and `POST /profile/photo`
    - _Requirements: 7.5_
  - [ ] 19.2 Implement NotificationPreferences component
    - `NotificationPreferences.tsx`: 3×3 grid of toggles (push/in-app/email × session alerts/check-in activity/announcements); submit calls `PUT /profile/notification-preferences`
    - _Requirements: 7.6_

- [ ] 20. Frontend: Accessibility implementation
  - [ ] 20.1 Add SkipToContent link and landmark regions
    - `SkipToContent.tsx`: visually hidden skip link that becomes visible on focus; links to `#main-content`
    - Ensure all pages have `<main id="main-content">`, `<nav aria-label>`, `<header>`, `<footer>` landmark elements
    - _Requirements: 9.1, 9.5_
  - [ ] 20.2 Add text alternatives for all non-text content
    - All map pin icons: `aria-label` with event/church name and status
    - All stream thumbnails: `alt` text with program/channel name
    - All reaction icons: `aria-label` with reaction type name
    - All notification icons: `aria-label` with notification type
    - _Requirements: 9.4_
  - [ ] 20.3 Integrate axe-core into test suite
    - Add `jest-axe` to React Testing Library test setup
    - Add `expect(await axe(container)).toHaveNoViolations()` assertion to all component test files
    - _Requirements: 9.1_
  - [ ]* 20.4 Write property test for graceful degradation isolation
    - **Property 26: Graceful degradation isolates service failures**
    - **Validates: Requirements 10.5**
    - Use fast-check to generate single-service failure scenarios; render full app with mocked service responses; assert only the failed service's features show degraded state; all other features remain functional

- [ ] 21. Backend: Error logging and structured log validation
  - [ ] 21.1 Implement structured log middleware for all Node.js services
    - Shared `createLogger(serviceName)` factory in `shared/logger` package
    - Every log entry includes: `timestamp` (ISO 8601), `level`, `service`, `requestId`, `userId` or `sessionId`, `path`, `errorCode`, `message`, `durationMs`
    - Wire into all 6 Node.js services (Auth, Event, Engagement, Notification, Channel Guide, Profile)
    - _Requirements: 10.6_
  - [ ]* 21.2 Write property test for error log entry completeness
    - **Property 27: Error log entries contain all required context fields**
    - **Validates: Requirements 10.6**
    - Use fast-check to generate arbitrary error events across all services; assert every generated log entry contains non-null, non-empty values for `timestamp`, `userId`/`sessionId`, `requestPath`, `errorCode`; assert malformed entries trigger alert

- [ ] 22. E2E tests (Playwright)
  - [ ] 22.1 Implement unauthenticated viewer journey E2E test
    - Test: load map → see live pins → click pin → see event card with all 4 required fields
    - _Requirements: 1.2, 1.7_
  - [ ] 22.2 Implement authenticated participant journey E2E test
    - Test: sign in → find event → register → watch stream → submit reaction → check in → verify activity feed update
    - _Requirements: 3.3, 4.1, 4.3_
  - [ ] 22.3 Implement KingsChat SSO E2E test
    - Test: click KingsChat login → OAuth redirect → return to platform authenticated → verify original URL restored
    - _Requirements: 7.2, 7.4_
  - [ ] 22.4 Implement channel guide navigation E2E test
    - Test: open channel guide → select channel → stream loads within 4 s → program schedule displays with local timezone times
    - _Requirements: 6.2, 6.3_

- [ ] 23. Performance tests (k6)
  - [ ] 23.1 Implement WebSocket load test
    - k6 script: ramp to 50,000 concurrent WebSocket connections per event room; assert p99 fan-out latency <500 ms
    - _Requirements: 2.5, 4.3_
  - [ ] 23.2 Implement event registration stress test
    - k6 script: 500,000 registration requests in 60 s; assert p99 response time ≤2 s; assert zero 5xx errors
    - _Requirements: 3.8_
  - [ ] 23.3 Implement map render performance test
    - Automated test using `requestAnimationFrame` timing: render 10,000 pins at zoom level 3; assert ≥30 fps sustained for 5 s
    - _Requirements: 1.8_
  - [ ] 23.4 Implement page load performance test
    - k6 browser test: measure initial page load time at CDN edge; assert p95 ≤3 s on ≥5 Mbps connection
    - _Requirements: 10.1_

- [ ] 24. CI/CD pipeline setup
  - [ ] 24.1 Implement GitHub Actions CI workflow
    - Workflow: on push/PR → install deps → lint → type-check → unit tests (Jest + Go test) → property tests (fast-check + gopter) → build all services and frontend
    - Add axe-core accessibility check step (zero critical violations gate)
    - _Requirements: 9.1, 10.2_
  - [ ] 24.2 Implement Docker build and push workflow
    - Dockerfile for each service (multi-stage: build → runtime); `docker-compose.yml` for local dev
    - GitHub Actions workflow: on merge to `main` → build Docker images → push to container registry → update Kubernetes manifests
    - _Requirements: 10.2, 10.3_
  - [ ] 24.3 Implement Kubernetes deployment manifests
    - `k8s/` directory with Deployment, Service, HPA (scale at 80% CPU/memory) manifests for each service
    - HPA configured to scale within 60 s when traffic exceeds 80% provisioned capacity
    - _Requirements: 10.3_
  - [ ] 24.4 Final checkpoint — Ensure all tests pass
    - Run full test suite: unit, property, integration, E2E, performance, accessibility
    - Verify all 27 correctness properties pass
    - Ask the user if any questions arise before marking complete

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; all 27 correctness properties are covered by optional PBT sub-tasks
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at each service boundary
- Property tests use **fast-check** (TypeScript/frontend) and **gopter** (Go services)
- Unit tests use **Jest** (Node.js), **Go testing** package (Go), and **React Testing Library** (frontend)
- E2E tests use **Playwright** (web)
- Performance tests use **k6**
- All 27 correctness properties from the design document are covered by PBT sub-tasks (Properties 1–27)
- The dependency graph below schedules leaf sub-tasks into parallel waves; checkpoint and top-level tasks are excluded


## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.2"]
    },
    {
      "id": 1,
      "tasks": ["1.3", "1.5", "1.6"]
    },
    {
      "id": 2,
      "tasks": ["1.4", "2.1", "3.1", "4.1", "5.1", "6.1", "7.1", "8.1", "9.1", "10.1", "11.1"]
    },
    {
      "id": 3,
      "tasks": ["2.2", "2.4", "2.6", "2.8", "3.2", "3.4", "3.5", "4.2", "4.3", "4.4", "4.6", "5.2", "5.3", "5.4", "5.5", "6.2", "6.3", "6.4", "6.6", "6.8", "7.2", "7.4", "7.6", "7.8", "8.2", "8.4", "8.5", "9.2", "9.4", "10.2", "11.2", "12.1", "12.2", "12.3"]
    },
    {
      "id": 4,
      "tasks": ["2.3", "2.5", "2.7", "2.9", "3.3", "3.6", "3.7", "3.8", "4.5", "4.7", "5.6", "6.5", "6.7", "7.3", "7.5", "7.7", "8.3", "9.3", "10.3", "10.4", "10.5", "13.1", "13.6", "13.7", "14.1", "15.1", "16.1", "16.2", "16.3", "16.4", "16.5", "16.6", "16.7", "17.1", "17.2", "17.3", "18.1", "18.2", "19.1", "19.2", "20.1", "20.2"]
    },
    {
      "id": 5,
      "tasks": ["2.10", "3.9", "4.8", "6.9", "7.9", "8.6", "9.5", "10.6", "13.2", "13.4", "13.9", "13.11", "14.2", "14.3", "14.4", "14.5", "15.2", "15.4", "15.5", "21.1"]
    },
    {
      "id": 6,
      "tasks": ["10.7", "13.3", "13.5", "13.8", "13.10", "13.12", "14.6", "15.3", "16.7", "20.3", "20.4", "21.2"]
    },
    {
      "id": 7,
      "tasks": ["13.13", "22.1", "22.2", "22.3", "22.4", "23.1", "23.2", "23.3", "23.4", "24.1"]
    },
    {
      "id": 8,
      "tasks": ["24.2", "24.3"]
    },
    {
      "id": 9,
      "tasks": ["24.4"]
    }
  ]
}
```
