/**
 * LOVEWORLD NETWORKS LIVE — Platform Configuration
 *
 * Global broadcast platform with 5cent CDN integration.
 * Streams are automatically distributed globally via CDN.
 */

// Local RTMP server endpoint (OBS connects here)
const LOCAL_RTMP_URL = 'rtmp://localhost/live';

const _publicApi = (typeof window !== 'undefined' && window.LW_BROADCAST_SERVER_URL) || '';
const _publicRtmp = (typeof window !== 'undefined' && window.LW_PUBLIC_RTMP_URL) || '';
const _publicHls = (typeof window !== 'undefined' && window.LW_PUBLIC_HLS_BASE) || '';

const LW_CONFIG = {
   // Broadcast API server URL. Set window.LW_BROADCAST_SERVER_URL before this script on Netlify.
   BROADCAST_SERVER_URL: _publicApi || 'http://localhost:3001',

   PLATFORM_NAME: 'Loveworld Networks Live - Global CDN',

   STORAGE_ENABLED: false,

   // RTMP / HLS shown in UI. Netlify should inject public Railway values.
   DEFAULT_RTMP_URL: _publicRtmp || LOCAL_RTMP_URL,

   DEFAULT_HLS_BASE: _publicHls || 'http://localhost:3001/live',

   // 5cent CDN Configuration
   FIVECENTS_API_BASE: 'https://api.5centscdn.com/v2',
   FIVECENTS_ACCOUNT_ID: '10244',
   FIVECENTS_API_PROFILE_ID: '1151',
   CDN_ENABLED: true,
   
   // Stream key for global main stream (pre-configured)
   GLOBAL_MAIN_STREAM_KEY: 'global-main',
   GLOBAL_MAIN_RTMP_URL: 'rtmp://localhost/live',
   GLOBAL_MAIN_HLS_URL: 'http://localhost:3001/live/global-main/index.m3u8',
   
   // API Secret for authenticated endpoints (set in config or via LW_CONFIG_API_SECRET)
   API_SECRET: (typeof LW_CONFIG_API_SECRET !== 'undefined' ? LW_CONFIG_API_SECRET : ''),
};
