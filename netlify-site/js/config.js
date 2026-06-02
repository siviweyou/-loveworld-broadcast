/**
 * LOVEWORLD NETWORKS LIVE — Platform Configuration
 *
 * Global broadcast platform with 5cent CDN integration.
 * Streams are automatically distributed globally via CDN.
 */

// Local RTMP server endpoint (OBS connects here)
const LOCAL_RTMP_URL = 'rtmp://localhost/live';

const LW_CONFIG = {
   // Broadcast API server URL. Set window.LW_BROADCAST_SERVER_URL before this
   // script on Netlify/production to point at your public RTMP/API server.
   BROADCAST_SERVER_URL: (typeof window !== 'undefined' && window.LW_BROADCAST_SERVER_URL) || 'http://localhost:3001',

   PLATFORM_NAME: 'Loveworld Networks Live - Global CDN',

   STORAGE_ENABLED: false,

   // RTMP endpoint for OBS to stream to (local server for relay)
   DEFAULT_RTMP_URL: LOCAL_RTMP_URL,

   // HLS playback base URL (served locally by Node Media Server)
   DEFAULT_HLS_BASE: 'http://localhost:8000/live',

   // 5cent CDN Configuration
   FIVECENTS_API_BASE: 'https://api.5centscdn.com/v2',
   FIVECENTS_ACCOUNT_ID: '10244',
   FIVECENTS_API_PROFILE_ID: '1151',
   CDN_ENABLED: true,
   
   // Stream key for global main stream (pre-configured)
   GLOBAL_MAIN_STREAM_KEY: 'global-main',
   GLOBAL_MAIN_RTMP_URL: 'rtmp://localhost/live',
   GLOBAL_MAIN_HLS_URL: 'http://localhost:8000/live/global-main/index.m3u8',
   
   // API Secret for authenticated endpoints (set in config or via LW_CONFIG_API_SECRET)
   API_SECRET: (typeof LW_CONFIG_API_SECRET !== 'undefined' ? LW_CONFIG_API_SECRET : ''),
};
