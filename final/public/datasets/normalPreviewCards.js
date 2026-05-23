// Normal preview dataset (loaded by /theme).
// Data-only file: keep it separate from theme-logic so "normal" and "dot"
// can be swapped without ever mixing.
(function () {
  'use strict';

  window.NORMAL_PREVIEW_CARDS = [
    {
      name: 'Weather',
      editSections: ['Page', 'Card globals', 'Weather card'],
      role: 'focus-block',
      variant: { kind: 'weather', temp: '23°', condition: 'Partly cloudy', location: 'Seoul', feels: '21°', icon: 'cloud-sun' }
    },
    {
      name: 'Calendar',
      editSections: ['Page', 'Card globals', 'Calendar card'],
      role: 'focus-block',
      variant: { kind: 'calendar', section: 'Next up · Today', time: '9:30 AM', duration: '30 min', title: 'Team stand-up', location: 'Studio A' }
    },
    {
      name: 'Reminder',
      editSections: ['Page', 'Card globals', 'Reminder card'],
      role: 'focus-block',
      variant: { kind: 'reminder', task: '5 PM', due: 'Review proposal', count: '3', section: 'TODAY · 3 ITEMS' }
    },
    {
      name: 'Message',
      editSections: ['Page', 'Card globals', 'Message card'],
      role: 'focus-block',
      variant: { kind: 'message', sender: 'Alex', preview: 'see you at coffee shop', section: 'MESSAGES · 2 NEW' }
    },
    {
      name: 'ETA',
      editSections: ['Page', 'Card globals', 'ETA card'],
      role: 'focus-block',
      variant: { kind: 'eta', eta: '12 min', destination: 'Home', traffic: 'Light traffic', route: 'via Hangang-daero' }
    },
    {
      name: 'Input summary',
      editSections: ['Page', 'Card globals', 'Input summary card'],
      role: 'focus-block',
      variant: { kind: 'input', section: 'SEARCH · COFFEE SHOPS', topic: 'Found 12 nearby', detail: '', facets: ['Vegetarian', 'Within 1 km', 'Open now'] }
    },
    {
      name: 'AI notification',
      editSections: ['Page', 'Card globals', 'AI notification'],
      role: 'notif-card-ai',
      variant: { title: 'Galaxy AI', subtitle: 'Your morning summary is ready', body: 'Your morning summary is ready', time: '8:21 AM', glyph: 'A', kind: 'ai' }
    },
    {
      name: 'Notification',
      editSections: ['Page', 'Card globals'],
      role: 'notif-card',
      variant: { title: 'WhatsApp', subtitle: 'Alex: Hey, are you around?', body: 'Alex: Hey, are you around?', time: '5m', glyph: 'W', accent: '#25D366' }
    },
    {
      name: 'Navigation now-bar',
      editSections: ['Page', 'Card globals', 'Navigation now-bar'],
      role: 'now-bar',
      variant: { type: 'navigation', distance: '200 m', direction: 'right', instruction: 'Turn right onto Hangang-daero', eta: '8 min' }
    },
    {
      name: 'Voice (single-line)',
      editSections: ['Page', 'Card globals', 'Navigation now-bar'],
      role: 'now-bar',
      variant: { type: 'single-line', label: 'Listening', listening: true }
    },
    {
      name: 'Charging now-bar',
      editSections: ['Page', 'Card globals', 'Navigation now-bar'],
      role: 'now-bar',
      variant: { type: 'charging', percent: 69 }
    },
    {
      name: 'Action chips',
      editSections: ['Page', 'Card globals'],
      role: 'action-row',
      variant: { actions: [{ label: 'Save', icon: 'bookmark', kind: 'primary' }, { label: 'Share', icon: 'share' }, { label: 'Edit', icon: 'edit' }] }
    },
    {
      name: 'Action chips (gallery demo)',
      editSections: ['Page', 'Card globals'],
      role: 'action-row',
      variant: { previewGallery: true }
    },
    {
      name: 'Quick toggles',
      editSections: ['Page', 'Card globals'],
      role: 'toggle-chip',
      variant: { toggles: [
        { name: 'Wi-Fi',      icon: 'wifi',       on: true  },
        { name: 'Bluetooth',  icon: 'bluetooth',  on: true  },
        { name: 'Flashlight', icon: 'flashlight', on: false },
        { name: 'Airplane',   icon: 'airplane',   on: false }
      ] }
    },
    {
      name: 'Now playing bar',
      editSections: ['Page', 'Card globals', 'Navigation now-bar'],
      role: 'now-bar',
      variant: {
        type: 'media',
        title: 'Blinding Lights',
        artist: 'The Weeknd',
        marquee: 'Blinding Lights · The Weeknd · After Hours'
      }
    },
    {
      name: 'Media card',
      editSections: ['Page', 'Card globals'],
      role: 'media-card',
      variant: { title: 'After Hours', artist: 'The Weeknd', service: 'Samsung Music' }
    },
    {
      name: 'Progress track',
      editSections: ['Page', 'Card globals'],
      role: 'progress-track',
      variant: { left: '1:42', right: '2:18', percent: 40 }
    }
  ];
})();

