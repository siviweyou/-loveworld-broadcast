/**
 * LOVEWORLD NETWORKS LIVE — APP BOOTSTRAP
 * Initialises all modules and wires up all event listeners.
 */

document.addEventListener('DOMContentLoaded', () => {

  // ================================================================
  // 1. INITIALISE MODULES
  // ================================================================
  LWMap.init();
  LWPlayer.init();
  LWBroadcast.init();
  LWRealtime.connect();

  // Render sidebar channel guide
  LWUI.renderChannelGuide();

  // Seed the activity feed with initial entries
  LWUI.seedFeed();

  // Render notifications badge
  LWUI.renderNotifications();

  // ── Seed local platform channel from config ─────────────────────
  // Churches publish to the platform RTMP server. The platform creates HLS
  // playback locally, then 5centsCDN can be used as the global CDN layer.
   if (typeof LW_CONFIG !== 'undefined') {
     const rtmpUrl = LW_CONFIG.DEFAULT_RTMP_URL || 'rtmp://localhost/live';
     const hlsBase = LW_CONFIG.DEFAULT_HLS_BASE || 'http://localhost:8000/live';
     const slug = 'global-main';
     const streamKey = slug;

     LW_DATA.broadcastChannels = [{
       id: 'channel-platform-main',
       name: 'Loveworld Global Broadcast',
       slug: slug,
       customDomain: 'platform.local',
       status: 'ready',
       ingestUrl: rtmpUrl,
       streamKey: streamKey,
       srtUrl: '',
       hlsUrl: `${hlsBase}/${streamKey}/index.m3u8`,
       dashUrl: '',
     }];
      // Feed starts standby and becomes live when OBS/encoder connects.
       LW_DATA.broadcastFeeds = [{
         id: 'feed-platform-main',
         church: 'Loveworld Global Broadcast',
         city: 'Global',
         country: '',
         protocol: 'RTMP',
         status: 'standby',
         role: 'available',
         quality: '—',
         bitrate: '—',
         latency: '—',
         viewers: 0,
         inputId: streamKey,
         hlsUrl: `${hlsBase}/${streamKey}/index.m3u8`,
       }];

     document.getElementById('activeChannelName').textContent = 'Loveworld Global Broadcast';
     document.getElementById('activeHlsEndpoint').textContent = `${hlsBase}/${streamKey}/index.m3u8`.replace('https://', '');
     document.getElementById('activeRtmpEndpoint').textContent = rtmpUrl;
   }

// Render broadcast control room
   LWUI.renderBroadcastNetwork('all');

  const recentServerFeeds = new Map();
  const FEED_HOLD_MS = 90000;

  // ── Connect to local RTMP server if running ──────────────────────
  // Polls http://localhost:3001/api/feeds every 5s.
  // When OBS connects, the feed appears in the Church Ingest Feeds list.
  // When the server is offline, the UI falls back to mock data silently.
  LWAPI.startPolling(
    // onUpdate — server is online and returned feeds
    (data) => {
      const { feeds, programKey } = data;

      // Hide any server-offline banner
      const banner = document.getElementById('offlineBanner');
      if (banner && !banner.hidden && banner.dataset.reason === 'server') {
        banner.hidden = true;
      }

      // Refresh credential manager if admin
      if (LWUI.isAdmin()) refreshCredentialManager();

      const now = Date.now();

      // Merge server data with a short client-side hold to avoid visual
      // flicker during encoder reconnects or one missed API poll.
       feeds.forEach(f => {
         recentServerFeeds.set(f.id, { feed: f, seenAt: now });
       });

       for (const [id, entry] of recentServerFeeds.entries()) {
         if (now - entry.seenAt > FEED_HOLD_MS) recentServerFeeds.delete(id);
       }

       const stableFeeds = Array.from(recentServerFeeds.values()).map(entry => {
         const isCurrent = now - entry.seenAt < 30000;
         return isCurrent ? entry.feed : { ...entry.feed, status: 'reconnecting' };
       });

       const serverFeeds = stableFeeds.map(f => ({
         id: f.id,
         church: f.church,
         city: f.city || 'Local',
         country: f.country || '',
         protocol: f.protocol,
         status: f.status,
         role: f.role,
         quality: '—',
         bitrate: f.bitrate || '—',
         latency: f.latency || '—',
         viewers: f.viewers || 0,
         inputId: f.id,
         hlsUrl: f.hlsUrl,
       }));

       LW_DATA.broadcastFeeds = serverFeeds;

      // Update program monitor if a program is set
      if (programKey) {
        const prog = stableFeeds.find(f => f.church === programKey);
        if (prog) {
          document.getElementById('programRegion').textContent = prog.city || 'Local';
          document.getElementById('programTitle').textContent = prog.church;
          document.getElementById('programMeta').textContent = `RTMP · ${prog.hlsUrl}`;
          document.getElementById('activeHlsEndpoint').textContent = prog.hlsUrl.replace('http://', '');
          document.getElementById('activeRtmpEndpoint').textContent = LWAPI.getRtmpUrl();
          document.getElementById('activeChannelName').textContent = prog.church;
        }
      }

      // Update metrics
      const liveCount = stableFeeds.filter(f => f.status === 'live' || f.status === 'reconnecting').length;
      document.getElementById('liveInputCount').textContent = String(liveCount);
      const totalViewers = stableFeeds.reduce((n, f) => n + (f.viewers || 0), 0);
      document.getElementById('cdnViewerCount').textContent = formatCount(totalViewers);

      // Update server status indicator
      const statusEl = document.getElementById('serverStatusText');
      if (statusEl) {
        statusEl.textContent = 'Online';
        statusEl.className = 'health-text';
      }

      // Re-render
      const activeFilter = document.querySelector('#feedStatusFilter button.active')?.dataset.feedStatus || 'all';
      LWUI.renderBroadcastNetwork(activeFilter);
    },

    // onOffline — server not running
     () => {
       const banner = document.getElementById('offlineBanner');
       if (banner) {
         banner.hidden = false;
         banner.dataset.reason = 'server';
         document.getElementById('offlineMsg').textContent =
           'Broadcast server not connected. Start the local server to receive live feeds.';
       }
       const statusEl = document.getElementById('serverStatusText');
       if (statusEl) {
         statusEl.textContent = 'Offline';
         statusEl.className = '';
         statusEl.style.color = 'var(--text-dim)';
       }
       LWUI.renderBroadcastNetwork('all');
     }
  );

  // ================================================================
  // 2. NAVIGATION — view switching
  // ================================================================
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      LWUI.switchView(btn.dataset.view);
    });
  });

  // ================================================================
  // 2B. MEETING DASHBOARD CONTROLS
  // ================================================================
  const meetingIdInput = document.getElementById('meetingIdInput');
  function openMeetingRoom(title = 'Loveworld Meeting Room') {
    LWPlayer.openMeeting(title, LW_DATA.channels[0].viewerCount);
  }

  document.getElementById('headerJoinBtn')?.addEventListener('click', () => {
    LWUI.switchView('meeting');
    setTimeout(() => meetingIdInput?.focus(), 80);
  });

  document.getElementById('startMeetingBtn')?.addEventListener('click', () => {
    LWUI.showToast('Starting your hosted meeting room...', 'info');
    setTimeout(() => openMeetingRoom('Hosted Loveworld Meeting'), 500);
  });

  document.getElementById('scheduleMeetingBtn')?.addEventListener('click', () => {
    LWUI.switchView('events');
    LWUI.showToast('Use the events calendar to schedule the next meeting.', 'info');
  });

  document.getElementById('joinMeetingForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const meetingId = meetingIdInput?.value.trim();
    if (!meetingId) {
      LWUI.showToast('Enter a meeting ID or access code first.', 'warning');
      meetingIdInput?.focus();
      return;
    }
    LWUI.showToast(`Joining meeting ${meetingId}...`, 'success');
    setTimeout(() => openMeetingRoom(`Meeting ${meetingId}`), 500);
  });

  document.getElementById('copyInviteBtn')?.addEventListener('click', async () => {
    const invite = 'Loveworld Meeting\nMeeting ID: 348 912 704\nAccess Code: LW-LIVE\nDial-in: +27 10 500 0912';
    try {
      await navigator.clipboard.writeText(invite);
      LWUI.showToast('Meeting invite copied.', 'success');
    } catch {
      LWUI.showToast('Invite ready: Meeting ID 348 912 704, access code LW-LIVE.', 'info');
    }
  });

  document.getElementById('accountSettingsBtn')?.addEventListener('click', () => {
    LWUI.openAuthModal();
  });

  document.getElementById('newMeetingBtn')?.addEventListener('click', () => {
    LWUI.showToast('New meeting details are ready to configure.', 'info');
  });

  document.getElementById('recordingsBtn')?.addEventListener('click', () => {
    LWUI.showToast('Opening cloud recordings...', 'info');
  });

  document.querySelectorAll('.meeting-list-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (meetingIdInput) meetingIdInput.value = btn.dataset.meeting || '';
      LWUI.showToast(`Joining ${btn.dataset.meeting}...`, 'success');
      setTimeout(() => openMeetingRoom(btn.dataset.meeting || 'Loveworld Meeting Room'), 500);
    });
  });

  // ================================================================
  // 2C. BROADCAST NETWORK CONTROLS
  // ================================================================

  // ── Credential Manager (admin only) ─────────────────────────────
  function refreshCredentialManager() {
    if (!LWUI.isAdmin()) return;
    const section = document.getElementById('credentialManager');
    if (section) section.hidden = false;

    if (!LWAPI.isOnline()) {
      document.getElementById('credentialList').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔌</div>
          <h3>Server offline</h3>
          <p>Start the platform API server to create real 5centsCDN RTMP and HLS credentials.</p>
        </div>`;
      return;
    }

    LWAPI.getCredentials().then(({ credentials, rtmpUrl }) => {
      const list = document.getElementById('credentialList');
      if (!list) return;

      // Update RTMP URL display in delivery panel
      document.getElementById('activeRtmpEndpoint').textContent = rtmpUrl;

      if (credentials.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">🔑</div>
            <h3>No credentials yet</h3>
            <p>Click <strong>New Credential</strong> to generate RTMP details for a church or station.</p>
          </div>`;
        return;
      }

      list.innerHTML = credentials.map(c => `
        <article class="cred-row ${c.isLive ? 'live' : ''}" role="listitem" data-key="${escapeForAttr(c.streamKey)}">
          <div class="cred-identity">
            <span class="cred-type-badge">${c.type === 'station' ? '📡' : c.type === 'event' ? '🎪' : '⛪'}</span>
            <div>
              <strong>${escapeHtml(c.name)}</strong>
              <small>${c.city ? escapeHtml(c.city) + ' · ' : ''}${c.type}</small>
            </div>
            ${c.isLive ? '<span class="status-pill live">Live</span>' : '<span class="status-pill">Ready</span>'}
          </div>
          <div class="cred-endpoints">
            <div class="cred-endpoint-row">
              <span>RTMP Server</span>
              <code>${escapeHtml(c.rtmpUrl)}</code>
              <button class="btn-copy-key" data-copy-val="${escapeForAttr(c.rtmpUrl)}" aria-label="Copy RTMP URL">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <div class="cred-endpoint-row">
              <span>Stream Key</span>
              <code class="stream-key-value masked" id="cred-key-${escapeForAttr(c.streamKey)}">${maskStreamKey(c.streamKey)}</code>
              <button class="btn-reveal-key" data-key="${escapeForAttr(c.streamKey)}" aria-label="Reveal stream key">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              </button>
              <button class="btn-copy-key" data-copy-val="${escapeForAttr(c.streamKey)}" aria-label="Copy stream key">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
            <div class="cred-endpoint-row">
              <span>HLS Playback</span>
              <code>${escapeHtml(c.hlsUrl)}</code>
              <button class="btn-copy-key" data-copy-val="${escapeForAttr(c.hlsUrl)}" aria-label="Copy HLS URL">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
              </button>
            </div>
          </div>
          <div class="cred-actions">
            <button class="btn-secondary cred-copy-all-btn" data-key="${escapeForAttr(c.streamKey)}"
              data-rtmp="${escapeForAttr(c.rtmpUrl)}" data-stream-key="${escapeForAttr(c.streamKey)}" data-hls="${escapeForAttr(c.hlsUrl)}" data-name="${escapeForAttr(c.name)}">
              Copy All
            </button>
            <button class="btn-secondary cred-revoke-btn" data-key="${escapeForAttr(c.streamKey)}" data-name="${escapeForAttr(c.name)}">
              Revoke
            </button>
          </div>
        </article>
      `).join('');

      // Wire copy buttons
      list.querySelectorAll('.btn-copy-key[data-copy-val]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(btn.dataset.copyVal); LWUI.showToast('Copied!', 'success'); }
          catch { LWUI.showToast(btn.dataset.copyVal, 'info'); }
        });
      });

      // Wire reveal buttons
      list.querySelectorAll('.btn-reveal-key').forEach(btn => {
        btn.addEventListener('click', () => {
          const cred = credentials.find(c => c.streamKey === btn.dataset.key);
          if (!cred) return;
          const el = document.getElementById(`cred-key-${btn.dataset.key}`);
          if (!el) return;
          const isRevealed = el.classList.contains('revealed');
          el.textContent = isRevealed ? maskStreamKey(cred.streamKey) : cred.streamKey;
          el.classList.toggle('revealed', !isRevealed);
          el.classList.toggle('masked', isRevealed);
        });
      });

      // Wire copy-all buttons
      list.querySelectorAll('.cred-copy-all-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const text = `${btn.dataset.name} — OBS Stream Settings\nRTMP Server: ${btn.dataset.rtmp}\nStream Key:  ${btn.dataset.streamKey}\nHLS Playback: ${btn.dataset.hls}`;
          try { await navigator.clipboard.writeText(text); LWUI.showToast(`${btn.dataset.name} credentials copied.`, 'success'); }
          catch { LWUI.showToast('Copy failed — check browser permissions.', 'warning'); }
        });
      });

      // Wire revoke buttons
      list.querySelectorAll('.cred-revoke-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(`Revoke stream key for "${btn.dataset.name}"? This cannot be undone.`)) return;
          try {
            await LWAPI.revokeCredential(btn.dataset.key);
            LWUI.showToast(`${btn.dataset.name} stream key revoked.`, 'success');
            refreshCredentialManager();
          } catch (err) {
            LWUI.showToast(`Failed to revoke: ${err.message}`, 'error');
          }
        });
      });
    }).catch(err => {
      console.warn('[CredManager] Failed to load credentials:', err.message);
    });
  }

  function escapeForAttr(str) {
    return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function maskStreamKey(key) {
    if (!key || key.length < 8) return '••••••••';
    return key.slice(0, 6) + '••••••••' + key.slice(-4);
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function slugifyStreamName(name) {
    return String(name || 'stream')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'stream';
  }

  function createLocalCredential({ name, type = 'church', city = '' }) {
    const streamKey = `${slugifyStreamName(name)}-${Math.random().toString(36).slice(2, 8)}`;
    const rtmpUrl = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL) || 'rtmp://localhost/live';
    const hlsBase = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_HLS_BASE) || 'http://localhost:8000/live';

    return {
      id: `cred-local-${Date.now()}`,
      name,
      type,
      city,
      streamKey,
      rtmpUrl,
      hlsUrl: `${hlsBase}/${streamKey}/index.m3u8`,
      localOnly: true,
    };
  }

  function addCredentialFeed(cred) {
    const exists = LW_DATA.broadcastFeeds.some(feed => feed.inputId === cred.streamKey);
    if (exists) return;

    LW_DATA.broadcastFeeds.push({
      id: `feed-${Date.now()}`,
      church: cred.name,
      city: cred.city || '',
      country: '',
      protocol: 'RTMP',
      status: 'standby',
      role: 'available',
      quality: '—',
      bitrate: '—',
      latency: '—',
      viewers: 0,
      inputId: cred.streamKey,
      hlsUrl: cred.hlsUrl,
    });

    LWUI.renderBroadcastNetwork('all');
  }

  function showCredentialReveal(cred) {
    document.getElementById('revealRtmpUrl').textContent = cred.rtmpUrl;
    document.getElementById('revealStreamKey').textContent = cred.streamKey;
    document.getElementById('revealHlsUrl').textContent = cred.hlsUrl;
    document.getElementById('credReveal').hidden = false;
    document.getElementById('credFormWrap').hidden = true;

    document.querySelectorAll('#credReveal .btn-copy-key').forEach(copyBtn => {
      copyBtn.onclick = async () => {
        const val = document.getElementById(copyBtn.dataset.copyTarget)?.textContent || '';
        try { await navigator.clipboard.writeText(val); LWUI.showToast('Copied!', 'success'); }
        catch { LWUI.showToast(val, 'info'); }
      };
    });

    document.getElementById('credCopyAll').onclick = async () => {
      const text = `${cred.name} — OBS Stream Settings\nRTMP Server: ${cred.rtmpUrl}\nStream Key:  ${cred.streamKey}\nHLS Playback: ${cred.hlsUrl}`;
      try { await navigator.clipboard.writeText(text); LWUI.showToast('All credentials copied.', 'success'); }
      catch { LWUI.showToast('Copy failed.', 'warning'); }
    };
  }

  // New credential button
  document.getElementById('newCredentialBtn')?.addEventListener('click', () => {
    document.getElementById('credFormWrap').hidden = false;
    document.getElementById('credReveal').hidden = true;
    document.getElementById('credName').focus();
  });

  document.getElementById('credFormCancel')?.addEventListener('click', () => {
    document.getElementById('credFormWrap').hidden = true;
    document.getElementById('credentialForm').reset();
  });

  document.getElementById('credentialForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('credName').value.trim();
    const city = document.getElementById('credCity').value.trim();
    const type = document.getElementById('credType').value;
    const errEl = document.getElementById('credNameErr');

    if (!name) { errEl.textContent = 'Name is required.'; document.getElementById('credName').focus(); return; }
    errEl.textContent = '';

    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Generating…';

    try {
      const cred = await LWAPI.createCredential({ name, type, city });

      showCredentialReveal(cred);
      e.target.reset();
      LWUI.showToast(`${name} credentials generated. Copy them now!`, 'success');
      refreshCredentialManager();
    } catch (err) {
      if (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.CDN_ENABLED) {
        LWUI.showToast(`Could not reach the platform API server: ${err.message}. Start the server, then create the 5centsCDN credential again.`, 'error');
        return;
      }
      const cred = createLocalCredential({ name, type, city });
      showCredentialReveal(cred);
      addCredentialFeed(cred);
      e.target.reset();
      LWUI.showToast(`${name} credentials generated locally. Start the broadcast server to save it.`, 'warning');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate RTMP + Stream Key';
    }
  });  const provisionPanel = document.getElementById('provisionPanel');
  const channelPanel = document.getElementById('channelPanel');
  const routePanel = document.getElementById('routePanel');
  const closeBroadcastPanels = () => {
    provisionPanel.hidden = true;
    channelPanel.hidden = true;
    routePanel.hidden = true;
  };

  document.getElementById('addFeedBtn')?.addEventListener('click', () => {
    closeBroadcastPanels();
    provisionPanel.hidden = false;
    document.getElementById('feedChurchName').focus();
  });

  document.getElementById('provisionClose')?.addEventListener('click', () => {
    provisionPanel.hidden = true;
  });

  document.getElementById('createChannelBtn')?.addEventListener('click', () => {
    closeBroadcastPanels();
    channelPanel.hidden = false;
    document.getElementById('newChannelName').focus();
  });

  document.getElementById('channelPanelClose')?.addEventListener('click', () => {
    channelPanel.hidden = true;
  });

  document.getElementById('addRouteBtn')?.addEventListener('click', () => {
    closeBroadcastPanels();
    routePanel.hidden = false;
    document.getElementById('routeName').focus();
  });

  document.getElementById('routePanelClose')?.addEventListener('click', () => {
    routePanel.hidden = true;
  });

  document.getElementById('provisionFeedForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const church = document.getElementById('feedChurchName').value.trim();
    const city = document.getElementById('feedCity').value.trim();
    const protocol = document.getElementById('feedProtocol').value;
    if (!church || !city) return;

    // Show credential manager section and scroll to it
    const credSection = document.getElementById('credentialManager');
    if (credSection && LWUI.isAdmin()) {
      credSection.hidden = false;
      // Reset reveal panel
      document.getElementById('credReveal').hidden = true;
      document.getElementById('credFormWrap').hidden = true;
    }

    LWUI.provisionFeed({ church, city, protocol });
    e.target.reset();
    provisionPanel.hidden = true;

    // Scroll to credential manager to show the generated credentials
    if (credSection && LWUI.isAdmin()) {
      setTimeout(() => credSection.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  });

  document.getElementById('createChannelForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newChannelName').value.trim();
    const slug = document.getElementById('newChannelSlug').value.trim();
    const domain = document.getElementById('newChannelDomain').value.trim();
    if (!name || !slug || !domain) return;
    LWUI.createBroadcastChannel({ name, slug, domain });
    e.target.reset();
    document.getElementById('newChannelDomain').value = 'live.loveworld.tv';
    channelPanel.hidden = true;
  });

  document.getElementById('createRouteForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('routeName').value.trim();
    const destination = document.getElementById('routeUrl').value.trim();
    const kind = document.getElementById('routeKind').value;
    if (!name || !destination) return;
    LWUI.createDistributionRoute({ name, destination, kind });
    e.target.reset();
    routePanel.hidden = true;
  });

  document.querySelectorAll('#feedStatusFilter button').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('#feedStatusFilter button').forEach(item => item.classList.remove('active'));
      button.classList.add('active');
      LWUI.renderBroadcastNetwork(button.dataset.feedStatus);
    });
  });

  document.getElementById('copyPlaybackBtn')?.addEventListener('click', async () => {
    const playbackUrl = LW_DATA.broadcastChannels.find(channel => channel.status === 'live')?.hlsUrl
      || 'https://live.loveworld.tv/global-main/index.m3u8';
    try {
      await navigator.clipboard.writeText(playbackUrl);
      LWUI.showToast('HLS playback URL copied.', 'success');
    } catch {
      LWUI.showToast(playbackUrl, 'info');
    }
  });

  document.getElementById('watchProgramBtn')?.addEventListener('click', () => {
    const feed = LW_DATA.broadcastFeeds.find(item => item.role === 'program');
    const activeChannel = LW_DATA.broadcastChannels.find(channel => channel.status === 'live')
      || LW_DATA.broadcastChannels[0];
    const hlsUrl = feed?.hlsUrl || activeChannel?.hlsUrl;
    const title = feed?.church || activeChannel?.name || 'Program Output';

    if (hlsUrl) {
      LWBroadcast.openPreview(title, hlsUrl);
    } else if (feed) {
      LWPlayer.openMeeting(`Program Output: ${feed.church}`, feed.viewers);
    }
  });

  document.getElementById('failoverBtn')?.addEventListener('click', () => {
    const backup = LW_DATA.broadcastFeeds.find(item => item.role === 'backup')
      || LW_DATA.broadcastFeeds.find(item => item.status === 'live' && item.role !== 'program');
    if (backup) LWUI.setProgramFeed(backup.id);
  });

  // ================================================================
  // 3. MAP CONTROLS
  // ================================================================

  // Map filter chips
  document.querySelectorAll('.map-filters .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.map-filters .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      LWMap.setFilter(chip.dataset.filter);
    });
  });

  // Map search (basic — fly to matching church/event)
  const mapSearchInput = document.getElementById('mapSearch');
  if (mapSearchInput) {
    let mapSearchTimer;
    mapSearchInput.addEventListener('input', () => {
      clearTimeout(mapSearchTimer);
      mapSearchTimer = setTimeout(() => {
        const q = mapSearchInput.value.trim().toLowerCase();
        if (!q) return;
        const church = LW_DATA.churches.find(c =>
          c.name.toLowerCase().includes(q) ||
          c.city.toLowerCase().includes(q) ||
          c.country.toLowerCase().includes(q)
        );
        if (church) {
          LWMap.flyTo(church.location.lat, church.location.lng, 12);
          LWUI.showToast(`📍 Found: ${church.name}`, 'info');
        } else {
          const event = LW_DATA.events.find(e => e.title.toLowerCase().includes(q) && e.location);
          if (event) {
            LWMap.flyTo(event.location.lat, event.location.lng, 10);
            LWUI.showToast(`📍 Found: ${event.title}`, 'info');
          }
        }
      }, 500);
    });
  }

  // Pin card close button
  document.getElementById('pinCardClose').addEventListener('click', () => {
    LWMap.closePinCard();
  });

  // ================================================================
  // 4. SIDEBAR TOGGLE
  // ================================================================
  document.getElementById('menuToggle').addEventListener('click', () => {
    LWUI.toggleSidebar();
  });

  // Close sidebar on outside click (mobile)
  document.addEventListener('click', (e) => {
    const sidebar = document.getElementById('sidebar');
    const menuBtn = document.getElementById('menuToggle');
    if (
      window.innerWidth <= 900 &&
      sidebar.classList.contains('open') &&
      !sidebar.contains(e.target) &&
      !menuBtn.contains(e.target)
    ) {
      sidebar.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // ================================================================
  // 5. CHURCH SEARCH (sidebar + churches view)
  // ================================================================
  function doChurchSearch(query) {
    LWUI.searchChurches(query);
    if (document.getElementById('view-churches').hidden) {
      LWUI.switchView('churches');
    }
  }

  const sidebarSearch = document.getElementById('churchSearch');
  const sidebarSearchBtn = document.getElementById('churchSearchBtn');
  if (sidebarSearch) {
    sidebarSearch.addEventListener('keydown', e => {
      if (e.key === 'Enter') doChurchSearch(sidebarSearch.value);
    });
  }
  if (sidebarSearchBtn) {
    sidebarSearchBtn.addEventListener('click', () => doChurchSearch(sidebarSearch?.value || ''));
  }

  const mainSearch = document.getElementById('churchSearchMain');
  const mainSearchBtn = document.getElementById('churchSearchMainBtn');
  if (mainSearch) {
    mainSearch.addEventListener('keydown', e => {
      if (e.key === 'Enter') LWUI.searchChurches(mainSearch.value);
    });
  }
  if (mainSearchBtn) {
    mainSearchBtn.addEventListener('click', () => LWUI.searchChurches(mainSearch?.value || ''));
  }

  // ================================================================
  // 6. EVENT FILTERS
  // ================================================================
  document.querySelectorAll('#view-events .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#view-events .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      LWUI.renderEvents(chip.dataset.status);
    });
  });

  // ================================================================
  // 7. ACTIVITY FEED
  // ================================================================

  // Feed panel toggle
  document.getElementById('feedToggle').addEventListener('click', () => {
    LWUI.toggleFeedPanel();
  });

  // Reaction buttons
  document.querySelectorAll('.reaction-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      LWRealtime.submitReaction(btn.dataset.type);
    });
  });

  // Check-in button
  document.getElementById('checkinBtn').addEventListener('click', () => {
    LWRealtime.submitCheckin();
  });

  // ================================================================
  // 8. VIDEO PLAYER MODAL
  // ================================================================
  // (Player close is wired inside LWPlayer.init())

  // ================================================================
  // 9. AUTH MODAL
  // ================================================================
  document.getElementById('authBtn').addEventListener('click', () => {
    LWUI.openAuthModal();
  });

  document.getElementById('authClose').addEventListener('click', () => {
    LWUI.closeAuthModal();
  });

  // Close on overlay click
  document.getElementById('authModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('authModal')) LWUI.closeAuthModal();
  });

  // Tab switching
  document.getElementById('signInTab').addEventListener('click', () => LWUI.switchAuthTab('signin'));
  document.getElementById('signUpTab').addEventListener('click', () => LWUI.switchAuthTab('signup'));

  // Form submissions
  document.getElementById('signInForm').addEventListener('submit', LWUI.handleSignIn);
  document.getElementById('signUpForm').addEventListener('submit', LWUI.handleSignUp);

  // KingsChat OAuth button
  document.getElementById('kingsChatBtn').addEventListener('click', () => {
    LWUI.closeAuthModal();
    LWUI.showToast('🔗 Redirecting to KingsChat…', 'info');
    // In production: window.location.href = '/auth/oauth/kingschat';
    setTimeout(() => {
      document.getElementById('authBtn').textContent = 'KingsChat User';
      LWUI.showToast('✅ Signed in with KingsChat!', 'success');
    }, 1500);
  });

  // ================================================================
  // 10. NOTIFICATIONS
  // ================================================================
  document.getElementById('notifBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    LWUI.toggleNotifPanel();
  });

  document.getElementById('markAllRead').addEventListener('click', () => {
    LWUI.markAllRead();
  });

  // Close notification panel on outside click
  document.addEventListener('click', (e) => {
    const panel = document.getElementById('notifPanel');
    const btn   = document.getElementById('notifBtn');
    if (!panel.hidden && !panel.contains(e.target) && !btn.contains(e.target)) {
      panel.hidden = true;
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  // ================================================================
  // 11. GLOBAL KEYBOARD SHORTCUTS
  // ================================================================
  document.addEventListener('keydown', (e) => {
    // Escape: close any open modal/panel
    if (e.key === 'Escape') {
      ['provisionPanel', 'channelPanel', 'routePanel'].forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) panel.hidden = true;
      });
      if (!document.getElementById('broadcastPreviewModal').hidden) LWBroadcast.close();
      if (!document.getElementById('authModal').hidden)   LWUI.closeAuthModal();
      if (!document.getElementById('playerModal').hidden) LWPlayer.close();
      if (!document.getElementById('notifPanel').hidden) {
        document.getElementById('notifPanel').hidden = true;
        document.getElementById('notifBtn').setAttribute('aria-expanded', 'false');
      }
      LWMap.closePinCard();
    }
  });

  // ================================================================
  // 12. INITIAL GLOBAL COUNTER DISPLAY
  // ================================================================
  document.getElementById('globalCount').textContent = formatCount(3_847_291);
  document.getElementById('prayerCount').textContent = formatCount(2_847_391);

  console.info('[LoveworldLive] App initialised ✓');
});
