/**
 * LOVEWORLD NETWORKS LIVE — VIDEO PLAYER MODULE
 * Wraps Video.js with HLS support, quality selection, and captions.
 */

const LWPlayer = (() => {
  let player = null;
  let viewerInterval = null;
  let currentChannel = null;

  // Demo HLS streams (public test streams — replace with real Loveworld stream URLs)
  const DEMO_STREAMS = {
    hls: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    fallback: 'https://www.w3schools.com/html/mov_bbb.mp4',
  };

  function init() {
    player = videojs('livePlayer', {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
      },
      controlBar: {
        children: [
          'playToggle',
          'volumePanel',
          'currentTimeDisplay',
          'timeDivider',
          'durationDisplay',
          'progressControl',
          'liveDisplay',
          'remainingTimeDisplay',
          'customControlSpacer',
          'playbackRateMenuButton',
          'fullscreenToggle',
        ],
      },
    });

    // Caption toggle
    document.getElementById('captionToggle').addEventListener('change', (e) => {
      const tracks = player.textTracks();
      for (let i = 0; i < tracks.length; i++) {
        tracks[i].mode = e.target.checked ? 'showing' : 'hidden';
      }
    });

    // Quality buttons
    document.querySelectorAll('.quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.quality-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-pressed', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        // In production: call ABR tier selection logic here
      });
    });

    // Close button
    document.getElementById('playerClose').addEventListener('click', close);

    // Close on overlay click
    document.getElementById('playerModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('playerModal')) close();
    });

    // Keyboard: Escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !document.getElementById('playerModal').hidden) close();
    });
  }

  function open(channel) {
    currentChannel = channel;
    document.getElementById('playerModalTitle').textContent = channel.name;
    document.getElementById('playerModal').hidden = false;
    document.body.style.overflow = 'hidden';
    document.getElementById('meetingRoomStage').hidden = true;
    document.getElementById('livePlayer').closest('.video-js').style.display = '';

    // Load stream
    const src = channel.hlsUrl || DEMO_STREAMS.hls;
    player.src({ src, type: 'application/x-mpegURL' });
    player.play().catch(() => {
      // Autoplay blocked — user must click play
    });

    // Simulate viewer count updates
    startViewerCount(channel.viewerCount || 0);

    // Focus close button for accessibility
    setTimeout(() => document.getElementById('playerClose').focus(), 100);
  }

  function openMeeting(title, participantCount = 48200) {
    currentChannel = null;
    document.getElementById('playerModalTitle').textContent = title;
    document.getElementById('playerModal').hidden = false;
    document.body.style.overflow = 'hidden';

    if (player) {
      player.pause();
      player.src('');
    }

    document.getElementById('livePlayer').closest('.video-js').style.display = 'none';
    document.getElementById('meetingRoomStage').hidden = false;
    startViewerCount(participantCount);

    setTimeout(() => document.getElementById('playerClose').focus(), 100);
  }

  function close() {
    document.getElementById('playerModal').hidden = true;
    document.body.style.overflow = '';
    document.getElementById('meetingRoomStage').hidden = true;
    document.getElementById('livePlayer').closest('.video-js').style.display = '';
    if (player) {
      player.pause();
      player.src('');
    }
    stopViewerCount();
    currentChannel = null;
  }

  function startViewerCount(initial) {
    let count = initial;
    document.getElementById('viewerCountNum').textContent = formatCount(count);
    stopViewerCount();
    viewerInterval = setInterval(() => {
      // Simulate small fluctuations
      count += Math.floor((Math.random() - 0.4) * 200);
      count = Math.max(100, count);
      document.getElementById('viewerCountNum').textContent = formatCount(count);
    }, 10000);
  }

  function stopViewerCount() {
    if (viewerInterval) {
      clearInterval(viewerInterval);
      viewerInterval = null;
    }
  }

  return { init, open, openMeeting, close };
})();
