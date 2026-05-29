/**
 * LOVEWORLD NETWORKS — BROADCAST PREVIEW MODULE
 *
 * Dedicated HLS video player for the Broadcast Control Room.
 * Completely separate from the meeting room modal.
 * Opens when an operator clicks "Preview Output" or "Preview" on a feed.
 */

const LWBroadcast = (() => {
  let player = null;
  let failureCount = 0;
  let failureWindowStart = null;
  const MAX_FAILURES = 3;
  const FAILURE_WINDOW_MS = 30_000;

  function init() {
    // Wire close button
    document.getElementById('broadcastPreviewClose')
      ?.addEventListener('click', close);

    // Close on overlay click
    document.getElementById('broadcastPreviewModal')
      ?.addEventListener('click', (e) => {
        if (e.target === document.getElementById('broadcastPreviewModal')) close();
      });

    // Init Video.js player for broadcast preview
    if (document.getElementById('broadcastPreviewPlayer')) {
      player = videojs('broadcastPreviewPlayer', {
        controls: true,
        autoplay: true,
        preload: 'auto',
        fluid: true,
        liveui: true,
        html5: {
          vhs: {
            overrideNative: true,
            enableLowInitialPlaylist: true,
            smoothQualityChange: true,
          },
          nativeAudioTracks: false,
          nativeVideoTracks: false,
        },
        controlBar: {
          children: [
            'playToggle',
            'volumePanel',
            'liveDisplay',
            'customControlSpacer',
            'fullscreenToggle',
          ],
        },
      });

      // Track HLS failures for retry logic
      player.on('error', () => {
        const now = Date.now();
        if (!failureWindowStart || now - failureWindowStart > FAILURE_WINDOW_MS) {
          failureWindowStart = now;
          failureCount = 1;
        } else {
          failureCount++;
        }

        if (failureCount >= MAX_FAILURES) {
          showRetryState();
        }
      });
    }
  }

  function openPreview(title, hlsUrl) {
    const modal = document.getElementById('broadcastPreviewModal');
    if (!modal) return;

    // Reset failure tracking
    failureCount = 0;
    failureWindowStart = null;

    // Set title and URL display
    document.getElementById('broadcastPreviewTitle').textContent = title;
    document.getElementById('broadcastPreviewUrl').textContent = hlsUrl;

    // Hide retry state, show player
    hideRetryState();

    // Load the HLS stream
    if (player) {
      player.src({ src: hlsUrl, type: 'application/x-mpegURL' });
      player.play().catch(() => {
        // Autoplay blocked — user clicks play
      });
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('broadcastPreviewClose')?.focus();
  }

  function close() {
    const modal = document.getElementById('broadcastPreviewModal');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
    if (player) {
      player.pause();
      player.src('');
    }
    failureCount = 0;
    failureWindowStart = null;
  }

  function showRetryState() {
    document.getElementById('broadcastPreviewRetry')?.removeAttribute('hidden');
    document.getElementById('broadcastPreviewPlayer')
      ?.closest('.video-js')
      ?.style.setProperty('display', 'none');
  }

  function hideRetryState() {
    document.getElementById('broadcastPreviewRetry')?.setAttribute('hidden', '');
    document.getElementById('broadcastPreviewPlayer')
      ?.closest('.video-js')
      ?.style.removeProperty('display');
  }

  function retry() {
    const url = document.getElementById('broadcastPreviewUrl')?.textContent;
    if (!url || !player) return;
    failureCount = 0;
    failureWindowStart = null;
    hideRetryState();
    player.src({ src: url, type: 'application/x-mpegURL' });
    player.play().catch(() => {});
  }

  return { init, openPreview, close, retry };
})();
