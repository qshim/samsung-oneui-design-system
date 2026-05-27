// Real-time weather for the test3 home stage. Pulls from Open-Meteo
// (no API key required, generous free tier) for Yeouido / Han River —
// same location as the goal card's Leaflet map. Maps the raw response
// to the shape the dot-weather-2x1-v1-1 renderer expects:
//   { location, weather, sunIcon, cycleLines: [string, string, string] }
//
// The three stack lines are compact Korean labels — temperature,
// humidity, fine dust — one slot per row on the weather card.

const FALLBACK = {
  location: 'Seoul',
  weather:  'Rainy',
  sunIcon:  'pair-raindrop-dual',
  cycleLines: [
    '온도 18°',
    '습도 58%',
    '미세먼지 보통'
  ],
  source: 'fallback'
};

// Open-Meteo's WMO weather codes → short English label + which dot-icon
// variant from the existing weather card library best matches.
function describeCode(code) {
  if (code === 0)                                  return { label: 'Clear',    icon: 'pair-sun-dual'        };
  if (code >= 1 && code <= 3)                      return { label: 'Cloudy',   icon: 'pair-cloud-dual'      };
  if (code === 45 || code === 48)                  return { label: 'Foggy',    icon: 'pair-cloud-dual'      };
  if ((code >= 51 && code <= 55))                  return { label: 'Drizzle',  icon: 'pair-raindrop-dual'   };
  if ((code >= 61 && code <= 65) || (code >= 80 && code <= 82)) return { label: 'Rainy', icon: 'pair-raindrop-dual' };
  if (code >= 71 && code <= 77)                    return { label: 'Snowy',    icon: 'pair-snowflake-dual'  };
  if (code >= 95 && code <= 99)                    return { label: 'Storm',    icon: 'pair-raindrop-dual'   };
  return { label: 'Mild', icon: 'pair-cloud-dual' };
}

function pm25Label(v) {
  if (typeof v !== 'number' || isNaN(v)) return '보통';
  if (v <= 15) return '좋음';
  if (v <= 35) return '보통';
  if (v <= 75) return '나쁨';
  return '매우 나쁨';
}

function buildLines(current, pm25) {
  var t = current && current.temperature_2m;
  var h = current && current.relative_humidity_2m;
  return [
    typeof t === 'number' ? '온도 ' + Math.round(t) + '°' : '온도 —',
    typeof h === 'number' ? '습도 ' + Math.round(h) + '%' : '습도 —',
    '미세먼지 ' + pm25Label(pm25)
  ];
}

async function fetchPm25() {
  try {
    var url = 'https://air-quality-api.open-meteo.com/v1/air-quality'
      + '?latitude=37.5219&longitude=126.9248'
      + '&current=pm2_5';
    var r = await fetch(url, { method: 'GET' });
    if (!r.ok) return null;
    var data = await r.json();
    var pm = data && data.current && data.current.pm2_5;
    return typeof pm === 'number' ? pm : null;
  } catch (_) {
    return null;
  }
}

export default async function handler(req, res) {
  try {
    // Yeouido — matches the test3 Leaflet map center.
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=37.5219&longitude=126.9248'
      + '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code'
      + '&timezone=auto';
    var results = await Promise.all([
      fetch(url, { method: 'GET' }),
      fetchPm25()
    ]);
    var r = results[0];
    var pm25 = results[1];
    if (!r.ok) return res.status(200).json(FALLBACK);
    var data = await r.json();
    var current = data && data.current;
    var code    = current && current.weather_code;
    var desc    = describeCode(typeof code === 'number' ? code : -1);
    var lines   = buildLines(current, pm25);
    return res.status(200).json({
      location:   'Seoul',
      weather:    desc.label,
      sunIcon:    desc.icon,
      cycleLines: lines,
      temperatureC: current && typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
      humidity:     current && typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null,
      pm25:         pm25,
      source:     'open-meteo'
    });
  } catch (_) {
    return res.status(200).json(FALLBACK);
  }
}
