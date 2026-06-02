/**
 * LOVEWORLD NETWORKS LIVE — MOCK DATA
 * In production this is replaced by API calls to the backend services.
 */

const LW_DATA = {

  // Broadcast channels and feeds are populated by the local RTMP server
  // via js/api.js polling http://localhost:3001/api/feeds.
  // The default platform channel is seeded from js/config.js.
  broadcastChannels: [],
  distributionRoutes: [],
  broadcastFeeds: [],

  channels: [
    { id: 'loveworldsat',  name: 'LoveworldSAT',    region: 'Africa / Global',    color: '#E63946', emoji: '🌍', status: 'live',    viewerCount: 48200, currentProgram: 'Rhapsody of Realities TV', hlsUrl: '' },
    { id: 'loveworldusa',  name: 'LoveWorld USA',    region: 'Americas',           color: '#1a73e8', emoji: '🇺🇸', status: 'live',    viewerCount: 12400, currentProgram: 'Healing School',          hlsUrl: '' },
    { id: 'loveworldplus', name: 'LoveWorld Plus',   region: 'Europe',             color: '#8338ec', emoji: '🇬🇧', status: 'live',    viewerCount: 9800,  currentProgram: 'Your LoveWorld Specials', hlsUrl: '' },
    { id: 'loveworldarab', name: 'LoveWorld Arabic', region: 'Middle East / N.Africa', color: '#f4a261', emoji: '🌙', status: 'live', viewerCount: 6100,  currentProgram: 'Arabic Praise Night',     hlsUrl: '' },
    { id: 'loveworldes',   name: 'LoveWorld Spanish',region: 'Latin America',      color: '#06d6a0', emoji: '🇪🇸', status: 'live',    viewerCount: 5300,  currentProgram: 'Español Especial',        hlsUrl: '' },
    { id: 'loveworldasia', name: 'LoveWorld Asia',   region: 'Asia-Pacific',       color: '#ef476f', emoji: '🌏', status: 'live',    viewerCount: 7700,  currentProgram: 'Asia Praise Night',       hlsUrl: '' },
    { id: 'loveworldpac',  name: 'LoveWorld Pacific',region: 'Pacific / W.Canada', color: '#118ab2', emoji: '🌊', status: 'offline', viewerCount: 0,     currentProgram: 'Off Air',                 hlsUrl: '' },
  ],

  events: [
    {
      id: 'evt-001',
      title: 'Global Day of Prayer',
      type: 'prayer',
      status: 'live',
      channelId: 'loveworldsat',
      description: 'Join billions worldwide in the most impactful prayer event of the year. Hosted by Pastor Chris Oyakhilome.',
      scheduledStartAt: new Date(Date.now() - 3600000).toISOString(),
      scheduledEndAt: new Date(Date.now() + 7200000).toISOString(),
      participantCount: 2847391,
      registrationCount: 5100000,
      thumbnailEmoji: '🙏',
      location: { lat: 6.5244, lng: 3.3792 },
      seriesId: 'series-gdop',
    },
    {
      id: 'evt-002',
      title: 'Global Communion Service',
      type: 'communion',
      status: 'live',
      channelId: 'loveworldsat',
      description: 'Monthly Global Communion Service with Pastor Chris. Millions partake simultaneously across the globe.',
      scheduledStartAt: new Date(Date.now() - 1800000).toISOString(),
      scheduledEndAt: new Date(Date.now() + 3600000).toISOString(),
      participantCount: 1200000,
      registrationCount: 3000000,
      thumbnailEmoji: '✝️',
      location: { lat: 6.5244, lng: 3.3792 },
      seriesId: 'series-gcs',
    },
    {
      id: 'evt-003',
      title: 'Healing School Summer Session',
      type: 'conference',
      status: 'upcoming',
      channelId: 'loveworldusa',
      description: 'Experience the miraculous at the Healing School. Register now for the upcoming summer session.',
      scheduledStartAt: new Date(Date.now() + 86400000 * 3).toISOString(),
      scheduledEndAt: new Date(Date.now() + 86400000 * 5).toISOString(),
      participantCount: 0,
      registrationCount: 84000,
      thumbnailEmoji: '💊',
      location: { lat: 40.7128, lng: -74.0060 },
    },
    {
      id: 'evt-004',
      title: 'Your LoveWorld Partner Conference',
      type: 'conference',
      status: 'upcoming',
      channelId: 'loveworldplus',
      description: 'An exclusive gathering for LoveWorld partners. Receive special blessings and prophetic declarations.',
      scheduledStartAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      scheduledEndAt: new Date(Date.now() + 86400000 * 9).toISOString(),
      participantCount: 0,
      registrationCount: 210000,
      thumbnailEmoji: '🤝',
      location: { lat: 51.5074, lng: -0.1278 },
    },
    {
      id: 'evt-005',
      title: 'Night of Bliss — Lagos',
      type: 'gathering',
      status: 'upcoming',
      channelId: 'loveworldsat',
      description: 'A night of miracles, signs and wonders. Join us at the Tafawa Balewa Square, Lagos.',
      scheduledStartAt: new Date(Date.now() + 86400000 * 14).toISOString(),
      scheduledEndAt: new Date(Date.now() + 86400000 * 14 + 18000000).toISOString(),
      participantCount: 0,
      registrationCount: 500000,
      thumbnailEmoji: '🌟',
      location: { lat: 6.4541, lng: 3.3947 },
    },
    {
      id: 'evt-006',
      title: 'Praise Night — Global',
      type: 'broadcast',
      status: 'concluded',
      channelId: 'loveworldsat',
      description: 'A spectacular night of praise and worship that united millions across the globe.',
      scheduledStartAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      scheduledEndAt: new Date(Date.now() - 86400000 * 2 + 14400000).toISOString(),
      participantCount: 3100000,
      registrationCount: 4200000,
      thumbnailEmoji: '🎵',
      location: { lat: 6.5244, lng: 3.3792 },
    },
  ],

  churches: [
    { id: 'ch-001', name: 'Christ Embassy Lagos HQ',       city: 'Lagos',        country: 'Nigeria',        location: { lat: 6.5244, lng: 3.3792 }, contact: '+234 1 234 5678', schedule: 'Sun 8am, 10am, 12pm | Wed 6pm', hasLiveEvent: true  },
    { id: 'ch-002', name: 'Christ Embassy London',          city: 'London',       country: 'United Kingdom', location: { lat: 51.5074, lng: -0.1278 }, contact: '+44 20 1234 5678', schedule: 'Sun 10am, 2pm | Thu 7pm',    hasLiveEvent: false },
    { id: 'ch-003', name: 'Christ Embassy New York',        city: 'New York',     country: 'USA',            location: { lat: 40.7128, lng: -74.0060 }, contact: '+1 212 555 0100', schedule: 'Sun 9am, 11am | Fri 7pm',   hasLiveEvent: false },
    { id: 'ch-004', name: 'Christ Embassy Johannesburg',    city: 'Johannesburg', country: 'South Africa',   location: { lat: -26.2041, lng: 28.0473 }, contact: '+27 11 234 5678', schedule: 'Sun 9am, 11am | Wed 6pm',  hasLiveEvent: true  },
    { id: 'ch-005', name: 'Christ Embassy Dubai',           city: 'Dubai',        country: 'UAE',            location: { lat: 25.2048, lng: 55.2708 }, contact: '+971 4 234 5678', schedule: 'Fri 7pm | Sat 10am',        hasLiveEvent: false },
    { id: 'ch-006', name: 'Christ Embassy Toronto',         city: 'Toronto',      country: 'Canada',         location: { lat: 43.6532, lng: -79.3832 }, contact: '+1 416 555 0100', schedule: 'Sun 10am, 12pm | Wed 7pm', hasLiveEvent: false },
    { id: 'ch-007', name: 'Christ Embassy Sydney',          city: 'Sydney',       country: 'Australia',      location: { lat: -33.8688, lng: 151.2093 }, contact: '+61 2 1234 5678', schedule: 'Sun 10am | Thu 7pm',      hasLiveEvent: false },
    { id: 'ch-008', name: 'Christ Embassy Nairobi',         city: 'Nairobi',      country: 'Kenya',          location: { lat: -1.2921, lng: 36.8219 }, contact: '+254 20 234 5678', schedule: 'Sun 8am, 10am | Tue 6pm', hasLiveEvent: true  },
    { id: 'ch-009', name: 'Christ Embassy Accra',           city: 'Accra',        country: 'Ghana',          location: { lat: 5.6037, lng: -0.1870 }, contact: '+233 30 234 5678', schedule: 'Sun 9am, 11am | Wed 6pm',  hasLiveEvent: false },
    { id: 'ch-010', name: 'Christ Embassy Singapore',       city: 'Singapore',    country: 'Singapore',      location: { lat: 1.3521, lng: 103.8198 }, contact: '+65 6234 5678', schedule: 'Sun 10am | Fri 7pm',         hasLiveEvent: false },
    { id: 'ch-011', name: 'Christ Embassy Paris',           city: 'Paris',        country: 'France',         location: { lat: 48.8566, lng: 2.3522 }, contact: '+33 1 23 45 67 89', schedule: 'Sun 10am | Thu 7pm',       hasLiveEvent: false },
    { id: 'ch-012', name: 'Christ Embassy Abuja',           city: 'Abuja',        country: 'Nigeria',        location: { lat: 9.0765, lng: 7.3986 }, contact: '+234 9 234 5678', schedule: 'Sun 8am, 10am | Wed 6pm',    hasLiveEvent: true  },
  ],

  mapPins: [
    { id: 'pin-evt-001', type: 'event', lat: 6.5244,   lng: 3.3792,   status: 'live',     label: 'Global Day of Prayer',       count: 2847391, eventId: 'evt-001', channelId: 'loveworldsat' },
    { id: 'pin-evt-002', type: 'event', lat: 6.5244,   lng: 3.4,      status: 'live',     label: 'Global Communion Service',   count: 1200000, eventId: 'evt-002', channelId: 'loveworldsat' },
    { id: 'pin-evt-003', type: 'event', lat: 40.7128,  lng: -74.0060, status: 'upcoming', label: 'Healing School',             count: 0,       eventId: 'evt-003', channelId: 'loveworldusa' },
    { id: 'pin-evt-004', type: 'event', lat: 51.5074,  lng: -0.1278,  status: 'upcoming', label: 'Partner Conference',         count: 0,       eventId: 'evt-004', channelId: 'loveworldplus' },
    { id: 'pin-evt-005', type: 'event', lat: 6.4541,   lng: 3.3947,   status: 'upcoming', label: 'Night of Bliss Lagos',       count: 0,       eventId: 'evt-005', channelId: 'loveworldsat' },
    { id: 'pin-ch-001',  type: 'church', lat: 6.5244,  lng: 3.3792,   status: 'live',     label: 'Christ Embassy Lagos HQ',    churchId: 'ch-001' },
    { id: 'pin-ch-002',  type: 'church', lat: 51.5074, lng: -0.1278,  status: 'open',     label: 'Christ Embassy London',      churchId: 'ch-002' },
    { id: 'pin-ch-003',  type: 'church', lat: 40.7128, lng: -74.0060, status: 'open',     label: 'Christ Embassy New York',    churchId: 'ch-003' },
    { id: 'pin-ch-004',  type: 'church', lat: -26.2041,lng: 28.0473,  status: 'live',     label: 'Christ Embassy Johannesburg',churchId: 'ch-004' },
    { id: 'pin-ch-005',  type: 'church', lat: 25.2048, lng: 55.2708,  status: 'open',     label: 'Christ Embassy Dubai',       churchId: 'ch-005' },
    { id: 'pin-ch-006',  type: 'church', lat: 43.6532, lng: -79.3832, status: 'open',     label: 'Christ Embassy Toronto',     churchId: 'ch-006' },
    { id: 'pin-ch-007',  type: 'church', lat: -33.8688,lng: 151.2093, status: 'open',     label: 'Christ Embassy Sydney',      churchId: 'ch-007' },
    { id: 'pin-ch-008',  type: 'church', lat: -1.2921, lng: 36.8219,  status: 'live',     label: 'Christ Embassy Nairobi',     churchId: 'ch-008' },
    { id: 'pin-ch-009',  type: 'church', lat: 5.6037,  lng: -0.1870,  status: 'open',     label: 'Christ Embassy Accra',       churchId: 'ch-009' },
    { id: 'pin-ch-010',  type: 'church', lat: 1.3521,  lng: 103.8198, status: 'open',     label: 'Christ Embassy Singapore',   churchId: 'ch-010' },
    { id: 'pin-ch-011',  type: 'church', lat: 48.8566, lng: 2.3522,   status: 'open',     label: 'Christ Embassy Paris',       churchId: 'ch-011' },
    { id: 'pin-ch-012',  type: 'church', lat: 9.0765,  lng: 7.3986,   status: 'live',     label: 'Christ Embassy Abuja',       churchId: 'ch-012' },
  ],

  notifications: [
    { id: 'n-001', title: 'Global Day of Prayer is LIVE!', body: 'Join billions praying right now on LoveworldSAT.', time: '2 min ago', unread: true },
    { id: 'n-002', title: 'Healing School Registration Open', body: 'Register now for the Summer Session starting in 3 days.', time: '1 hr ago', unread: true },
    { id: 'n-003', title: 'Partner Conference Reminder', body: 'Your LoveWorld Partner Conference starts in 7 days.', time: '3 hrs ago', unread: true },
    { id: 'n-004', title: 'Praise Night Recording Available', body: 'Watch the full recording of last night\'s Praise Night.', time: '2 days ago', unread: false },
  ],

  feedSeed: [
    { type: 'joined',   name: 'Adaeze O.',    country: 'Nigeria',        action: 'joined the prayer',    emoji: '🙏' },
    { type: 'reaction', name: 'James K.',     country: 'United Kingdom', action: 'sent Hallelujah',       emoji: '🎉' },
    { type: 'checkin',  name: 'Maria S.',     country: 'Brazil',         action: 'checked in',            emoji: '📍' },
    { type: 'reaction', name: 'David L.',     country: 'USA',            action: 'sent Amen',             emoji: '🙏' },
    { type: 'joined',   name: 'Fatima A.',    country: 'UAE',            action: 'joined the stream',     emoji: '✨' },
    { type: 'reaction', name: 'Chen W.',      country: 'Singapore',      action: 'sent Praise',           emoji: '🙌' },
    { type: 'checkin',  name: 'Blessing N.',  country: 'Ghana',          action: 'checked in',            emoji: '📍' },
    { type: 'reaction', name: 'Sarah M.',     country: 'South Africa',   action: 'sent Heart',            emoji: '❤️' },
    { type: 'joined',   name: 'Emmanuel T.',  country: 'Kenya',          action: 'joined the prayer',     emoji: '🙏' },
    { type: 'reaction', name: 'Grace P.',     country: 'Australia',      action: 'sent Fire',             emoji: '🔥' },
  ],
};

// Utility: format large numbers compactly
function formatCount(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// Utility: format relative time
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Utility: format date/time in local timezone
function formatLocalTime(isoString) {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return new Date(isoString).toUTCString();
  }
}

// Validate password: ≥8 chars, ≥1 upper, ≥1 lower, ≥1 digit
function validatePassword(s) {
  return s.length >= 8 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /[0-9]/.test(s);
}

// Validate display name: 2–50 chars
function validateDisplayName(s) {
  return s.trim().length >= 2 && s.trim().length <= 50;
}
