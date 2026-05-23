export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const text = String(body.text || body.utterance || "").trim();
    const location = body.location || null; // { lat, lon }
    if (!text) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL_FAST || process.env.OPENAI_MODEL || "gpt-5.4-mini";
    if (!apiKey) {
      // Safe fallback (no LLM): return a deterministic choice.
      res.status(200).json({
        themeKey: "lavender",
        backgroundKey: null,
        component: {
          role: "dot-schedule-2x2",
          variant: {
            date: "Today",
            items: [
              { text: "준비된 일정이 없습니다", tone: "muted" },
              { text: "새로운 하루를 시작해보세요", tone: "accent" }
            ],
          },
        },
      });
      return;
    }

    const COMPONENTS = [
      // PLAN / LIST
      { role: "dot-schedule-4x2", note: "WIDE PLAN/LIST (340x168). Provide variant.date + variant.items(3). Use for schedules, task summaries, or message cleanups (메시지 정리). LIMIT ITEMS TO MAX 3." },
      { role: "dot-schedule-2x2", note: "SQUARE PLAN/LIST (168x168). Provide variant.date + variant.items(3). LIMIT ITEMS TO MAX 3." },
      { role: "dot-weather-2x1-v1-1", note: "WEATHER (168x82). Provide variant.location + variant.weather." },
      { role: "dot-temperature-1x1", note: "TEMP (82x82). Provide variant.value + variant.unit ('℃')." },
      { role: "dot-date-1x1-v1-1", note: "DATE (82x82). Provide variant.text (e.g. 'MAY\\n20')." },
      { role: "dot-goal", note: "FITNESS GOAL (340x168). Provide variant.title + variant.time + variant.timeSuffix + variant.distance." },
      { role: "dot-gallery-frame1", note: "GALLERY FRAME (162x162). Provide variant.labels (9 strings)." },
      { role: "dot-gallery-img", note: "GALLERY IMAGE (162x162). Provide empty variant {} to use default image." },
      { role: "dot-camera", note: "CAMERA CARD (164x246). ALWAYS USE THIS for camera, photo, or travel contexts. variant: { img: '/assets/dot-camera/camera.png' }" },
      { role: "composite-set", note: "COMPOSITE (340x168). Use to bring multiple components together. variant: { children: [ { role, variant, x, y, w, h } ] }." }
    ];

    const system = [
      "You are a GenUI Context Engine for Persona 2.",
      "",
      "🔴 CRITICAL RULE: Use whitelisted components ONLY.",
      "🟢 MANDATORY FLOW: Inconvenience/Context Interpretation → UI Reconstruction.",
      "",
      "1. CONTEXT INTERPRETATION:",
      "   - Analyze the user's utterance to identify the specific 'Daily Inconvenience' or 'Life Scene'.",
      "",
      "2. DYNAMIC UI RECONSTRUCTION (Area size: 340x168 or 340x340 for composite-set):",
      "   - 🛑 COMPONENT PLACEMENT RULE: You must BRING and PLACE exact components from our Design System.",
      "   - 🛑 DO NOT create new layout variations inside a single component. Use 'composite-set' to arrange multiple components.",
      "   - 🛑 COMPONENT SELECTION RULES:",
      "     - For message cleanup or summaries: Use 'dot-schedule-4x2' (340x168) or a 'composite-set' with multiple components.",
      "     - For cooking or recipes: ALWAYS USE a list/schedule component like 'dot-schedule-4x2' to show the recipe or ingredients. DO NOT use image/gallery components for cooking.",
      "     - For weather (RICH): Use 'composite-set' containing 'dot-weather-2x1-v1-1' and 'dot-temperature-1x1' side-by-side, OR use 'dot-weather-2x1-v1-1'. DO NOT use 'dot-weather21'.",
      "     - For fitness/running: Use 'dot-goal' (340x168) or 'composite-set' with fitness elements.",
      "     - For visual memories/travel/vacation: Use 'dot-gallery-frame1' (162x162).",
      "     - For camera/photo/taking pictures: ALWAYS USE 'dot-camera' (164x246).",
      "     - 🚫 EXTERNAL IMAGES PROHIBITED: Do not use random images from the internet. Only use internal components.",
      "",
      "   - 🛑 LOCATION & TRAVEL RULE:",
      "     - If the user asks for 'current location' (현재 위치) or 'travel memories' (여행) or 'camera/photo' (카메라/사진):",
      "       * Use a 'composite-set' with a layout that fits within 340x340. A recommended layout is 'dot-camera' at (x:0, y:0) and 'dot-gallery-frame1' at (x:172, y:0) and a text component at (x:172, y:172).",
      "     - Use the provided user location coordinates (if available) to guess the neighborhood.",
      "     - If location coords are missing, default to a realistic Seoul location (e.g., '성수동').",
      "",
      "   - 🛑 DESIGN SYSTEM SETS (Preferred):",
      "     - 'Productivity Set': { children: [ {role:'dot-goal', x:0, y:0, w:340, h:168}, ... ] }",
      "     - 'Time & Weather Set': { children: [ {role:'dot-time-matrix', x:0, y:0, w:340, h:180}, ... ] }",
      "     - 'Music & Schedule Set': { children: [ {role:'dot-music-1x1', x:0, y:0, w:340, h:168}, {role:'dot-schedule-2x2', x:0, y:172, w:340, h:168} ] }",
      "",
      "   - pillTitle (optional): Top banner title (e.g. '성수동 날씨 정보').",
      "   - pillSub (optional): Top banner subtitle (e.g. '외출 전 바로 확인하세요').",
      "",
      "3. EMOTIONAL RELATIONSHIP & FLOW:",
      "   - themeKey: lavender, purple, blue, mint, amber.",
      "   - backgroundKey: clear, cloudy, rain, snow, night. MATCH this to weather status.",
      "",
      "Return ONLY valid JSON.",
      "Example for Location/Travel Request:",
      "{",
      "  \"themeKey\": \"blue\",",
      "  \"pillTitle\": \"여행지 정보\",",
      "  \"pillSub\": \"최근 여행의 추억입니다\",",
      "  \"component\": {",
      "    \"role\": \"composite-set\",",
      "    \"variant\": {",
      "      \"children\": [",
      "        { \"role\": \"dot-camera\", \"x\": 0, \"y\": 0, \"w\": 164, \"h\": 246, \"variant\": { \"img\": \"/assets/dot-camera/camera.png\" } },",
      "        { \"role\": \"dot-gallery-frame1\", \"x\": 176, \"y\": 0, \"w\": 164, \"h\": 164, \"variant\": {} },",
      "        { \"role\": \"dot-weather-2x1-v1-1\", \"x\": 176, \"y\": 176, \"w\": 164, \"h\": 80, \"variant\": { \"location\": \"수서동\", \"weather\": \"맑음\" } }",
      "      ]",
      "    }",
      "  }",
      "}",
      "Example for Cooking/Food Request (MUST BE LIST):",
      "{",
      "  \"themeKey\": \"amber\",",
      "  \"pillTitle\": \"요리 레시피\",",
      "  \"pillSub\": \"오늘의 저녁 식사 준비\",",
      "  \"component\": {",
      "    \"role\": \"composite-set\",",
      "    \"variant\": {",
      "      \"children\": [",
      "        { \"role\": \"dot-emoji-1x1\", \"x\": 0, \"y\": 0, \"w\": 164, \"h\": 164, \"variant\": { \"emoji\": \"🍳\" } },",
      "        { \"role\": \"dot-schedule-2x2\", \"x\": 176, \"y\": 0, \"w\": 164, \"h\": 164, \"variant\": { \"date\": \"Ingredients\", \"items\": [ { \"text\": \"연어 200g\" }, { \"text\": \"아스파라거스\" } ] } }",
      "      ]",
      "    }",
      "  }",
      "}",
      "Example for Running Route Request:",
      "{",
      "  \"themeKey\": \"mint\",",
      "  \"pillTitle\": \"러닝 경로 확인\",",
      "  \"pillSub\": \"오늘의 러닝 경로와 기록입니다\",",
      "  \"component\": {",
      "    \"role\": \"composite-set\",",
      "    \"variant\": {",
      "      \"children\": [",
      "        { \"role\": \"dot-goal\", \"x\": 0, \"y\": 0, \"w\": 340, \"h\": 168, \"variant\": { \"title\": \"Morning Run\", \"time\": \"00:45:00\", \"distance\": \"5km\" } },",
      "        { \"role\": \"dot-gallery-img\", \"x\": 0, \"y\": 172, \"w\": 340, \"h\": 168, \"variant\": {} }",
      "      ]",
      "    }",
      "  }",
      "}",
      "Example for Message Cleanup (Placing a schedule component):",
      "{",
      "  \"themeKey\": \"lavender\",",
      "  \"pillTitle\": \"메시지 정리\",",
      "  \"pillSub\": \"오늘의 주요 연락을 확인하세요\",",
      "  \"component\": {",
      "    \"role\": \"composite-set\",",
      "    \"variant\": {",
      "      \"children\": [",
      "        { \"role\": \"dot-schedule-4x2\", \"x\": 0, \"y\": 0, \"w\": 340, \"h\": 168, \"variant\": { \"date\": \"Messages\", \"items\": [ { \"text\": \"김팀장: 보고서 확인\", \"tone\": \"accent\", \"time\": \"10:00\" }, { \"text\": \"슬랙: 신규 알림\", \"tone\": \"muted\", \"time\": \"09:30\" } ] } }",
      "      ]",
      "    }",
      "  }",
      "}"
    ].join("\n");

    const user = [
      "USER_REQUEST:",
      text,
      "",
      "CONTEXT:",
      location ? `User Location: ${location.lat}, ${location.lon}` : "User Location: Unknown (use realistic Seoul default)",
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
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    if (!completion.ok) {
      const errTxt = await completion.text().catch(() => "");
      res.status(500).json({ error: "OpenAI request failed", details: errTxt.slice(0, 400) });
      return;
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

    if (!parsed || !parsed.component || !parsed.component.role) {
      res.status(200).json({
        themeKey: "lavender",
        backgroundKey: null,
        component: {
          role: "dot-schedule-2x2",
          variant: {
            date: "Today",
            items: [
              { text: "준비된 일정이 없습니다", tone: "muted" },
              { text: "새로운 하루를 시작해보세요", tone: "accent" }
            ],
          },
        },
      });
      return;
    }

    let finalRole = parsed.component.role;
    const allow = new Set(COMPONENTS.map((c) => c.role));
    if (!allow.has(finalRole)) {
      finalRole = "dot-schedule-2x2";
    }
    parsed.component.role = finalRole;

    // Integrity check for composite-set
    if (parsed.component.role === "composite-set") {
      const cv = parsed.component.variant || {};
      if (Array.isArray(cv.children)) {
        // Filter out hallucinated components like dot-camera
        cv.children = cv.children.filter(child => allow.has(child.role));
        // If it's empty after filtering, fallback
        if (cv.children.length === 0) {
          parsed.component.role = "dot-schedule-2x2";
        }
      }
    }

    // Integrity check for dot-schedule-2x2
    if (parsed.component.role === "dot-schedule-2x2") {
      const sv = parsed.component.variant || {};
      if (!Array.isArray(sv.items) || sv.items.length === 0) {
        parsed.component.variant.items = [
          { text: "분석된 항목이 없습니다", tone: "muted" },
          { text: "데이터 수신 대기 중", tone: "accent" },
          { text: "일정 확인이 필요합니다", tone: "muted" }
        ];
      } else {
        parsed.component.variant.items = sv.items.map(it => {
          const t = (it && typeof it === 'object') ? (it.text || "새로운 알림") : String(it);
          return {
            text: String(t).slice(0, 24),
            tone: (it && ["muted", "accent", "strong"].includes(it.tone)) ? it.tone : "muted"
          };
        }).slice(0, 3);
        // Removed padding logic
      }
    }

    res.status(200).json({
      themeKey: parsed.themeKey || "lavender",
      backgroundKey: parsed.backgroundKey || null,
      pillTitle: parsed.pillTitle || null,
      pillSub: parsed.pillSub || null,
      component: {
        role: parsed.component.role,
        variant: parsed.component.variant || {},
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Unknown error" });
  }
}
