// Dot preview dataset (loaded by /theme).
// This file intentionally contains only data so it can be swapped/extended
// without editing the theme page HTML/JS logic.
(function () {
  'use strict';

  // Expose on window so non-module scripts can consume it.
  // Keep DOT cards first so the difference is obvious when toggling.
  window.DOT_PREVIEW_CARDS = [
    {
      name: 'Productivity Set (Square)',
      editSections: ['Page', 'Card globals'],
      role: 'composite-set',
      variant: {
        children: [
          { role: 'dot-goal', variant: { title: 'Today\'s Goal', time: '01:42:43', timeSuffix: 'Within', distance: '15km' }, x: 0, y: 0, w: 340, h: 168 },
          { role: 'run-panel', variant: { 
              title: 'run panel',
              status: 'loop 3 frames',
              frames: [
                [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[4,11],[5,11],[7,11],[8,11],[3,12],[4,12],[6,12],[7,12],[8,12],[2,13],[3,13],[5,13],[6,13]],
                [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[5,11],[6,11],[8,11],[9,11],[4,12],[5,12],[7,12],[8,12],[9,12],[3,13],[4,13],[7,13],[8,13]],
                [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[6,11],[7,11],[9,11],[10,11],[5,12],[6,12],[8,12],[9,12],[10,12],[4,13],[5,13],[7,13],[8,13]]
              ]
            }, x: 0, y: 172, w: 168, h: 168 },
          { role: 'dot-total-steps-2x1', variant: { count: '5,543' }, x: 172, y: 172, w: 168, h: 82 },
          { role: 'dot-running-compact', variant: { label: 'Jogging', time: '10:35' }, x: 172, y: 258, w: 168, h: 82 }
        ]
      }
    },
    {
      name: 'Time & Weather Set',
      editSections: ['Page', 'Card globals'],
      role: 'composite-set',
      variant: {
        children: [
          { role: 'dot-time-matrix', variant: { bgColor: '#000000', dotColor: '#FF7F24' }, x: 0, y: 0, w: 340, h: 180 },
          { role: 'dot-weather-2x1-v1-1', variant: { location: 'Sydney', weather: 'Sunny' }, x: 0, y: 190, w: 168, h: 82 },
          { role: 'dot-temperature-1x1', variant: { value: '28', unit: '℃' }, x: 172, y: 190, w: 82, h: 82 },
          { role: 'dot-date-1x1-v1-1', variant: { text: 'April\n26' }, x: 258, y: 190, w: 82, h: 82 }
        ]
      }
    },
    {
      name: 'Camera & Photo Set',
      editSections: ['Page', 'Card globals'],
      role: 'composite-set',
      variant: {
        children: [
          { role: 'dot-camera', variant: { img: '/assets/dot-camera/camera.png' }, x: 0, y: 0, w: 164, h: 246 },
          { role: 'dot-gallery-frame3', variant: { 
              activeIndex: 0, 
              labels: ['18','19','20','21','22','23','24','25','Today'],
              imgs: [
                '/assets/dot-gallery/thumb-2.png','/assets/dot-gallery/thumb-3.png','/assets/dot-gallery/thumb-4.png',
                '/assets/dot-gallery/thumb-5.png','/assets/dot-gallery/thumb-6.png','/assets/dot-gallery/thumb-7.png',
                '/assets/dot-gallery/thumb-8.png','/assets/dot-gallery/thumb-9.png','/assets/dot-gallery/thumb-10.png'
              ]
            }, x: 178, y: 14, w: 162, h: 218 }
        ]
      }
    },
    {
      name: 'Music & Schedule Set',
      editSections: ['Page', 'Card globals'],
      role: 'composite-set',
      variant: {
        children: [
          { role: 'dot-music-1x1', variant: { 
            artist: 'Jim Hall', 
            song: 'Concierto', 
            iconTitle: '가벼운 러닝에는 부드럽고 상쾌한\nConcierto가 좋을거같아요!', 
            iconSubtitle: 'Jim Hall - Concierto' 
          }, x: 0, y: 0, w: 340, h: 168 },
          { role: 'dot-schedule-2x2', variant: {
            date: '13 May',
            items: [
              { text: 'Wild Life', tone: 'muted' },
              { text: 'Blue Mountains', tone: 'muted' },
              { text: 'Darling Harbour', tone: 'accent' },
              { text: 'Opera House', tone: 'muted' }
            ]
          }, x: 0, y: 172, w: 340, h: 168 }
        ]
      }
    },
    {
      name: 'Run Panel (Animation)',
      editSections: ['Page', 'Card globals'],
      role: 'run-panel',
      variant: {
        title: 'run panel',
        status: 'loop 3 frames',
        frames: [
          [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[4,11],[5,11],[7,11],[8,11],[3,12],[4,12],[6,12],[7,12],[8,12],[2,13],[3,13],[5,13],[6,13]],
          [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[5,11],[6,11],[8,11],[9,11],[4,12],[5,12],[7,12],[8,12],[9,12],[3,13],[4,13],[7,13],[8,13]],
          [[9,4],[10,4],[6,5],[7,5],[9,5],[10,5],[5,6],[7,6],[8,6],[7,7],[8,7],[9,7],[11,7],[6,8],[7,8],[9,8],[10,8],[5,9],[6,9],[7,9],[5,10],[6,10],[7,10],[8,10],[6,11],[7,11],[9,11],[10,11],[5,12],[6,12],[8,12],[9,12],[10,12],[4,13],[5,13],[7,13],[8,13]]
        ]
      }
    },
    {
      name: 'Goal (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-goal',
      variant: { title: '오늘의 목표', time: '01:42:43', timeSuffix: '이내', distance: '15km' }
    },
    {
      name: 'Call (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-call',
      variant: {
        name: 'Michael Jones',
        phone: '+1 (555) 456-7890',
        avatar: '/assets/call-avatar.png'
      }
    },
    {
      name: 'Gallery IMG (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-gallery-img',
      variant: { activeIndex: 0, img: '/assets/dot-gallery/image-114131.png' }
    },
    {
      name: 'Gallery Frame 1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-gallery-frame1',
      variant: {
        labels: ['18','19','20','21','22','23','24','25','Today'],
        imgs: [
          '/assets/dot-gallery/thumb-2.png','/assets/dot-gallery/thumb-3.png','/assets/dot-gallery/thumb-4.png',
          '/assets/dot-gallery/thumb-5.png','/assets/dot-gallery/thumb-6.png','/assets/dot-gallery/thumb-7.png',
          '/assets/dot-gallery/thumb-8.png','/assets/dot-gallery/thumb-9.png','/assets/dot-gallery/thumb-10.png'
        ]
      }
    },
    {
      name: 'Camera (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-camera',
      variant: { img: '/assets/dot-camera/camera.png' }
    },
    {
      name: 'Running coach (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-running',
      variant: { title: 'Running coach', subtitle: '달릴 준비 되셨나요?' }
    },
    {
      name: 'Running time (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-running-compact',
      variant: { label: '조깅', time: '10:35' }
    },
    {
      name: 'Music 1×1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-music-1x1',
      variant: { artist: 'Jimmy Hall', album: 'Album', song: 'Concierto', current: '0:40', remaining: '-1:10', barFull: 120, barTrack: 31.48 }
    },
    {
      name: 'Music 1×2 (actions) (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-music-1x2-actions',
      variant: { artist: 'Jimmy Hall', album: 'Album', song: 'Concierto', current: '0:40', remaining: '-1:10', barFull: 292, barTrack: 77 }
    },
    {
      name: 'Music 1×2 (icon) (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-music-1x2-icon',
      variant: {
        title: '가벼운 러닝에는 부드럽고 상쾌한\nConcierto가 좋을거같아요!',
        subtitle: 'Jim Hall - Concierto',
        barFull: 292,
        barTrack: 77
      }
    },
    {
      name: 'Clock 2×1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-clock-2x1',
      variant: { time: '11:33', period: 'AM' }
    },
    {
      name: 'Time Matrix (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-time-matrix',
      variant: { bgColor: '#000000', dotColor: '#FF7F24' }
    },
    {
      name: 'Schedule 2×2 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-schedule-2x2',
      variant: {
        date: '13 May',
        items: [
          { text: 'Wild Life', tone: 'muted' },
          { text: 'Blue Mountains', tone: 'muted' },
          { text: 'Darling Harbour', tone: 'accent' },
          { text: 'Opera House', tone: 'muted' }
        ]
      }
    },
    {
      name: 'Schedule 4×2 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-schedule-4x2',
      variant: {
        date: 'May 15',
        items: [
          { text: 'Design standup', time: '10:00', tone: 'muted' },
          { text: 'Coffee w/ Sarah', time: '14:00', tone: 'muted' },
          { text: 'Run 5km', time: '18:30', tone: 'accent' },
          { text: 'Dinner reservation', time: '20:00', tone: 'strong' }
        ]
      }
    },
    {
      name: 'Total steps 2×1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-total-steps-2x1',
      variant: { title: 'TOTAL STEPS', count: '10,235' }
    },
    {
      name: 'Temperature 1×1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-temperature-1x1',
      variant: { value: '14', unit: '℃' }
    },
    {
      name: 'Weather 1×1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-weather-1x1',
      variant: { kind: 'sun' }
    },
    {
      name: 'Date 1×1 V1_1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-date-1x1-v1-1',
      variant: { text: 'April\n26' }
    },
    {
      name: 'Weather 2×1 V1_1 (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-weather-2x1-v1-1',
      variant: { location: 'Seoul', weather: 'Sunny' }
    },
    {
      name: 'Weather 2×1 V1_1 Copy (dot)',
      editSections: ['Page', 'Card globals'],
      role: 'dot-weather-2x1-v1-1',
      variant: { location: 'Seoul', weather: 'Sunny', theme: 'dark' }
    }
  ];
})();
