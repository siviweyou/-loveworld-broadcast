/**
 * LOVEWORLD NETWORKS LIVE — Broadcast Server API Module
 *
 * Connects the platform to the broadcast API server.
 * Server URL is configured in js/config.js — change it there
 * when you deploy the RTMP server to a VPS or cloud host.
 */

const LWAPI = (() => {
  const BASE = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.BROADCAST_SERVER_URL)
    ? LW_CONFIG.BROADCAST_SERVER_URL.replace(/\/$/, '')
    : 'http://localhost:3001';

  let pollTimer = null;
  let serverOnline = false;
  let _rtmpUrl = (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.DEFAULT_RTMP_URL)
    ? LW_CONFIG.DEFAULT_RTMP_URL
    : 'rtmp://your-server/live';

  function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (typeof LW_CONFIG !== 'undefined' && LW_CONFIG.API_SECRET) {
      headers['X-API-Secret'] = LW_CONFIG.API_SECRET;
    }
    return headers;
  }

  async function apiFetch(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      signal: options.signal || AbortSignal.timeout(15000),
    });
    return res;
  }

  async function checkServer() {
    let retries = 3;
    let delay = 1000;
    let lastError = null;
    let responseTime = null;
    
    for (let i = 0; i < retries; i++) {
      const startTime = Date.now();
      try {
        const res = await apiFetch('/api/status');
        responseTime = Date.now() - startTime;
        
        if (res.ok) {
          const data = await res.json();
          // Server tells us the real RTMP URL — no hardcoding needed
          if (data.rtmpUrl) _rtmpUrl = data.rtmpUrl;
          
          // Track health metrics
          trackHealthMetrics({
            success: true,
            responseTime,
            retryCount: i,
            errorType: null
          });
          
          return true;
        }
      } catch (err) {
        responseTime = Date.now() - startTime;
        lastError = err;
        
        // Distinguish timeout errors from other errors
        const isTimeoutError = err.name === 'AbortError' || err.name === 'TimeoutError' || 
                              err.message.includes('timeout') || err.message.includes('aborted');
        
        // Track health metrics
        trackHealthMetrics({
          success: false,
          responseTime,
          retryCount: i,
          errorType: isTimeoutError ? 'timeout' : 'other'
        });
        
        if (i === retries - 1) {
          console.warn('[LWAPI] checkServer failed after all retries:', err.message, 
                      isTimeoutError ? '(timeout)' : '(other error)');
        } else {
          console.debug(`[LWAPI] checkServer retry ${i + 1}/${retries}:`, 
                       isTimeoutError ? 'Timeout' : 'Error', '- waiting', delay, 'ms');
        }
      }
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff: 1s, 2s, 4s
      }
    }
    
    return false;
  }

  // Health metrics tracking
  const healthMetrics = {
    totalChecks: 0,
    successfulChecks: 0,
    timeoutErrors: 0,
    otherErrors: 0,
    totalResponseTime: 0,
    lastResponseTime: null,
    lastError: null,
    lastSuccessTime: null
  };
  
  function trackHealthMetrics({ success, responseTime, retryCount, errorType }) {
    healthMetrics.totalChecks++;
    healthMetrics.totalResponseTime += responseTime;
    healthMetrics.lastResponseTime = responseTime;
    
    if (success) {
      healthMetrics.successfulChecks++;
      healthMetrics.lastSuccessTime = Date.now();
      healthMetrics.lastError = null;
    } else {
      healthMetrics.lastError = { type: errorType, retryCount, timestamp: Date.now() };
      if (errorType === 'timeout') {
        healthMetrics.timeoutErrors++;
      } else {
        healthMetrics.otherErrors++;
      }
    }
  }
  
  function getHealthMetrics() {
    const successRate = healthMetrics.totalChecks > 0 
      ? (healthMetrics.successfulChecks / healthMetrics.totalChecks * 100).toFixed(1)
      : 0;
    
    const avgResponseTime = healthMetrics.totalChecks > 0
      ? Math.round(healthMetrics.totalResponseTime / healthMetrics.totalChecks)
      : 0;
    
    return {
      ...healthMetrics,
      successRate: `${successRate}%`,
      avgResponseTime: `${avgResponseTime}ms`,
      uptime: healthMetrics.lastSuccessTime 
        ? `${Math.round((Date.now() - healthMetrics.lastSuccessTime) / 1000)}s ago`
        : 'unknown'
    };
  }

  async function getFeeds() {
    const res = await apiFetch('/api/feeds');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.json();
  }

  // ── Credential management ────────────────────────────────────────

  async function getCredentials() {
    const res = await apiFetch('/api/credentials');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    return res.json();
  }

  async function createCredential({ name, type, city }) {
    const res = await apiFetch('/api/credentials', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, type, city }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }
    return res.json();
  }

  async function revokeCredential(streamKey) {
    const res = await apiFetch(`/api/credentials/${encodeURIComponent(streamKey)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }
    return res.json();
  }

  // ── Program output ───────────────────────────────────────────────

  async function setProgram(streamKey) {
    const res = await apiFetch('/api/program', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ key: streamKey }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }
    return res.json();
  }

  async function registerExternalFeed({ streamKey, name, city, protocol }) {
    const res = await apiFetch('/api/feeds/manual', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ streamKey, name, city, protocol }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Server returned ${res.status}`);
    }
    return res.json();
  }

  // ── Polling ──────────────────────────────────────────────────────

  function startPolling(onUpdate, onOffline) {
    stopPolling();
    let consecutiveFailures = 0;
    const MAX_FAILURES = 2;

    async function tick() {
      const online = await checkServer();
      if (!online) {
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          if (serverOnline) {
            serverOnline = false;
            onOffline && onOffline();
          }
        }
        return;
      }
      
      consecutiveFailures = 0;
      serverOnline = true;
      try {
        const data = await getFeeds();
        onUpdate && onUpdate(data);
      } catch (err) {
        console.warn('[LWAPI] Feed fetch failed:', err.message);
      }
    }

    tick();
    pollTimer = setInterval(tick, 5000);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function isOnline() { return serverOnline; }
  function getRtmpUrl() { return _rtmpUrl; }
  function getHealthMetrics() { return healthMetrics; }

  return {
    checkServer, getFeeds,
    getCredentials, createCredential, revokeCredential,
    setProgram, registerExternalFeed, startPolling, stopPolling,
    isOnline, getRtmpUrl, getHealthMetrics,
  };
})();
