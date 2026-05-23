export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const text = String(body.text || body.utterance || "").trim();
    if (!text) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-5.4-mini";
    
    if (!apiKey) {
      // Fallback
      res.status(200).json({
        components: [
          { role: "dot-goal", variant: { title: "Morning Run", time: "00:45:00", distance: "5km" } },
          { role: "dot-music-1x1", variant: {} }
        ]
      });
      return;
    }

    const COMPONENTS = [
      { role: "dot-goal", note: "FITNESS GOAL (340x168). variant: { title, time, timeSuffix, distance }." },
      { role: "dot-music-1x1", note: "MUSIC PLAYER (168x168)." },
      { role: "dot-total-steps-2x1", note: "STEPS (168x82). variant: { count }." },
      { role: "dot-running-compact", note: "COMPACT RUN (168x82). variant: { time, label }." },
      { role: "dot-time-matrix", note: "TIME MATRIX (340x180). variant: { time, meta, dotColor }." },
      { role: "dot-weather-2x1-v1-1", note: "WEATHER (168x82). variant: { location, weather }." },
      { role: "dot-temperature-1x1", note: "TEMP (82x82). variant: { value, unit }." },
      { role: "dot-date-1x1-v1-1", note: "DATE (82x82). variant: { text }." },
      { role: "dot-schedule-4x2", note: "WIDE SCHEDULE (340x168). variant: { date, items: [{text, time, tone}] }. LIMIT ITEMS TO MAX 3." },
      { role: "dot-schedule-2x2", note: "SQUARE SCHEDULE (168x168). variant: { date, items: [{text, tone}] }. LIMIT ITEMS TO MAX 3." },
      { role: "dot-emoji-1x1", note: "EMOJI DISPLAY (168x168). A circular dot grid with a central emoji. Use for themes like cooking (🍳), shopping (🛒), relaxing (☕), travel (✈️), etc. variant: { emoji }." },
      { role: "dot-gallery-frame1", note: "GALLERY FRAME (162x162). Use for memories, travel, location. variant: {}" },
      { role: "dot-gallery-img", note: "IMAGE (168x168). Display a realistic image from Unsplash. Use for food. Example: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400' (Food). variant: { img }." },
      { role: "dot-camera", note: "CAMERA CARD (164x246). ALWAYS USE THIS for camera, photo, or travel contexts. variant: { img: '/assets/dot-camera/camera.png' }" },
      { role: "composite-set", note: "PRE-DEFINED THEME BOX (340x340). A curated group of components. Use when the context matches these specific sets." }
    ];

    const PRE_DEFINED_SETS = [
      {
        name: "Productivity Set (Square)",
        context: "Daily goals, fitness tracking, steps, jogging. Good for morning or active status.",
        variant: {
          children: [
            { role: "dot-goal", variant: { title: "Today's Goal", time: "01:42:43", timeSuffix: "Within", distance: "15km" }, x: 0, y: 0, w: 340, h: 168 },
            { role: "run-panel", x: 0, y: 172, w: 168, h: 168 },
            { role: "dot-total-steps-2x1", variant: { count: "5,543" }, x: 172, y: 172, w: 168, h: 82 },
            { role: "dot-running-compact", variant: { label: "Jogging", time: "10:35" }, x: 172, y: 258, w: 168, h: 82 }
          ]
        }
      },
      {
        name: "Time & Weather Set",
        context: "General overview, morning briefing, time and weather focus.",
        variant: {
          children: [
            { role: "dot-time-matrix", variant: { bgColor: "#000000", dotColor: "#FF7F24" }, x: 0, y: 0, w: 340, h: 180 },
            { role: "dot-weather-2x1-v1-1", variant: { location: "Seoul", weather: "Sunny" }, x: 0, y: 190, w: 168, h: 82 },
            { role: "dot-temperature-1x1", variant: { value: "24", unit: "℃" }, x: 172, y: 190, w: 82, h: 82 },
            { role: "dot-date-1x1-v1-1", variant: { text: "May\n20" }, x: 258, y: 190, w: 82, h: 82 }
          ]
        }
      },
      {
        name: "Music & Schedule Set",
        context: "Entertainment, work-life balance, music focus with upcoming tasks.",
        variant: {
          children: [
            { role: "dot-music-1x1", variant: { artist: "Jim Hall", song: "Concierto", iconTitle: "오늘 날씨에 딱 맞는\n플레이리스트" }, x: 0, y: 0, w: 340, h: 168 },
            { role: "dot-schedule-4x2", variant: { date: "Today", items: [{ text: "Meeting", tone: "muted" }, { text: "Lunch", tone: "accent" }] }, x: 0, y: 172, w: 340, h: 168 }
          ]
        }
      }
    ];

    const system = [
      "You are a GenUI Context Engine for Persona 1 Home Screen.",
      "Analyze the user's request and suggest a combination of components or a pre-defined theme box.",
      "Persona 1 is active, focused on fitness, music, and daily productivity.",
      "",
      "🔴 CRITICAL RULE: Use whitelisted components ONLY.",
      "🟢 PRE-DEFINED SETS: If a user's request strongly matches one of these curated sets, prefer returning the 'composite-set' with the exact variant provided.",
      "🟢 TIME MATRIX: A 'dot-time-matrix' will ALWAYS be automatically placed at the top of the screen by the system. Do NOT include 'dot-time-matrix' in your returned components.",
      "🟢 MULTIPLE COMPONENTS: Whenever possible, return 3 or more components in your dynamic combination to create a rich and full screen layout. DO NOT return just 1 or 2 components unless explicitly asked. Always try to fill the screen with relevant information.",
      "🟢 CAMERA/PHOTO: For requests related to camera, photo, or travel, ALWAYS INCLUDE 'dot-camera'.",
      "",
      "PRE-DEFINED THEME BOXES:",
      JSON.stringify(PRE_DEFINED_SETS, null, 2),
      "",
      "🟢 OUTPUT: Return a JSON object with a 'components' array.",
      "",
      "Example Request: '운동이랑 일정 같이 보고 싶어'",
      "Example Response (using a pre-defined set):",
      "{",
      "  \"components\": [",
      "    { \"role\": \"composite-set\", \"variant\": { \"children\": [...] } }",
      "  ]",
      "}",
      "",
      "Example Request: '오늘 요리 준비할래'",
      "Example Response (dynamic combination with 3+ components):",
      "{",
      "  \"components\": [",
      "    { \"role\": \"dot-schedule-4x2\", \"variant\": { \"date\": \"Today\", \"items\": [ { \"text\": \"요리 준비\", \"tone\": \"accent\" } ] } },",
      "    { \"role\": \"dot-emoji-1x1\", \"variant\": { \"emoji\": \"🍳\" } },",
      "    { \"role\": \"dot-time-matrix\", \"variant\": { \"bgColor\": \"#000000\", \"dotColor\": \"#FF7F24\" } }",
      "  ]",
      "}",
      "",
      "Example Request: '현재 위치 여행지 보여줘'",
      "Example Response (dynamic combination with 3+ components):",
      "{",
      "  \"components\": [",
      "    { \"role\": \"dot-weather-2x1-v1-1\", \"variant\": { \"location\": \"성수동\", \"weather\": \"맑음\" } },",
      "    { \"role\": \"dot-gallery-frame1\", \"variant\": {} },",
      "    { \"role\": \"dot-camera\", \"variant\": { \"img\": \"/assets/dot-camera/camera.png\" } }",
      "  ]",
      "}"
    ].join("\n");

    const user = [
      "USER_REQUEST:",
      text,
      "",
      "WHITELIST COMPONENTS:",
      JSON.stringify(COMPONENTS, null, 2),
    ].join("\n");

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!completion.ok) {
      throw new Error("OpenAI request failed");
    }

    const data = await completion.json();
    const raw = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    let parsed = null;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      const m = String(raw || "").match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (e2) {}
      }
    }

    if (!parsed || !parsed.components) {
      res.status(200).json({
        components: [
          { role: "dot-goal", variant: { title: "Morning Run", time: "00:45:00", distance: "5km" } },
          { role: "dot-music-1x1", variant: {} }
        ]
      });
      return;
    }

    const allow = new Set(COMPONENTS.map((c) => c.role));
    parsed.components = parsed.components.filter(c => allow.has(c.role)).map(c => {
      if (c.role === 'composite-set' && c.variant && Array.isArray(c.variant.children)) {
        c.variant.children = c.variant.children.filter(child => allow.has(child.role));
      }
      return c;
    });

    res.status(200).json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
