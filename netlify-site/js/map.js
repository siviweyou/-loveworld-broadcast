/**
 * LOVEWORLD NETWORKS LIVE — MAP MODULE
 * Uses MapLibre GL JS with OpenFreeMap tiles (no token required).
 */

const LWMap = (() => {
  let map = null;
  let markers = [];
  let activeFilter = 'all';
  let activePinData = null;

  // ---- Initialise MapLibre GL JS ----
  function init() {
    map = new maplibregl.Map({
      container: 'map',
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [20, 10],
      zoom: 2.2,
      minZoom: 1.5,
      maxZoom: 18,
      attributionControl: true,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
    map.addControl(new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showUserHeading: false,
    }), 'bottom-right');

    map.on('load', () => {
      renderPins(LW_DATA.mapPins);
    });

    // Close pin card on map click
    map.on('click', () => {
      closePinCard();
    });
  }

  // ---- Render all pins ----
  function renderPins(pins) {
    // Remove existing markers
    markers.forEach(m => m.remove());
    markers = [];

    const filtered = activeFilter === 'all' ? pins : pins.filter(p => {
      if (activeFilter === 'live') return p.status === 'live';
      if (activeFilter === 'events') return p.type === 'event';
      if (activeFilter === 'churches') return p.type === 'church';
      return true;
    });

    filtered.forEach(pin => {
      const el = createMarkerElement(pin);
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        showPinCard(pin);
      });
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          showPinCard(pin);
        }
      });

      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      markers.push(marker);
    });
  }

  // ---- Create DOM element for a marker ----
  function createMarkerElement(pin) {
    const el = document.createElement('div');
    el.className = 'map-marker';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.setAttribute('aria-label', `${pin.label}${pin.status === 'live' ? ' — Live' : ''}`);

    if (pin.type === 'event') {
      const inner = document.createElement('div');
      inner.className = 'marker-live';
      if (pin.status !== 'live') {
        inner.style.background = '#6e7681';
        inner.style.boxShadow = 'none';
      }
      el.appendChild(inner);
    } else {
      const inner = document.createElement('div');
      inner.className = 'marker-church';
      inner.textContent = '⛪';
      inner.setAttribute('aria-hidden', 'true');
      if (pin.status === 'live') {
        inner.style.border = '3px solid #E63946';
        inner.style.boxShadow = '0 0 0 4px rgba(230,57,70,0.3)';
      }
      el.appendChild(inner);
    }

    return el;
  }

  // ---- Show pin card ----
  function showPinCard(pin) {
    activePinData = pin;
    const card = document.getElementById('pinCard');
    const badge = document.getElementById('pinCardBadge');
    const title = document.getElementById('pinCardTitle');
    const channel = document.getElementById('pinCardChannel');
    const count = document.getElementById('pinCardCount');
    const joinBtn = document.getElementById('pinCardJoin');
    const registerBtn = document.getElementById('pinCardRegister');

    // Badge
    if (pin.status === 'live') {
      badge.textContent = '🔴 LIVE';
      badge.className = 'pin-card-badge live';
    } else if (pin.type === 'church') {
      badge.textContent = '⛪ Church';
      badge.className = 'pin-card-badge church';
    } else {
      badge.textContent = pin.status.charAt(0).toUpperCase() + pin.status.slice(1);
      badge.className = 'pin-card-badge';
    }

    title.textContent = pin.label;

    if (pin.type === 'event') {
      const ch = LW_DATA.channels.find(c => c.id === pin.channelId);
      channel.textContent = ch ? ch.name : pin.channelId;
      count.textContent = formatCount(pin.count || 0);
      joinBtn.textContent = pin.status === 'live' ? 'Watch Live' : 'View Event';
      joinBtn.style.display = '';
      registerBtn.style.display = pin.status === 'upcoming' ? '' : 'none';

      joinBtn.onclick = () => {
        if (pin.status === 'live') {
          const ch = LW_DATA.channels.find(c => c.id === pin.channelId);
          if (ch) LWPlayer.open(ch);
        } else {
          LWUI.switchView('events');
          closePinCard();
        }
      };
      registerBtn.onclick = () => {
        LWUI.showToast('Registered! You\'ll receive a reminder 15 minutes before the event.', 'success');
        closePinCard();
      };
    } else {
      const church = LW_DATA.churches.find(c => c.id === pin.churchId);
      channel.textContent = church ? `${church.city}, ${church.country}` : '';
      count.textContent = pin.status === 'live' ? 'Live event' : 'Open';
      joinBtn.textContent = 'Get Directions';
      joinBtn.style.display = '';
      registerBtn.style.display = 'none';
      joinBtn.onclick = () => {
        if (church) {
          window.open(`https://maps.google.com/?q=${church.location.lat},${church.location.lng}`, '_blank', 'noopener');
        }
      };
    }

    card.hidden = false;
    document.getElementById('pinCardClose').focus();
  }

  // ---- Close pin card ----
  function closePinCard() {
    document.getElementById('pinCard').hidden = true;
    activePinData = null;
  }

  // ---- Filter pins ----
  function setFilter(filter) {
    activeFilter = filter;
    renderPins(LW_DATA.mapPins);
  }

  // ---- Update a pin's count (called from realtime module) ----
  function updatePinCount(pinId, newCount) {
    const pin = LW_DATA.mapPins.find(p => p.id === pinId);
    if (pin) {
      pin.count = newCount;
      if (activePinData && activePinData.id === pinId) {
        document.getElementById('pinCardCount').textContent = formatCount(newCount);
      }
    }
  }

  // ---- Fly to location ----
  function flyTo(lat, lng, zoom = 10) {
    map.flyTo({ center: [lng, lat], zoom, duration: 1500 });
  }

  function resize() {
    if (map) map.resize();
  }

  return { init, renderPins, setFilter, updatePinCount, flyTo, resize, closePinCard };
})();
