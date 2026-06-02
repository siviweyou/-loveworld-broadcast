/**
 * LOVEWORLD NETWORKS LIVE — UI MODULE
 * Handles all DOM rendering: views, channel guide, events, churches,
 * activity feed, auth modal, notifications, toasts, and animations.
 */

const LWUI = (() => {

  // ---- Feed state ----
  let feedItems = [];
  const FEED_MAX = 500;

  // ---- Toast queue ----
  let toastTimer = null;

  // ---- Admin session state ----
  // In production this comes from the backend session.
  // For testing, signing in with admin credentials activates admin mode.
  const ADMIN_CREDENTIALS = { email: 'admin@loveworld.tv', password: 'Admin1234' };
  let _isAdmin = false;

  function isAdmin() { return _isAdmin; }

  function setAdmin(value) {
    _isAdmin = value;
    const badge = document.getElementById('adminBadge');
    if (badge) badge.hidden = !value;
    // Show/hide credential manager section
    const credSection = document.getElementById('credentialManager');
    if (credSection) credSection.hidden = !value;
    // Re-render broadcast channels so stream keys reflect the new role
    renderBroadcastChannels();
  }

  // ==================================================================
  // VIEW SWITCHING
  // ==================================================================
  function switchView(viewId) {
    document.body.dataset.view = viewId;
    if (viewId !== 'broadcast') {
      ['provisionPanel', 'channelPanel', 'routePanel'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) panel.hidden = true;
      });
    }

    // Hide all views
    document.querySelectorAll('.view').forEach(v => {
      v.hidden = true;
      v.classList.remove('active');
    });

    // Show target view
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
      target.hidden = false;
      target.classList.add('active');
    }

    // Update nav buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const isActive = btn.dataset.view === viewId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    // Render view content on first switch
    if (viewId === 'broadcast') renderBroadcastNetwork('all');
    if (viewId === 'map')      setTimeout(() => LWMap.resize(), 80);
    if (viewId === 'events')   renderEvents('all');
    if (viewId === 'channels') renderChannels();
    if (viewId === 'churches') renderChurches(LW_DATA.churches);
  }

  // ==================================================================
  // BROADCAST NETWORK
  // ==================================================================
  function renderBroadcastNetwork(statusFilter = 'all') {
    const list = document.getElementById('broadcastFeedList');
    if (!list) return;

    const liveFeeds = LW_DATA.broadcastFeeds.filter(feed => feed.status === 'live' || feed.status === 'reconnecting');
    const viewers = liveFeeds.reduce((total, feed) => total + feed.viewers, 0);
    document.getElementById('liveInputCount').textContent = String(liveFeeds.length);
    document.getElementById('cdnViewerCount').textContent = formatCount(viewers);
    document.getElementById('routeCount').textContent = String(
      LW_DATA.distributionRoutes.filter(route => route.status === 'sending').length
    );

    renderBroadcastChannels();
    renderDistributionRoutes();

    const filtered = statusFilter === 'all'
      ? LW_DATA.broadcastFeeds
      : LW_DATA.broadcastFeeds.filter(feed => (
          statusFilter === 'live'
            ? feed.status === 'live' || feed.status === 'reconnecting'
            : feed.status === statusFilter
        ));

    if (filtered.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📡</div>
          <h3>No feeds ${statusFilter !== 'all' ? `with status "${statusFilter}"` : 'connected'}</h3>
          <p>Start OBS and stream to <strong>${escapeHtml((typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL) || 'rtmp://localhost/live')}</strong> with a generated stream key.</p>
        </div>`;
      return;
    }

    list.innerHTML = filtered.map(feed => `
      <article class="broadcast-feed-row ${feed.status} ${feed.role === 'program' ? 'program' : ''}" role="listitem">
        <div class="feed-identity">
          <span class="feed-signal" aria-hidden="true"></span>
          <div>
            <strong>${escapeHtml(feed.church)}</strong>
            <small>${escapeHtml(feed.city)}, ${escapeHtml(feed.country)}${feed.role === 'program' ? ' / Program output' : ''}</small>
          </div>
        </div>
        <span class="protocol-pill">${escapeHtml(feed.protocol)}</span>
        <div class="feed-health">
          <strong>${escapeHtml(feed.quality)}</strong>
          <small>${escapeHtml(feed.latency)} latency</small>
        </div>
        <div class="feed-cdn-status">
          ${feed.cdnEnabled ? '<span class="cdn-badge active" title="Streaming globally via 5cent CDN">🌍 CDN</span>' : '<span class="cdn-badge inactive" title="Local stream only">📡 Local</span>'}
        </div>
        <code class="feed-input-id">${escapeHtml(feed.inputId)}</code>
        <div class="feed-actions">
          <button class="btn-secondary" data-feed-preview="${feed.id}">Preview</button>
          <button class="btn-primary" data-feed-program="${feed.id}" ${feed.role === 'program' ? 'disabled' : ''}>
            ${feed.role === 'program' ? 'On Air' : 'Take Live'}
          </button>
        </div>
      </article>
    `).join('');

    list.querySelectorAll('[data-feed-program]').forEach(button => {
      button.addEventListener('click', () => setProgramFeed(button.dataset.feedProgram));
    });

    list.querySelectorAll('[data-feed-preview]').forEach(button => {
      button.addEventListener('click', () => {
        const feed = LW_DATA.broadcastFeeds.find(item => item.id === button.dataset.feedPreview);
        if (feed && feed.hlsUrl) {
          LWBroadcast.openPreview(feed.church, feed.hlsUrl);
        } else if (feed) {
          LWPlayer.openMeeting(`Feed Preview: ${feed.church}`, feed.viewers || 1);
        }
      });
    });
  }

  function renderBroadcastChannels() {
    const list = document.getElementById('broadcastChannelList');
    if (!list) return;

    if (LW_DATA.broadcastChannels.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📺</div>
          <h3>No channels yet</h3>
          <p>Click <strong>Create Channel</strong> to generate RTMP and HLS endpoints.</p>
        </div>`;
      document.getElementById('activeChannelName').textContent = '—';
      document.getElementById('activeHlsEndpoint').textContent = '—';
      document.getElementById('activeRtmpEndpoint').textContent = '—';
      return;
    }

    const activeChannel = LW_DATA.broadcastChannels.find(channel => channel.status === 'live')
      || LW_DATA.broadcastChannels[0];
    if (activeChannel) {
      document.getElementById('activeChannelName').textContent = activeChannel.name;
      document.getElementById('activeHlsEndpoint').textContent = activeChannel.hlsUrl.replace('https://', '');
      document.getElementById('activeRtmpEndpoint').textContent = activeChannel.ingestUrl;
    }

    list.innerHTML = LW_DATA.broadcastChannels.map(channel => {
      const keyDisplay = _isAdmin
        ? `<code class="stream-key-value" data-key="${escapeHtml(channel.streamKey)}">${escapeHtml(channel.streamKey)}</code>
           <button class="btn-copy-key" data-copy-key="${escapeHtml(channel.streamKey)}" title="Copy stream key" aria-label="Copy stream key">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
           </button>`
        : `<code class="stream-key-value masked" id="key-${channel.id}">${escapeHtml(maskKey(channel.streamKey))}</code>
           <button class="btn-reveal-key" data-channel-key="${channel.id}" data-full-key="${escapeHtml(channel.streamKey)}" aria-label="Reveal stream key" title="Reveal stream key">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
           </button>`;

      return `
      <article class="broadcast-channel-card ${channel.status === 'live' ? 'active' : ''}" role="listitem">
        <div class="channel-card-top">
          <div>
            <strong>${escapeHtml(channel.name)}</strong>
            <small>${escapeHtml(channel.customDomain)}/${escapeHtml(channel.slug)}</small>
          </div>
          <span class="status-pill ${channel.status === 'live' ? 'live' : ''}">${channel.status === 'live' ? 'Live' : 'Ready'}</span>
        </div>
        <div class="channel-link-grid">
          <div class="channel-link">
            <span>RTMPS Publish URL</span>
            <code>${escapeHtml(channel.ingestUrl)}</code>
          </div>
          <div class="channel-link secret">
            <span>Stream Key ${_isAdmin ? '<span class="admin-key-label">ADMIN</span>' : ''}</span>
            <div class="stream-key-row">${keyDisplay}</div>
          </div>
          <div class="channel-link">
            <span>HLS Playback URL</span>
            <code>${escapeHtml(channel.hlsUrl)}</code>
          </div>
        </div>
        <div class="channel-buttons">
          <button class="btn-secondary" data-channel-copy="${channel.id}">Copy Links</button>
          <button class="btn-primary" data-channel-activate="${channel.id}" ${channel.status === 'live' ? 'disabled' : ''}>
            ${channel.status === 'live' ? 'Active' : 'Set Active'}
          </button>
        </div>
      </article>
    `}).join('');

    list.querySelectorAll('[data-channel-copy]').forEach(button => {
      button.addEventListener('click', () => copyChannelDetails(button.dataset.channelCopy));
    });
    list.querySelectorAll('[data-channel-activate]').forEach(button => {
      button.addEventListener('click', () => setActiveChannel(button.dataset.channelActivate));
    });

    // Admin: copy stream key directly
    list.querySelectorAll('.btn-copy-key').forEach(button => {
      button.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.copyKey);
          showToast('Stream key copied.', 'success');
        } catch {
          showToast(`Stream key: ${button.dataset.copyKey}`, 'info');
        }
      });
    });

    // Non-admin: reveal/hide stream key toggle
    list.querySelectorAll('.btn-reveal-key').forEach(button => {
      button.addEventListener('click', () => {
        const keyEl = document.getElementById(`key-${button.dataset.channelKey}`);
        if (!keyEl) return;
        const isRevealed = keyEl.classList.contains('revealed');
        if (isRevealed) {
          keyEl.textContent = maskKey(button.dataset.fullKey);
          keyEl.classList.remove('revealed');
          button.setAttribute('aria-label', 'Reveal stream key');
          button.title = 'Reveal stream key';
        } else {
          keyEl.textContent = button.dataset.fullKey;
          keyEl.classList.add('revealed');
          button.setAttribute('aria-label', 'Hide stream key');
          button.title = 'Hide stream key';
        }
      });
    });
  }

  function renderDistributionRoutes() {
    const list = document.getElementById('routeList');
    if (!list) return;

    if (LW_DATA.distributionRoutes.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔀</div>
          <h3>No destinations</h3>
          <p>Click <strong>Add Destination</strong> to push the program output to YouTube, regional CDNs, or partner platforms.</p>
        </div>`;
      return;
    }

    list.innerHTML = LW_DATA.distributionRoutes.map(route => `
      <article class="route-row ${route.status}" role="listitem">
        <div class="route-identity">
          <strong>${escapeHtml(route.name)}</strong>
          <small>${escapeHtml(route.region)} distribution</small>
        </div>
        <span class="route-kind">${escapeHtml(route.kind)}</span>
        <code class="route-url">${escapeHtml(route.destination)}</code>
        <span class="route-status">${escapeHtml(route.status)}</span>
        <button class="btn-secondary route-toggle" data-route-toggle="${route.id}">
          ${route.status === 'sending' ? 'Pause' : 'Start Push'}
        </button>
      </article>
    `).join('');

    list.querySelectorAll('[data-route-toggle]').forEach(button => {
      button.addEventListener('click', () => toggleDistributionRoute(button.dataset.routeToggle));
    });
  }

  function maskKey(key) {
    return `${key.slice(0, 8)}********${key.slice(-4)}`;
  }

  async function copyText(value, successMessage) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(successMessage, 'success');
    } catch {
      showToast(successMessage, 'info');
    }
  }

  function copyChannelDetails(channelId) {
    const channel = LW_DATA.broadcastChannels.find(item => item.id === channelId);
    if (!channel) return;
    copyText(
      `RTMP Publish URL: ${channel.ingestUrl}\nStream Key: ${channel.streamKey}\nHLS: ${channel.hlsUrl}`,
      `${channel.name} publish and playback links copied.`
    );
  }

  function setActiveChannel(channelId) {
    const channel = LW_DATA.broadcastChannels.find(item => item.id === channelId);
    if (!channel) return;
    LW_DATA.broadcastChannels.forEach(item => {
      item.status = item.id === channel.id ? 'live' : 'ready';
    });
    renderBroadcastChannels();
    showToast(`${channel.name} is now the active distribution channel.`, 'success');
  }

  function createBroadcastChannel({ name, slug, domain }) {
    const safeSlug = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '') || 'broadcast';
    const safeDomain = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const streamKey = `${safeSlug}-${Date.now().toString().slice(-4)}`;
    const ingestUrl = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL) || 'rtmp://localhost/live';
    const hlsBase = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_HLS_BASE) || 'http://localhost:8000/live';
    const channel = {
      id: `channel-${Date.now()}`,
      name,
      slug: safeSlug,
      customDomain: safeDomain,
      status: 'ready',
      ingestUrl,
      streamKey: streamKey,
      srtUrl: '',
      hlsUrl: `${hlsBase}/${streamKey}/index.m3u8`,
      dashUrl: '',
    };
    LW_DATA.broadcastChannels.push(channel);
    renderBroadcastChannels();
    showToast(`${name} created with RTMPS and HLS endpoints.`, 'success');
  }

  function createDistributionRoute({ name, kind, destination }) {
    LW_DATA.distributionRoutes.push({
      id: `route-${Date.now()}`,
      name,
      kind,
      destination,
      region: 'Custom',
      status: 'sending',
    });
    document.getElementById('routeCount').textContent = String(
      LW_DATA.distributionRoutes.filter(route => route.status === 'sending').length
    );
    renderDistributionRoutes();
    showToast(`${name} is receiving the global program feed.`, 'success');
  }

  function toggleDistributionRoute(routeId) {
    const route = LW_DATA.distributionRoutes.find(item => item.id === routeId);
    if (!route) return;
    route.status = route.status === 'sending' ? 'paused' : 'sending';
    document.getElementById('routeCount').textContent = String(
      LW_DATA.distributionRoutes.filter(item => item.status === 'sending').length
    );
    renderDistributionRoutes();
    showToast(`${route.name} push is ${route.status}.`, route.status === 'sending' ? 'success' : 'info');
  }

  function setProgramFeed(feedId) {
    const feed = LW_DATA.broadcastFeeds.find(item => item.id === feedId);
    if (!feed) return;

    const previousProgram = LW_DATA.broadcastFeeds.find(item => item.role === 'program');
    LW_DATA.broadcastFeeds.forEach(item => {
      item.role = item.id === feed.id
        ? 'program'
        : item.id === previousProgram?.id
          ? 'backup'
          : 'available';
    });
    feed.status = 'live';
    feed.role = 'program';

    document.getElementById('programRegion').textContent = `${feed.city}, ${feed.country}`;
    document.getElementById('programTitle').textContent = feed.church;
    document.getElementById('programMeta').textContent = `${feed.protocol} primary feed / ${feed.quality} / ${feed.bitrate}`;

    // If this is a real feed from the local server, update the HLS endpoint
    // and call the API to set it as program output
    if (feed.hlsUrl) {
      document.getElementById('activeHlsEndpoint').textContent = feed.hlsUrl.replace(/^https?:\/\//, '');
      document.getElementById('activeRtmpEndpoint').textContent =
        (typeof LWAPI !== 'undefined' && LWAPI.getRtmpUrl()) ||
        (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL) ||
        'rtmp://localhost/live';
      // Tell the server this is now the program output
      if (typeof LWAPI !== 'undefined' && LWAPI.isOnline()) {
        LWAPI.setProgram(feed.church).catch(err => {
          showToast(`Could not set program on server: ${err.message}`, 'warning');
        });
      }
    }

    renderBroadcastNetwork(document.querySelector('#feedStatusFilter button.active')?.dataset.feedStatus || 'all');
    showToast(`${feed.church} is now on program output.`, 'success');
  }

  function provisionFeed({ church, city, protocol }) {
    // If local server is online, use the real API to generate credentials
    if (typeof LWAPI !== 'undefined' && LWAPI.isOnline()) {
      LWAPI.createCredential({ name: church, type: 'church', city })
        .then(cred => {
          // Show credentials in the reveal panel
          document.getElementById('revealRtmpUrl').textContent = cred.rtmpUrl;
          document.getElementById('revealStreamKey').textContent = cred.streamKey;
          document.getElementById('revealHlsUrl').textContent = cred.hlsUrl;
          document.getElementById('credReveal').hidden = false;
          document.getElementById('credFormWrap').hidden = true;

          // Wire copy buttons
          document.querySelectorAll('#credReveal .btn-copy-key').forEach(btn => {
            btn.onclick = async () => {
              const val = document.getElementById(btn.dataset.copyTarget)?.textContent || '';
              try { await navigator.clipboard.writeText(val); showToast('Copied!', 'success'); }
              catch { showToast(val, 'info'); }
            };
          });

          // Wire copy-all
          document.getElementById('credCopyAll').onclick = async () => {
            const text = `${church} — OBS Stream Settings\nRTMP Server: ${cred.rtmpUrl}\nStream Key:  ${cred.streamKey}\nHLS Playback: ${cred.hlsUrl}`;
            try { await navigator.clipboard.writeText(text); showToast('All credentials copied.', 'success'); }
            catch { showToast('Copy failed.', 'warning'); }
          };

          // Add to feed list as standby
          LW_DATA.broadcastFeeds.push({
            id: `feed-${Date.now()}`,
            church,
            city,
            country: '',
            protocol,
            status: 'standby',
            role: 'available',
            quality: '—',
            bitrate: '—',
            latency: '—',
            viewers: 0,
            inputId: cred.streamKey,
            hlsUrl: cred.hlsUrl,
          });
          renderBroadcastNetwork('all');
          showToast(`${church} credentials generated. Copy them now!`, 'success');
        })
        .catch(err => {
          showToast(`Failed to generate 5centsCDN credentials: ${err.message}`, 'error');
        });
      return;
    }

    if (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.CDN_ENABLED) {
      showToast('Platform API server is offline. Start it before creating 5centsCDN church feed credentials.', 'error');
      return;
    }

    // Fallback: generate locally when server is offline
    const streamKey = `${church.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString().slice(-4)}`;
    const ingestUrl = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL) || 'rtmp://localhost/live';
    const hlsUrl = `${(typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_HLS_BASE) || 'http://localhost:8000/live'}/${streamKey}/index.m3u8`;

    // Show credentials in reveal panel if it exists
    const revealPanel = document.getElementById('credReveal');
    if (revealPanel) {
      document.getElementById('revealRtmpUrl').textContent = ingestUrl;
      document.getElementById('revealStreamKey').textContent = streamKey;
      document.getElementById('revealHlsUrl').textContent = hlsUrl;
      revealPanel.hidden = false;
      document.getElementById('credFormWrap').hidden = true;

      document.querySelectorAll('#credReveal .btn-copy-key').forEach(btn => {
        btn.onclick = async () => {
          const val = document.getElementById(btn.dataset.copyTarget)?.textContent || '';
          try { await navigator.clipboard.writeText(val); showToast('Copied!', 'success'); }
          catch { showToast(val, 'info'); }
        };
      });

      document.getElementById('credCopyAll').onclick = async () => {
        const text = `${church} — OBS Stream Settings\nRTMP Server: ${ingestUrl}\nStream Key:  ${streamKey}\nHLS Playback: ${hlsUrl}`;
        try { await navigator.clipboard.writeText(text); showToast('All credentials copied.', 'success'); }
        catch { showToast('Copy failed.', 'warning'); }
      };
    } else {
      showToast(`OBS Server: ${ingestUrl} · Key: ${streamKey}`, 'success');
    }

    LW_DATA.broadcastFeeds.push({
      id: `feed-${Date.now()}`,
      church,
      city,
      country: '',
      protocol,
      status: 'standby',
      role: 'available',
      quality: '—',
      bitrate: '—',
      latency: '—',
      viewers: 0,
      inputId: streamKey,
      hlsUrl,
    });
    renderBroadcastNetwork('all');

    const credentials = `OBS Stream Settings\nService: Custom\nServer: ${ingestUrl}\nStream Key: ${streamKey}\n\nHLS Playback: ${hlsUrl}`;
    navigator.clipboard?.writeText(credentials).catch(() => {});
  }

  // ==================================================================
  // CHANNEL GUIDE (sidebar)
  // ==================================================================
  function renderChannelGuide() {
    const list = document.getElementById('channelList');
    if (!list) return;

    list.innerHTML = LW_DATA.channels.map(ch => `
      <button
        class="channel-item${ch.status === 'live' ? ' active' : ''}"
        data-channel-id="${ch.id}"
        role="listitem"
        aria-label="${ch.name} — ${ch.status === 'live' ? 'Live, ' + formatCount(ch.viewerCount) + ' watching' : 'Offline'}"
      >
        <span class="channel-dot ${ch.status === 'live' ? 'live' : 'offline'}" aria-hidden="true"></span>
        <span class="channel-info">
          <span class="channel-name">${ch.name}</span>
          <span class="channel-viewers">${ch.status === 'live' ? formatCount(ch.viewerCount) + ' watching' : 'Offline'}</span>
        </span>
        ${ch.status === 'live' ? '<span class="now-on-air" aria-hidden="true">LIVE</span>' : ''}
      </button>
    `).join('');

    // Wire click handlers
    list.querySelectorAll('.channel-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = LW_DATA.channels.find(c => c.id === btn.dataset.channelId);
        if (ch && ch.status === 'live') {
          LWPlayer.open(ch);
        } else {
          showToast('This channel is currently offline.', 'info');
        }
      });
    });
  }

  function updateChannelViewerCount(channelId, count) {
    const btn = document.querySelector(`[data-channel-id="${channelId}"]`);
    if (!btn) return;
    const viewersEl = btn.querySelector('.channel-viewers');
    if (viewersEl) viewersEl.textContent = formatCount(count) + ' watching';
    btn.setAttribute('aria-label',
      `${LW_DATA.channels.find(c => c.id === channelId)?.name} — Live, ${formatCount(count)} watching`
    );
  }

  // ==================================================================
  // EVENTS VIEW
  // ==================================================================
  function renderEvents(statusFilter) {
    const grid = document.getElementById('eventGrid');
    if (!grid) return;

    const filtered = statusFilter === 'all'
      ? LW_DATA.events
      : LW_DATA.events.filter(e => e.status === statusFilter);

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">📅</div>
          <h3>No events found</h3>
          <p>Try a different filter or check back soon.</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(ev => {
      const ch = LW_DATA.channels.find(c => c.id === ev.channelId);
      const isLive = ev.status === 'live';
      const isUpcoming = ev.status === 'upcoming';
      const isConcluded = ev.status === 'concluded';

      return `
        <article class="event-card" role="listitem" data-event-id="${ev.id}" tabindex="0"
          aria-label="${ev.title} — ${ev.status}">
          <div class="event-card-thumb">
            <div class="event-card-thumb-placeholder" aria-hidden="true">${ev.thumbnailEmoji}</div>
            <span class="event-status-badge ${ev.status}" aria-label="Status: ${ev.status}">
              ${isLive ? '🔴 LIVE' : isUpcoming ? 'UPCOMING' : 'CONCLUDED'}
            </span>
          </div>
          <div class="event-card-body">
            <div class="event-card-type">${ev.type.toUpperCase()} ${ch ? '· ' + ch.name : ''}</div>
            <h3 class="event-card-title">${ev.title}</h3>
            <div class="event-card-meta">
              <span>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${isLive ? 'Live now' : formatLocalTime(ev.scheduledStartAt)}
              </span>
              ${isLive || isConcluded ? `
              <span>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${formatCount(ev.participantCount)}
              </span>` : `
              <span>
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
                ${formatCount(ev.registrationCount)} registered
              </span>`}
            </div>
            <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:14px;line-height:1.5;
              display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              ${ev.description}
            </p>
            <div class="event-card-actions">
              ${isLive ? `
                <button class="btn-primary" data-action="watch" data-event-id="${ev.id}">Watch Live</button>
                <button class="btn-secondary" data-action="checkin" data-event-id="${ev.id}">Check In</button>
              ` : isUpcoming ? `
                <button class="btn-primary" data-action="register" data-event-id="${ev.id}">Register</button>
                <button class="btn-secondary" data-action="remind" data-event-id="${ev.id}">Remind Me</button>
              ` : `
                <button class="btn-secondary" data-action="recording" data-event-id="${ev.id}">Watch Recording</button>
              `}
            </div>
          </div>
        </article>`;
    }).join('');

    // Wire event card actions
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        handleEventAction(btn.dataset.action, btn.dataset.eventId);
      });
    });

    // Card keyboard support
    grid.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const watchBtn = card.querySelector('[data-action="watch"], [data-action="register"]');
          if (watchBtn) watchBtn.click();
        }
      });
    });
  }

  function handleEventAction(action, eventId) {
    const ev = LW_DATA.events.find(e => e.id === eventId);
    if (!action || !ev) return;

    switch (action) {
      case 'watch': {
        const ch = LW_DATA.channels.find(c => c.id === ev.channelId);
        if (ch) LWPlayer.open(ch);
        break;
      }
      case 'checkin':
        LWRealtime.submitCheckin();
        break;
      case 'register':
        showToast(`✅ Registered for "${ev.title}"! Confirmation sent.`, 'success');
        break;
      case 'remind':
        showToast(`🔔 Reminder set for "${ev.title}".`, 'success');
        break;
      case 'recording':
        showToast('📹 Recording will be available soon.', 'info');
        break;
    }
  }

  // ==================================================================
  // CHANNELS VIEW
  // ==================================================================
  function renderChannels() {
    const grid = document.getElementById('channelsGrid');
    if (!grid) return;

    grid.innerHTML = LW_DATA.channels.map(ch => `
      <article class="channel-card" role="listitem" data-channel-id="${ch.id}" tabindex="0"
        aria-label="${ch.name} — ${ch.region} — ${ch.status === 'live' ? 'Live' : 'Offline'}">
        <div class="channel-card-header">
          <div class="channel-logo" style="background:${ch.color}" aria-hidden="true">
            ${ch.emoji}
          </div>
          <div class="channel-card-info">
            <div class="channel-card-name">${ch.name}</div>
            <div class="channel-card-region">${ch.region}</div>
          </div>
          ${ch.status === 'live' ? '<span class="now-on-air" aria-label="Live broadcast">LIVE</span>' : ''}
        </div>
        <div class="channel-card-body">
          <div class="channel-card-program">
            ${ch.status === 'live' ? `🎬 ${ch.currentProgram}` : '📴 Off Air'}
          </div>
          ${ch.status === 'live' ? `
          <div class="channel-card-viewers">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <span id="viewers-${ch.id}">${formatCount(ch.viewerCount)}</span> watching
          </div>` : '<div class="channel-card-viewers" style="color:var(--text-dim)">Currently offline</div>'}
          <div class="channel-card-actions">
            <button class="btn-primary" data-channel-id="${ch.id}"
              ${ch.status !== 'live' ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
              ${ch.status === 'live' ? 'Watch Now' : 'Offline'}
            </button>
          </div>
        </div>
      </article>
    `).join('');

    // Wire watch buttons
    grid.querySelectorAll('[data-channel-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = LW_DATA.channels.find(c => c.id === btn.dataset.channelId);
        if (ch && ch.status === 'live') LWPlayer.open(ch);
      });
    });

    // Card keyboard support
    grid.querySelectorAll('.channel-card').forEach(card => {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const btn = card.querySelector('[data-channel-id]');
          if (btn) btn.click();
        }
      });
    });
  }

  // ==================================================================
  // CHURCHES VIEW
  // ==================================================================
  function renderChurches(churches) {
    const grid = document.getElementById('churchGrid');
    if (!grid) return;

    if (churches.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="empty-state-icon">⛪</div>
          <h3>No churches found</h3>
          <p>Try a different search term or broaden your search.</p>
        </div>`;
      return;
    }

    grid.innerHTML = churches.map(ch => `
      <article class="church-card${ch.hasLiveEvent ? ' live-event' : ''}" role="listitem"
        aria-label="${ch.name}, ${ch.city}, ${ch.country}${ch.hasLiveEvent ? ' — Live event happening' : ''}">
        <div class="church-card-header">
          <div class="church-icon" aria-hidden="true">⛪</div>
          <div>
            <div class="church-card-name">${ch.name}</div>
            <div class="church-card-location">
              <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              ${ch.city}, ${ch.country}
            </div>
          </div>
          ${ch.hasLiveEvent ? '<span class="church-live-badge" aria-label="Live event">LIVE</span>' : ''}
        </div>
        <div class="church-card-details">
          <div>📞 ${ch.contact}</div>
          <div>🕐 ${ch.schedule}</div>
        </div>
        <div class="church-card-actions">
          <button class="btn-secondary" data-lat="${ch.location.lat}" data-lng="${ch.location.lng}"
            data-action="directions" aria-label="Get directions to ${ch.name}">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="3 11 22 2 13 21 11 13 3 11"/>
            </svg>
            Directions
          </button>
          <button class="btn-secondary" data-lat="${ch.location.lat}" data-lng="${ch.location.lng}"
            data-action="map" aria-label="View ${ch.name} on map">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/>
              <line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            View on Map
          </button>
        </div>
      </article>
    `).join('');

    // Wire church actions
    grid.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lat = parseFloat(btn.dataset.lat);
        const lng = parseFloat(btn.dataset.lng);
        if (btn.dataset.action === 'directions') {
          window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank', 'noopener');
        } else if (btn.dataset.action === 'map') {
          switchView('map');
          setTimeout(() => LWMap.flyTo(lat, lng, 13), 300);
        }
      });
    });
  }

  function searchChurches(query) {
    if (!query.trim()) {
      renderChurches(LW_DATA.churches);
      return;
    }
    const q = query.toLowerCase();
    const results = LW_DATA.churches.filter(ch =>
      ch.name.toLowerCase().includes(q) ||
      ch.city.toLowerCase().includes(q) ||
      ch.country.toLowerCase().includes(q)
    );
    renderChurches(results);
    if (results.length === 0) {
      showToast('No churches found. Try broadening your search.', 'info');
    }
  }

  // ==================================================================
  // ACTIVITY FEED
  // ==================================================================
  function addFeedEntry(entry) {
    entry.time = entry.time || 'just now';
    feedItems.unshift(entry);
    if (feedItems.length > FEED_MAX) feedItems.pop();

    const list = document.getElementById('feedList');
    if (!list) return;

    const el = document.createElement('div');
    el.className = `feed-entry ${entry.type}`;
    el.innerHTML = `
      <span class="feed-entry-time">${entry.time}</span>
      <span class="feed-entry-name">${escapeHtml(entry.name)}</span>
      <span class="feed-entry-action"> ${entry.emoji} ${entry.action}</span>
      ${entry.country ? `<div class="feed-entry-location">📍 ${escapeHtml(entry.country)}</div>` : ''}
    `;

    list.insertBefore(el, list.firstChild);

    // Enforce cap in DOM
    while (list.children.length > FEED_MAX) {
      list.removeChild(list.lastChild);
    }
  }

  function seedFeed() {
    LW_DATA.feedSeed.forEach((entry, i) => {
      setTimeout(() => addFeedEntry(entry), i * 400);
    });
  }

  // ==================================================================
  // REACTION FLOAT ANIMATION
  // ==================================================================
  function floatReaction(emoji) {
    const container = document.getElementById('reactionAnimations');
    if (!container) return;

    const el = document.createElement('div');
    el.className = 'reaction-float';
    el.textContent = emoji;
    el.style.left = Math.random() * 40 + 'px';
    container.appendChild(el);

    setTimeout(() => el.remove(), 2100);
  }

  // ==================================================================
  // NOTIFICATIONS PANEL
  // ==================================================================
  function renderNotifications() {
    const list = document.getElementById('notifList');
    if (!list) return;

    list.innerHTML = LW_DATA.notifications.map(n => `
      <div class="notif-item${n.unread ? ' unread' : ''}" role="listitem" data-notif-id="${n.id}"
        tabindex="0" aria-label="${n.title}${n.unread ? ' — unread' : ''}">
        <div class="notif-item-title">${escapeHtml(n.title)}</div>
        <div class="notif-item-body">${escapeHtml(n.body)}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>
    `).join('');

    // Update badge
    const unreadCount = LW_DATA.notifications.filter(n => n.unread).length;
    const badge = document.getElementById('notifBadge');
    if (badge) {
      badge.textContent = unreadCount;
      badge.hidden = unreadCount === 0;
    }

    // Wire click to mark read
    list.querySelectorAll('.notif-item').forEach(item => {
      item.addEventListener('click', () => markNotifRead(item.dataset.notifId));
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter') markNotifRead(item.dataset.notifId);
      });
    });
  }

  function markNotifRead(id) {
    const n = LW_DATA.notifications.find(n => n.id === id);
    if (n) n.unread = false;
    renderNotifications();
  }

  function markAllRead() {
    LW_DATA.notifications.forEach(n => n.unread = false);
    renderNotifications();
    showToast('All notifications marked as read.', 'success');
  }

  function toggleNotifPanel() {
    const panel = document.getElementById('notifPanel');
    const btn   = document.getElementById('notifBtn');
    const isOpen = !panel.hidden;
    panel.hidden = isOpen;
    btn.setAttribute('aria-expanded', String(!isOpen));
    if (!isOpen) {
      renderNotifications();
      panel.querySelector('.notif-header h3')?.focus();
    }
  }

  // ==================================================================
  // AUTH MODAL
  // ==================================================================
  function openAuthModal() {
    document.getElementById('authModal').hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('signInEmail').focus();
  }

  function closeAuthModal() {
    document.getElementById('authModal').hidden = true;
    document.body.style.overflow = '';
  }

  function switchAuthTab(tab) {
    const signInTab   = document.getElementById('signInTab');
    const signUpTab   = document.getElementById('signUpTab');
    const signInPanel = document.getElementById('signInPanel');
    const signUpPanel = document.getElementById('signUpPanel');

    if (tab === 'signin') {
      signInTab.classList.add('active');
      signInTab.setAttribute('aria-selected', 'true');
      signUpTab.classList.remove('active');
      signUpTab.setAttribute('aria-selected', 'false');
      signInPanel.hidden = false;
      signUpPanel.hidden = true;
      document.getElementById('signInEmail').focus();
    } else {
      signUpTab.classList.add('active');
      signUpTab.setAttribute('aria-selected', 'true');
      signInTab.classList.remove('active');
      signInTab.setAttribute('aria-selected', 'false');
      signUpPanel.hidden = false;
      signInPanel.hidden = true;
      document.getElementById('signUpName').focus();
    }
  }

  function handleSignIn(e) {
    e.preventDefault();
    const email = document.getElementById('signInEmail').value.trim();
    const pass  = document.getElementById('signInPassword').value;
    let valid = true;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('signInEmailErr', 'Please enter a valid email address.');
      valid = false;
    } else {
      setFieldError('signInEmailErr', '');
    }

    if (!pass) {
      setFieldError('signInPassErr', 'Please enter your password.');
      valid = false;
    } else {
      setFieldError('signInPassErr', '');
    }

    if (!valid) return;

    // Check for admin credentials
    const isAdminLogin = email === ADMIN_CREDENTIALS.email && pass === ADMIN_CREDENTIALS.password;

    // Simulate sign-in success
    closeAuthModal();
    if (isAdminLogin) {
      setAdmin(true);
      document.getElementById('authBtn').textContent = 'Admin';
      showToast('🔐 Signed in as Admin. Stream keys are now visible.', 'success');
    } else {
      setAdmin(false);
      document.getElementById('authBtn').textContent = 'My Account';
      showToast('👋 Welcome back! You\'re now signed in.', 'success');
    }
  }

  function handleSignUp(e) {
    e.preventDefault();
    const name  = document.getElementById('signUpName').value.trim();
    const email = document.getElementById('signUpEmail').value.trim();
    const pass  = document.getElementById('signUpPassword').value;
    let valid = true;

    if (!validateDisplayName(name)) {
      setFieldError('signUpNameErr', 'Display name must be 2–50 characters.');
      valid = false;
    } else {
      setFieldError('signUpNameErr', '');
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFieldError('signUpEmailErr', 'Please enter a valid email address.');
      valid = false;
    } else {
      setFieldError('signUpEmailErr', '');
    }

    if (!validatePassword(pass)) {
      setFieldError('signUpPassErr', 'Password must be ≥8 chars with uppercase, lowercase and a number.');
      valid = false;
    } else {
      setFieldError('signUpPassErr', '');
    }

    if (!valid) return;

    closeAuthModal();
    document.getElementById('authBtn').textContent = name;
    showToast('🎉 Account created! Check your email to verify.', 'success');
  }

  function setFieldError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
  }

  // ==================================================================
  // TOAST NOTIFICATIONS
  // ==================================================================
  function showToast(message, type = 'info') {
    // Remove existing toast
    const existing = document.getElementById('lwToast');
    if (existing) existing.remove();
    if (toastTimer) clearTimeout(toastTimer);

    const colors = { success: '#16a34a', info: '#175cd3', error: '#d92d20', warning: '#f59e0b' };
    const icons  = { success: 'OK', info: 'i', error: '!', warning: '!' };

    const toast = document.createElement('div');
    toast.id = 'lwToast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.cssText = `
      position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
      background:var(--dark-2); border:1px solid ${colors[type]};
      color:var(--text); padding:12px 20px; border-radius:8px;
      font-size:0.875rem; font-weight:500; z-index:9999;
      box-shadow:0 4px 24px rgba(0,0,0,0.5);
      display:flex; align-items:center; gap:8px;
      animation:slide-up 0.25s ease; max-width:90vw; white-space:nowrap;
    `;
    toast.innerHTML = `<span aria-hidden="true">${icons[type]}</span> ${escapeHtml(message)}`;
    document.body.appendChild(toast);

    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // ==================================================================
  // SIDEBAR TOGGLE
  // ==================================================================
  function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn     = document.getElementById('menuToggle');
    const isOpen  = sidebar.classList.contains('open') || !sidebar.classList.contains('collapsed');

    if (window.innerWidth <= 900) {
      sidebar.classList.toggle('open');
      btn.setAttribute('aria-expanded', String(sidebar.classList.contains('open')));
    } else {
      sidebar.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', String(!sidebar.classList.contains('collapsed')));
    }
  }

  // ==================================================================
  // FEED PANEL TOGGLE
  // ==================================================================
  function toggleFeedPanel() {
    const panel = document.getElementById('feedPanel');
    const btn   = document.getElementById('feedToggle');
    panel.classList.toggle('collapsed');
    const collapsed = panel.classList.contains('collapsed');
    btn.setAttribute('aria-expanded', String(!collapsed));
    btn.setAttribute('aria-label', collapsed ? 'Expand activity feed' : 'Collapse activity feed');
  }

  // ==================================================================
  // UTILITY
  // ==================================================================
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return {
    switchView,
    renderBroadcastNetwork,
    renderBroadcastChannels,
    renderDistributionRoutes,
    createBroadcastChannel,
    createDistributionRoute,
    setProgramFeed,
    provisionFeed,
    renderChannelGuide,
    updateChannelViewerCount,
    renderEvents,
    renderChannels,
    renderChurches,
    searchChurches,
    addFeedEntry,
    seedFeed,
    floatReaction,
    renderNotifications,
    markAllRead,
    toggleNotifPanel,
    openAuthModal,
    closeAuthModal,
    switchAuthTab,
    handleSignIn,
    handleSignUp,
    showToast,
    toggleSidebar,
    toggleFeedPanel,
    isAdmin,
    setAdmin,
  };
})();
