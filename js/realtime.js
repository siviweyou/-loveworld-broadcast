/**
 * LOVEWORLD NETWORKS LIVE — REAL-TIME MODULE
 * Simulates WebSocket (Socket.IO) behaviour with setInterval-driven
 * mock events. In production, replace the simulation block with a
 * real Socket.IO connection to the WebSocket Gateway.
 */

const LWRealtime = (() => {

  // ---- State ----
  let globalCount   = 3_847_291;
  let prayerCount   = 2_847_391;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000];

  // Feed throttle state
  let feedWindowCount = 0;
  let feedWindowTimer = null;
  let feedBatchQueue  = [];
  let batchFlushTimer = null;
  const FEED_BURST_THRESHOLD = 100;
  const FEED_BATCH_INTERVAL  = 3000;
  const FEED_MAX_ITEMS       = 500;

  // ---- Names / locations for simulated activity ----
  const NAMES = [
    'Adaeze O.','James K.','Maria S.','David L.','Fatima A.',
    'Chen W.','Blessing N.','Sarah M.','Emmanuel T.','Grace P.',
    'Oluwaseun A.','Priya R.','Kwame B.','Anastasia V.','Yusuf M.',
    'Chidinma E.','Patrick O.','Amara D.','Lena H.','Samuel T.',
  ];
  const COUNTRIES = [
    'Nigeria','United Kingdom','USA','Brazil','UAE',
    'Singapore','Ghana','South Africa','Kenya','Australia',
    'Canada','France','India','Germany','Philippines',
  ];
  const REACTION_EMOJIS = {
    praise:'🙌', amen:'🙏', prayer:'✝️', heart:'❤️', fire:'🔥', hallelujah:'🎉',
  };
  const REACTION_TYPES = Object.keys(REACTION_EMOJIS);

  // ---- Connect (simulated) ----
  function connect() {
    console.info('[LWRealtime] Connecting…');
    // In production:
    // const socket = io('wss://api.loveworld.live', { reconnectionAttempts: 5, ... });
    // socket.on('connect', onConnect);
    // socket.on('disconnect', onDisconnect);
    // socket.on('reaction:new', onReaction);
    // socket.on('checkin:new', onCheckin);
    // socket.on('global:count', onGlobalCount);
    // socket.on('prayer:count', onPrayerCount);
    // socket.on('pin:update', onPinUpdate);

    // Simulation: start ticking
    startSimulation();
  }

  // ---- Simulation engine ----
  function startSimulation() {
    // Global counter — update every 10 s
    setInterval(() => {
      globalCount += Math.floor((Math.random() - 0.3) * 500);
      globalCount = Math.max(1_000_000, globalCount);
      onGlobalCount(globalCount);
    }, 10_000);

    // Prayer counter — update every 5 s
    setInterval(() => {
      prayerCount += Math.floor((Math.random() - 0.35) * 300);
      prayerCount = Math.max(500_000, prayerCount);
      onPrayerCount(prayerCount);
    }, 5_000);

    // Random feed events — every 1.5–4 s
    scheduleNextFeedEvent();

    // Viewer count on channel cards — every 10 s
    setInterval(() => {
      LW_DATA.channels.forEach(ch => {
        if (ch.status === 'live') {
          ch.viewerCount += Math.floor((Math.random() - 0.4) * 300);
          ch.viewerCount = Math.max(100, ch.viewerCount);
          LWUI.updateChannelViewerCount(ch.id, ch.viewerCount);
        }
      });
    }, 10_000);

    // Simulate pin count updates every 8 s
    setInterval(() => {
      LW_DATA.mapPins.filter(p => p.status === 'live').forEach(pin => {
        pin.count = Math.max(0, (pin.count || 0) + Math.floor((Math.random() - 0.3) * 200));
        LWMap.updatePinCount(pin.id, pin.count);
      });
    }, 8_000);
  }

  function scheduleNextFeedEvent() {
    const delay = 1500 + Math.random() * 2500;
    setTimeout(() => {
      emitRandomFeedEvent();
      scheduleNextFeedEvent();
    }, delay);
  }

  function emitRandomFeedEvent() {
    const name    = NAMES[Math.floor(Math.random() * NAMES.length)];
    const country = COUNTRIES[Math.floor(Math.random() * COUNTRIES.length)];
    const roll    = Math.random();

    if (roll < 0.5) {
      // Reaction
      const type = REACTION_TYPES[Math.floor(Math.random() * REACTION_TYPES.length)];
      onReaction({ name, country, type, emoji: REACTION_EMOJIS[type] });
    } else if (roll < 0.8) {
      // Check-in
      onCheckin({ name, country });
    } else {
      // Joined
      onJoined({ name, country });
    }
  }

  // ---- Event handlers ----
  function onGlobalCount(count) {
    const el = document.getElementById('globalCount');
    if (el) el.textContent = formatCount(count);
  }

  function onPrayerCount(count) {
    const el = document.getElementById('prayerCount');
    if (el) el.textContent = formatCount(count);
  }

  function onReaction({ name, country, type, emoji }) {
    // Animate floating reaction
    LWUI.floatReaction(emoji);

    // Add to feed
    const entry = {
      type: 'reaction',
      name,
      country,
      action: `sent ${type.charAt(0).toUpperCase() + type.slice(1)}`,
      emoji,
      time: 'just now',
    };
    pushFeedEntry(entry);
  }

  function onCheckin({ name, country }) {
    const entry = {
      type: 'checkin',
      name,
      country,
      action: 'checked in',
      emoji: '📍',
      time: 'just now',
    };
    pushFeedEntry(entry);
  }

  function onJoined({ name, country }) {
    const entry = {
      type: 'joined',
      name,
      country,
      action: 'joined the stream',
      emoji: '✨',
      time: 'just now',
    };
    pushFeedEntry(entry);
  }

  function onPinUpdate({ pinId, count }) {
    LWMap.updatePinCount(pinId, count);
  }

  // ---- Feed throttle logic ----
  function pushFeedEntry(entry) {
    feedWindowCount++;

    // Reset window counter every 10 s
    if (!feedWindowTimer) {
      feedWindowTimer = setTimeout(() => {
        feedWindowCount = 0;
        feedWindowTimer = null;
      }, 10_000);
    }

    if (feedWindowCount > FEED_BURST_THRESHOLD) {
      // Burst mode: queue and batch
      feedBatchQueue.push(entry);
      if (!batchFlushTimer) {
        batchFlushTimer = setInterval(() => {
          if (feedBatchQueue.length > 0) {
            const batch = feedBatchQueue.splice(0, feedBatchQueue.length);
            batch.forEach(e => LWUI.addFeedEntry(e));
          }
        }, FEED_BATCH_INTERVAL);
      }
    } else {
      // Normal mode: immediate
      if (batchFlushTimer) {
        clearInterval(batchFlushTimer);
        batchFlushTimer = null;
      }
      LWUI.addFeedEntry(entry);
    }
  }

  // ---- Reconnection simulation ----
  function simulateDisconnect() {
    const banner = document.getElementById('offlineBanner');
    banner.hidden = false;
    reconnectAttempts = 0;
    attemptReconnect();
  }

  function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT) {
      document.getElementById('offlineMsg').textContent =
        'Connection lost. Please refresh the page.';
      return;
    }
    reconnectAttempts++;
    document.getElementById('reconnectAttempt').textContent = reconnectAttempts;
    setTimeout(() => {
      // Simulate successful reconnect
      document.getElementById('offlineBanner').hidden = true;
      reconnectAttempts = 0;
    }, RECONNECT_DELAYS[reconnectAttempts - 1]);
  }

  // ---- Public: submit reaction (client → server) ----
  function submitReaction(type) {
    const emoji = REACTION_EMOJIS[type] || '🙌';
    // In production: socket.emit('reaction:submit', { eventId: currentEventId, type });
    onReaction({ name: 'You', country: '', type, emoji });
    LWUI.showToast(`${emoji} ${type.charAt(0).toUpperCase() + type.slice(1)} sent!`, 'success');
  }

  // ---- Public: submit check-in ----
  function submitCheckin() {
    // In production: socket.emit('checkin:submit', { eventId: currentEventId });
    onCheckin({ name: 'You', country: '' });
    LWUI.showToast('📍 Checked in! Your presence is recorded.', 'success');
  }

  return { connect, submitReaction, submitCheckin };
})();
