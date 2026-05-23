// LLM-driven music recommendation for the test3 "Running Now" → music
// shift card. Returns { iconTitle, iconSubtitle, artist, song } shaped
// to match the dot-music-1x1 variant fields the renderer already
// understands. Each call gets a fresh recommendation, so re-entering
// the test3 home stage cycles through different tracks.
//
// Input (optional, all string):
//   weather   — "Rainy", "Sunny", ...
//   distance  — "5km", "15km", ...
//   pace      — "easy", "tempo", ...
//   mood      — "morning", "energizing", "wind-down", ...
//   timeOfDay — "morning", "afternoon", "evening"
//
// Falls back to a curated default if the LLM call fails or the API key
// is missing — so the prototype still works offline.

// Default copy uses confirmation tone ("재생 중이에요", "딱이에요") rather
// than suggestion tone ("어떠세요?") because the track is treated as
// already playing on the user's device by the time this string surfaces.
const DEFAULT_RECOMMENDATIONS = [
  {
    iconTitle: '가벼운 러닝에 어울리는\nConcierto 재생 중이에요',
    iconSubtitle: 'Jim Hall - Concierto',
    artist: 'Jim Hall',
    song: 'Concierto'
  },
  {
    iconTitle: '비 오는 차분한 페이스엔\nHolocene이 딱이에요',
    iconSubtitle: 'Bon Iver - Holocene',
    artist: 'Bon Iver',
    song: 'Holocene'
  },
  {
    iconTitle: '리듬을 살려주는 신스 팝\nMidnight City 골랐어요',
    iconSubtitle: 'M83 - Midnight City',
    artist: 'M83',
    song: 'Midnight City'
  }
];

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const weather   = String(body.weather   || 'Rainy').slice(0, 40);
  const distance  = String(body.distance  || '15km').slice(0, 20);
  const pace      = String(body.pace      || 'easy').slice(0, 20);
  const mood      = String(body.mood      || 'energizing').slice(0, 30);
  const timeOfDay = String(body.timeOfDay || 'morning').slice(0, 20);

  function fallback() {
    // Rotate through defaults so successive failed calls still vary.
    const idx = Math.floor(Math.random() * DEFAULT_RECOMMENDATIONS.length);
    return res.status(200).json({ ...DEFAULT_RECOMMENDATIONS[idx], source: 'fallback' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const model  = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || 'gpt-5.4-mini';
    if (!apiKey) return fallback();

    const system = [
      '당신은 러닝 음악 큐레이션 AI 입니다.',
      '사용자의 현재 운동 상황 (날씨, 거리, 페이스, 분위기) 에 맞는 진짜 존재하는 곡 한 곡을 추천하세요.',
      '',
      '⚠️ 중요: 추천된 곡은 이미 사용자의 기기에서 재생되고 있는 상태입니다.',
      '   따라서 "어떠세요?", "들어보실래요?" 같은 의문형/제안형 문구는 절대 사용하지 마세요.',
      '   대신 "재생 중이에요", "딱이에요", "골랐어요", "선곡했어요" 같은',
      '   확정·진행형 문구로 자연스럽게 표현하세요.',
      '한국어 추천 문장은 자연스럽고 간결하게, 30자 안팎으로.',
      '',
      '반드시 다음 JSON 형식으로만 응답:',
      '{',
      '  "iconTitle": "한국어 추천 문장 (\\n 으로 줄바꿈, 2줄, 각 줄 18자 이내)",',
      '  "iconSubtitle": "Artist - Song Title",',
      '  "artist": "Artist",',
      '  "song": "Song Title"',
      '}',
      '',
      '예시 (확정·진행형으로 표현):',
      '{ "iconTitle": "가벼운 러닝에 어울리는\\nConcierto 재생 중이에요", "iconSubtitle": "Jim Hall - Concierto", "artist": "Jim Hall", "song": "Concierto" }',
      '{ "iconTitle": "비 오는 차분한 페이스엔\\nHolocene이 딱이에요", "iconSubtitle": "Bon Iver - Holocene", "artist": "Bon Iver", "song": "Holocene" }'
    ].join('\n');

    const user = [
      '현재 러닝 상황:',
      `- 날씨: ${weather}`,
      `- 거리: ${distance}`,
      `- 페이스: ${pace}`,
      `- 분위기: ${mood}`,
      `- 시간대: ${timeOfDay}`,
      '',
      '이 상황에 맞는 음악 한 곡을 추천해주세요.'
    ].join('\n');

    const completion = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.8,    // higher variety so successive calls give different tracks
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: user }
        ]
      })
    });

    if (!completion.ok) return fallback();
    const data = await completion.json();
    const raw  = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      // Loose recovery — find the JSON brace within free-form text.
      const m = String(raw || '').match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch (e2) { /* nope */ } }
    }
    if (!parsed || !parsed.iconTitle || !parsed.iconSubtitle) return fallback();

    return res.status(200).json({
      iconTitle:    String(parsed.iconTitle).slice(0, 80),
      iconSubtitle: String(parsed.iconSubtitle).slice(0, 60),
      artist:       String(parsed.artist || ''),
      song:         String(parsed.song || ''),
      source:       'llm'
    });
  } catch (error) {
    return fallback();
  }
}
