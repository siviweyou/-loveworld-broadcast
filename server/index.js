/**
 * LOVEWORLD NETWORKS — Broadcast Server
 *
 * Receives OBS/encoder streams over RTMP, serves HLS playback,
 * and provides REST API for stream credentials. 5centsCDN can sit in front
 * of the HLS output as the global CDN layer.
 *
 * Usage:
 *   node index.js                    # Local mode (port 1935)
 *   SERVER_HOST=yourdomain node index.js  # Production with custom domain
 */

const NodeMediaServer = require('node-media-server');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

function loadEnvFile(filePath) {
  try {
    const env = fs.readFileSync(filePath, 'utf8');
    env.split(/\r?\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) return;
      const eq = trimmed.indexOf('=');
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
      if (key && process.env[key] === undefined) process.env[key] = value;
    });
  } catch {
    // .env is optional; production hosts normally provide environment variables.
  }
}

loadEnvFile(path.join(__dirname, '.env'));

// ── Configuration ──────────────────────────────────────────────────────────
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const RTMP_PORT = parseInt(process.env.RTMP_PORT || '1935', 10);
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '8000', 10);
const API_PORT = parseInt(process.env.API_PORT || '3001', 10);
const STORAGE_ENABLED = process.env.STORAGE_ENABLED === 'true';
const FIVECENTS_API_BASE = process.env.FIVECENTS_API_BASE || 'https://api.5centscdn.com/v2';
const FIVECENTS_API_KEY = process.env.FIVECENTS_API_KEY || '';
const FIVECENTS_ACCOUNT_ID = process.env.FIVECENTS_ACCOUNT_ID || '10244';
const FIVECENTS_API_PROFILE_ID = process.env.FIVECENTS_API_PROFILE_ID || '1151';
const FIVECENTS_STREAM_SERVER = parseInt(process.env.FIVECENTS_STREAM_SERVER || '209', 10);
const MANUAL_PUSH_RTMP_URL = process.env.MANUAL_PUSH_RTMP_URL || '';
const MANUAL_PUSH_STREAM_KEY = process.env.MANUAL_PUSH_STREAM_KEY || '';
const MANUAL_PUSH_HLS_URL = process.env.MANUAL_PUSH_HLS_URL || '';
const API_SECRET = process.env.API_SECRET || '';

const RTMP_URL = `rtmp://${SERVER_HOST}${RTMP_PORT !== 1935 ? ':' + RTMP_PORT : ''}/live`;
const HLS_BASE = `http://${SERVER_HOST}:${HTTP_PORT}/live`;

const CDN_ENABLED = Boolean(FIVECENTS_API_KEY);
const MANUAL_PUSH_ENABLED = Boolean(MANUAL_PUSH_RTMP_URL && MANUAL_PUSH_STREAM_KEY);
let cdnStreams = new Map();

const CREDS_FILE = path.join(__dirname, 'credentials.json');
let credentials = {};

function loadCredentials() {
  try {
    credentials = JSON.parse(fs.readFileSync(CREDS_FILE, 'utf8'));
    console.log(`[CREDS] Loaded ${Object.keys(credentials).length} credential(s).`);
  } catch {
    credentials = {};
  }
}

function saveCredentials() {
  fs.writeFileSync(CREDS_FILE, JSON.stringify(credentials, null, 2));
}

function generateStreamKey(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const rand = crypto.randomBytes(6).toString('hex');
  return `${slug}-${rand}`;
}

function make5centsStreamName(name) {
  const base = String(name || 'live')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 24)
    .padEnd(4, 'x');
  const stream = crypto.randomBytes(4).toString('hex');
  return `${base}/${stream}`;
}

function findDeep(value, predicate) {
  if (!value || typeof value !== 'object') return undefined;
  const stack = [value];
  const seen = new Set();
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    seen.add(item);
    for (const [key, child] of Object.entries(item)) {
      if (predicate(key, child)) return child;
      if (child && typeof child === 'object') stack.push(child);
    }
  }
  return undefined;
}

// ── API Authentication Middleware ───────────────────────────────────────────
function checkAuth(req) {
  const authHeader = req.headers['x-api-secret'];
  if (!API_SECRET) return true;
  return authHeader === API_SECRET;
}

function sendAuthError(res) {
  res.writeHead(401);
  res.end(JSON.stringify({ error: 'Unauthorized. Set X-API-Secret header.' }));
}

loadCredentials();

// ── Node Media Server ───────────────────────────────────────────────────────
const nms = new NodeMediaServer({
  rtmp: {
    port: RTMP_PORT,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
  http: {
    port: HTTP_PORT,
    mediaroot: path.join(__dirname, 'media'),
    allow_origin: '*',
  },
  trans: {
    ffmpeg: ffmpegPath,
    tasks: [
      {
        app: 'live',
        hls: true,
        hlsFlags: '[hls_time=2:hls_list_size=6:hls_flags=delete_segments]',
        hlsKeep: false,
        dash: false,
      },
    ],
  },
});

const activeFeeds = new Map();
let programKey = null;
const disconnectTimers = new Map();
const DISCONNECT_GRACE_MS = parseInt(process.env.DISCONNECT_GRACE_MS || '30000', 10);
const HLS_STALE_MS = parseInt(process.env.HLS_STALE_MS || '90000', 10);
const MEDIA_LIVE_DIR = path.join(__dirname, 'media', 'live');

// ── 5centsCDN Integration ─────────────────────────────────────────────────
async function call5cents(pathname, { method = 'GET', body } = {}) {
  if (!CDN_ENABLED || !FIVECENTS_API_KEY) {
    console.log('[5CENTS] API key missing; CDN mode is disabled.');
    return null;
  }

  const response = await fetch(`${FIVECENTS_API_BASE}${pathname}`, {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'X-API-KEY': FIVECENTS_API_KEY,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; }
  catch { data = { raw: text }; }

  if (!response.ok || data?.result === 'error') {
    let message = data?.error?.message || data?.message || data?.raw || `5centsCDN returned ${response.status}`;
    if (/not allowed/i.test(message)) {
      message = '5centsCDN rejected this API key/profile. Enable Livestreams/Push Streams permission for the API credential, then try again.';
    }
    throw new Error(message);
  }

  return data;
}

function normalize5centsPush(data, streamName) {
  const stream = data?.stream || data?.data?.stream || data?.data || data;
  const playback = stream?.playbackurls || data?.playbackurls || findDeep(stream, key => key === 'playbackurls') || {};
  const fmsUrl = stream?.fms?.server?.meta?.fmsUrl || findDeep(stream, key => key === 'fmsUrl');
  const hlsUrl = playback.hls || stream?.hls || findDeep(stream, (key, value) => key === 'hls' && typeof value === 'string' && value.includes('.m3u8'));
  const playbackRtmp = playback.rtmp || stream?.rtmp || findDeep(stream, key => key === 'rtmp');
  const ingestServer = fmsUrl || (typeof playbackRtmp === 'string' ? playbackRtmp.replace(new RegExp(`/${streamName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '') : '');

  return {
    cdnId: stream?.id || data?.id || data?.stream_id || '',
    streamName: stream?.name || streamName,
    rtmpUrl: ingestServer || playbackRtmp || '',
    streamKey: stream?.name || streamName,
    playbackRtmp: playbackRtmp || '',
    hlsUrl: hlsUrl || '',
    raw: data,
  };
}

async function create5centsPushCredential(name) {
  if (MANUAL_PUSH_ENABLED) {
    return {
      cdnId: 'manual-5cents-push',
      streamName: MANUAL_PUSH_STREAM_KEY,
      rtmpUrl: MANUAL_PUSH_RTMP_URL,
      streamKey: MANUAL_PUSH_STREAM_KEY,
      playbackRtmp: `${MANUAL_PUSH_RTMP_URL}/${MANUAL_PUSH_STREAM_KEY}`,
      hlsUrl: MANUAL_PUSH_HLS_URL || `${HLS_BASE}/${MANUAL_PUSH_STREAM_KEY}/index.m3u8`,
      manual: true,
    };
  }

  const streamName = make5centsStreamName(name);
  const data = await call5cents('/streams/push/new', {
    method: 'POST',
    body: {
      name: streamName,
      server: FIVECENTS_STREAM_SERVER,
      codec: 'h264',
      protocols: ['RTMP', 'HLS'],
      domainlock: { enabled: 'N', policy: 'N', list: [], noreferer: 'N', ips: [] },
      geoblock: { enabled: 'N', policy: 'N', list: [], ips: [] },
      ipaccess: { enabled: 'N', policy: 'N', list: [], ips: [] },
    },
  });

  const normalized = normalize5centsPush(data, streamName);
  if (!normalized.rtmpUrl) {
    throw new Error('5centsCDN created the stream but did not return an encoder RTMP/FMS URL yet. Try refreshing credentials in a few seconds.');
  }
  return normalized;
}

async function createCDNStream(key, name) {
  if (!CDN_ENABLED || !FIVECENTS_API_KEY) return null;

  try {
    const cdnInfo = await create5centsPushCredential(name);
    cdnStreams.set(key, {
      cdnId: cdnInfo.cdnId,
      cdnUrl: cdnInfo.hlsUrl,
      playbackUrl: cdnInfo.hlsUrl,
      createdAt: new Date().toISOString(),
    });
    return cdnStreams.get(key);
  } catch (error) {
    console.error(`[5CENTS] Error creating stream for "${name}":`, error.message);
    return null;
  }
}

async function deleteCDNStream(key) {
  const cdnInfo = cdnStreams.get(key);
  if (!cdnInfo || !CDN_ENABLED) return;

  try {
    await call5cents(`/streams/push/${cdnInfo.cdnId}`, { method: 'DELETE' });
    console.log(`[CDN] Deleted CDN stream for key: ${key}`);
  } catch (error) {
    console.error(`[CDN] Error deleting stream for key ${key}:`, error.message);
  } finally {
    cdnStreams.delete(key);
  }
}

function getFreshHlsManifests() {
  try {
    return fs.readdirSync(MEDIA_LIVE_DIR, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => {
        const key = entry.name;
        const manifest = path.join(MEDIA_LIVE_DIR, key, 'index.m3u8');
        try {
          const stat = fs.statSync(manifest);
          return { key, manifest, ageMs: Date.now() - stat.mtimeMs };
        } catch {
          return null;
        }
      })
      .filter(item => item && item.ageMs <= HLS_STALE_MS);
  } catch {
    return [];
  }
}

function upsertHlsBackedFeeds() {
  getFreshHlsManifests().forEach(({ key }) => {
    const cred = credentials[key];
    const feed = activeFeeds.get(key);
    if (feed) {
      feed.status = feed.status === 'reconnecting' ? 'live' : feed.status;
      feed.lastHlsSeenAt = new Date().toISOString();
      return;
    }

    activeFeeds.set(key, {
      key,
      name: cred?.name || key,
      type: cred?.type || 'church',
      city: cred?.city || '',
      hlsUrl: `${HLS_BASE}/${key}/index.m3u8`,
      httpFlvUrl: `http://${SERVER_HOST}:${HTTP_PORT}/live/${key}.flv`,
      cdnUrl: undefined,
      playbackUrl: `${HLS_BASE}/${key}/index.m3u8`,
      startedAt: new Date().toISOString(),
      lastHlsSeenAt: new Date().toISOString(),
      viewers: 0,
      status: 'live',
      cdnEnabled: false,
      source: 'hls-monitor',
    });
  });
}

nms.on('prePublish', async (id, StreamPath) => {
  const key = StreamPath.split('/').pop();
  const cred = credentials[key];
  const name = cred ? cred.name : key;
  
  // If there's a pending disconnect timer, clear it and restore feed to live
  if (disconnectTimers.has(key)) {
    clearTimeout(disconnectTimers.get(key));
    disconnectTimers.delete(key);
    console.log(`\n[RTMP] Stream reconnected within grace window: "${name}" (key: ${key})`);
    const feed = activeFeeds.get(key);
    if (feed) {
      feed.status = 'live';
      return;
    }
  }

  console.log(`\n[RTMP] Stream started: "${name}" (key: ${key})`);
  console.log(`       HLS: ${HLS_BASE}/${key}/index.m3u8`);
  
  const relayUrl = `http://${SERVER_HOST}:${HTTP_PORT}/live/${key}.flv`;
  
  // Immediately register feed as live so API polls see it instantly
  activeFeeds.set(key, {
    key, name,
    type: cred?.type || 'church',
    city: cred?.city || '',
    hlsUrl: `${HLS_BASE}/${key}/index.m3u8`,
    httpFlvUrl: relayUrl,
    cdnUrl: undefined,
    playbackUrl: `${HLS_BASE}/${key}/index.m3u8`,
    startedAt: new Date().toISOString(),
    viewers: 0,
    status: 'live',
    cdnEnabled: false,
  });

  // Async create CDN stream in background
  createCDNStream(key, name).then(cdnInfo => {
    if (cdnInfo) {
      const feed = activeFeeds.get(key);
      if (feed) {
        feed.cdnUrl = cdnInfo.cdnUrl;
        feed.playbackUrl = cdnInfo.playbackUrl;
        feed.cdnEnabled = true;
        console.log(`[CDN] CDN stream linked successfully for "${name}" (key: ${key})`);
      }
    }
  }).catch(error => {
    console.error(`[CDN] Failed to create/link CDN stream for "${name}" (key: ${key}):`, error.message);
  });
});

nms.on('donePublish', async (id, StreamPath) => {
  const key = StreamPath.split('/').pop();
  const feedName = activeFeeds.get(key)?.name || key;
  console.log(`\n[RTMP] Stream disconnected: "${feedName}" — waiting ${DISCONNECT_GRACE_MS / 1000}s for reconnect…`);
  
  // Mark feed as reconnecting but keep it in activeFeeds for now
  const feed = activeFeeds.get(key);
  if (feed) feed.status = 'reconnecting';

  if (disconnectTimers.has(key)) clearTimeout(disconnectTimers.get(key));
  
  // Set a timer to perform final cleanup
  const timer = setTimeout(async () => {
    upsertHlsBackedFeeds();
    const current = activeFeeds.get(key);
    if (current?.status === 'live') {
      console.log(`\n[RTMP] HLS is still fresh for "${feedName}" — keeping feed on platform.`);
      disconnectTimers.delete(key);
      return;
    }

    disconnectTimers.delete(key);
    console.log(`\n[RTMP] Grace window expired for "${feedName}" — removing feed.`);
    await deleteCDNStream(key);
    activeFeeds.delete(key);
    if (programKey === key) programKey = null;
  }, DISCONNECT_GRACE_MS);
  
  disconnectTimers.set(key, timer);
});

nms.on('prePlay', (id, StreamPath) => { const f = activeFeeds.get(StreamPath.split('/').pop()); if (f) f.viewers++; });
nms.on('donePlay', (id, StreamPath) => { const f = activeFeeds.get(StreamPath.split('/').pop()); if (f && f.viewers > 0) f.viewers--; });

// ── REST API ───────────────────────────────────────────────────────────────
const apiServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Secret');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  // GET /api/status
  if (req.method === 'GET' && url.pathname === '/api/status') {
    upsertHlsBackedFeeds();
    res.writeHead(200);
    res.end(JSON.stringify({
      ok: true,
      rtmpUrl: RTMP_URL,
      hlsBase: HLS_BASE,
      activeFeeds: activeFeeds.size,
      programKey,
      storageEnabled: STORAGE_ENABLED,
      apiSecretConfigured: Boolean(API_SECRET),
      provider: {
        name: '5centsCDN',
        apiBase: FIVECENTS_API_BASE,
        accountId: FIVECENTS_ACCOUNT_ID,
        apiProfileId: FIVECENTS_API_PROFILE_ID,
        configured: Boolean(FIVECENTS_API_KEY),
        manualPushConfigured: MANUAL_PUSH_ENABLED,
      },
    }));
    return;
  }

  // GET /api/feeds
  if (req.method === 'GET' && url.pathname === '/api/feeds') {
    upsertHlsBackedFeeds();
    const feeds = Array.from(activeFeeds.values()).map(f => ({
      id: `feed-${f.key}`, church: f.name, city: f.city, country: '', type: f.type,
      protocol: 'RTMP', status: 'live', role: f.key === programKey ? 'program' : 'available',
      hlsUrl: f.hlsUrl, httpFlvUrl: f.httpFlvUrl, cdnUrl: f.cdnUrl, playbackUrl: f.playbackUrl,
      viewers: f.viewers, startedAt: f.startedAt, cdnEnabled: f.cdnEnabled,
      bitrate: '—', latency: '—',
    }));
    res.writeHead(200);
    res.end(JSON.stringify({ feeds, programKey, cdnEnabled: CDN_ENABLED }));
    return;
  }

  // POST /api/feeds/manual - Register an external feed
  if (req.method === 'POST' && url.pathname === '/api/feeds/manual') {
    if (!checkAuth(req)) return sendAuthError(res);
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { streamKey, name = '', city = '', protocol = 'RTMP' } = JSON.parse(body);
         if (!streamKey?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Stream key is required' })); return; }
         const key = streamKey.trim();
         const feedName = name || key;
         const feed = {
           key,
           name: feedName,
           type: 'church',
           city: city || '',
           hlsUrl: `${HLS_BASE}/${key}/index.m3u8`,
           httpFlvUrl: `http://${SERVER_HOST}:${HTTP_PORT}/live/${key}.flv`,
           startedAt: new Date().toISOString(),
           viewers: 0,
           status: 'live',
           protocol: protocol || 'RTMPS',
         };
        activeFeeds.set(key, feed);
        console.log(`\n[MANUAL] Registered external feed: "${feedName}" (key: ${key})`);
        res.writeHead(201);
        res.end(JSON.stringify(feed));
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
    });
    return;
  }

  // GET /api/credentials
  if (req.method === 'GET' && url.pathname === '/api/credentials') {
    const list = Object.values(credentials).map(c => ({ ...c, isLive: activeFeeds.has(c.streamKey) }));
    res.writeHead(200);
    res.end(JSON.stringify({ credentials: list, rtmpUrl: RTMP_URL }));
    return;
  }

  // POST /api/credentials  { name, type, city }
  if (req.method === 'POST' && url.pathname === '/api/credentials') {
    if (!checkAuth(req)) return sendAuthError(res);
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', async () => {
      try {
        const { name, type = 'church', city = '' } = JSON.parse(body);
        if (!name?.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: 'Name is required' })); return; }
        let cdnCredential = null;
        if (CDN_ENABLED) {
          try {
            cdnCredential = await create5centsPushCredential(name.trim());
          } catch (error) {
            console.warn(`[5CENTS] Failed to create CDN credential for "${name.trim()}":`, error.message);
            // Continue with local credential creation even if CDN fails
            cdnCredential = null;
          }
        }
        const streamKey = cdnCredential?.streamKey || generateStreamKey(name.trim());
        const cred = {
          id: `cred-${Date.now()}`, name: name.trim(), type, city, streamKey,
          rtmpUrl: cdnCredential?.rtmpUrl || RTMP_URL,
          hlsUrl: cdnCredential?.hlsUrl || `${HLS_BASE}/${streamKey}/index.m3u8`,
          srtUrl: '',
          provider: cdnCredential ? '5centsCDN' : 'local',
          cdnId: cdnCredential?.cdnId || '',
          playbackRtmp: cdnCredential?.playbackRtmp || '',
          createdAt: new Date().toISOString(),
        };
        credentials[streamKey] = cred;
        saveCredentials();
        console.log(`\n[CREDS] Created: "${name}" provider: ${cred.provider} key: ${streamKey}`);
        res.writeHead(201);
        res.end(JSON.stringify(cred));
      } catch (error) {
        const message = error instanceof SyntaxError ? 'Invalid JSON' : error.message;
        res.writeHead(error instanceof SyntaxError ? 400 : 502);
        res.end(JSON.stringify({ error: message }));
      }
    });
    return;
  }

  // DELETE /api/credentials/:key
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/credentials/')) {
    if (!checkAuth(req)) return sendAuthError(res);
    const key = url.pathname.split('/').pop();
    if (credentials[key]) {
      const { name, provider, cdnId } = credentials[key];
      if (provider === '5centsCDN' && cdnId) {
        call5cents(`/streams/push/${cdnId}`, { method: 'DELETE' }).catch(error => {
          console.error(`[5CENTS] Could not delete stream ${cdnId}:`, error.message);
        });
      }
      delete credentials[key];
      saveCredentials();
      console.log(`\n[CREDS] Revoked: "${name}" (key: ${key})`);
      res.writeHead(200); res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
    }
    return;
  }

  // POST /api/program  { key }
  if (req.method === 'POST' && url.pathname === '/api/program') {
    if (!checkAuth(req)) return sendAuthError(res);
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      try {
        const { key } = JSON.parse(body);
        if (activeFeeds.has(key)) {
          programKey = key;
          const feed = activeFeeds.get(key);
          console.log(`\n[API]  Program set to: "${feed.name}"  HLS: ${feed.hlsUrl}`);
          res.writeHead(200); res.end(JSON.stringify({ ok: true, programKey, hlsUrl: feed.hlsUrl }));
        } else {
          res.writeHead(404); res.end(JSON.stringify({ error: `Stream "${key}" is not live` }));
        }
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); }
    });
    return;
  }

  res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
});

// ── Start ───────────────────────────────────────────────────────────────
nms.run();
apiServer.listen(API_PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║       LOVEWORLD NETWORKS — Broadcast Server              ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  RTMP ingest:  ${RTMP_URL.padEnd(42)}║`);
  console.log(`║  HLS playback: ${(HLS_BASE + '/<key>/index.m3u8').slice(0, 42).padEnd(42)}║`);
  console.log(`║  API server:   http://localhost:${API_PORT}/api             ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  if (API_SECRET) {
    console.log('║  API Authentication: ENABLED (set X-API-Secret header)   ║');
  } else {
    console.log('║  API Authentication: DISABLED (development mode)         ║');
  }
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  OBS → Settings → Stream:                                ║');
  if (CDN_ENABLED) {
    console.log('║    Server:     generated by 5centsCDN per credential     ║');
    console.log('║    Stream Key: generated by 5centsCDN per credential     ║');
  } else {
    console.log(`║    Server:     ${RTMP_URL.padEnd(42)}║`);
    console.log('║    Stream Key: (generate from platform admin panel)      ║');
  }
  console.log('╚══════════════════════════════════════════════════════════╝\n');
});
