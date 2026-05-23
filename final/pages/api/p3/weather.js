// Real-time weather for the test3 home stage. Pulls from Open-Meteo
// (no API key required, generous free tier) for Yeouido / Han River —
// same location as the goal card's Leaflet map. Maps the raw response
// to the shape the dot-weather-2x1-v1-1 renderer expects:
//   { location, weather, sunIcon, cycleLines: [string, string, string] }
//
// The three cycle lines are dynamically composed from current conditions
// so the card "breathes" with the actual weather (rain timing, humidity,
// pace recommendation). Falls back to a curated set if the upstream fetch
// fails — keeps the prototype usable offline.

const FALLBACK = {
  location: 'Seoul',
  weather:  'Rainy',
  sunIcon:  'pair-raindrop-dual',
  cycleLines: [
    'Rain expected in 18 min',
    'Humidity high, lighter pace recommended',
    'Good window to start now'
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

function buildLines(current, hourly, label) {
  var lines = [];
  // Line 1: minutes-until-rain inference from the hourly precipitation
  // probability series. Walk forward up to 6 hours; pick the first slot
  // with > 30 % chance and report when (rounded to nearest 5 min).
  try {
    var probs = hourly && hourly.precipitation_probability;
    if (Array.isArray(probs) && probs.length) {
      var foundIdx = -1;
      for (var i = 0; i < Math.min(6, probs.length); i++) {
        if (probs[i] != null && probs[i] >= 30) { foundIdx = i; break; }
      }
      if (foundIdx === 0)      lines.push('Rain expected within the hour');
      else if (foundIdx > 0)   lines.push('Rain expected in ' + foundIdx + ' hour' + (foundIdx > 1 ? 's' : ''));
      else                     lines.push('No rain in next 6 hours');
    }
  } catch (_) {}
  // Line 2: humidity-driven pace recommendation
  try {
    var h = current && current.relative_humidity_2m;
    if (typeof h === 'number') {
      if (h >= 80)      lines.push('Humidity ' + Math.round(h) + '%, lighter pace');
      else if (h >= 60) lines.push('Humidity ' + Math.round(h) + '%, steady pace');
      else              lines.push('Humidity ' + Math.round(h) + '%, comfortable');
    }
  } catch (_) {}
  // Line 3: temperature snapshot + suitability
  try {
    var t = current && current.temperature_2m;
    if (typeof t === 'number') {
      var tInt = Math.round(t);
      if (tInt < 5)        lines.push('Cold (' + tInt + '°C), warm up extra');
      else if (tInt > 28)  lines.push('Hot (' + tInt + '°C), hydrate often');
      else                 lines.push(tInt + '°C, ' + label.toLowerCase() + ' — good window');
    }
  } catch (_) {}
  // Pad to exactly 3 lines if any of the above failed.
  while (lines.length < 3) lines.push('Conditions stable');
  return lines.slice(0, 3);
}

export default async function handler(req, res) {
  try {
    // Yeouido — matches the test3 Leaflet map center.
    var url = 'https://api.open-meteo.com/v1/forecast'
      + '?latitude=37.5219&longitude=126.9248'
      + '&current=temperature_2m,relative_humidity_2m,precipitation,weather_code'
      + '&hourly=precipitation_probability'
      + '&forecast_hours=6'
      + '&timezone=auto';
    var r = await fetch(url, { method: 'GET' });
    if (!r.ok) return res.status(200).json(FALLBACK);
    var data = await r.json();
    var current = data && data.current;
    var hourly  = data && data.hourly;
    var code    = current && current.weather_code;
    var desc    = describeCode(typeof code === 'number' ? code : -1);
    var lines   = buildLines(current, hourly, desc.label);
    return res.status(200).json({
      location:   'Seoul',
      weather:    desc.label,
      sunIcon:    desc.icon,
      cycleLines: lines,
      temperatureC: current && typeof current.temperature_2m === 'number' ? current.temperature_2m : null,
      humidity:     current && typeof current.relative_humidity_2m === 'number' ? current.relative_humidity_2m : null,
      source:     'open-meteo'
    });
  } catch (_) {
    return res.status(200).json(FALLBACK);
  }
}
