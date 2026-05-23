import fs from "fs";
import path from "path";

const themesPath = path.join(process.cwd(), "design", "themes", "themes.json");

export function getThemesPath() {
  return themesPath;
}

export function readThemes() {
  const filePath = getThemesPath();
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

export function writeThemes(data) {
  const filePath = getThemesPath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  return data;
}

export function setActiveTheme(id) {
  const data = readThemes();
  const themeExists = Array.isArray(data.themes) && data.themes.some((theme) => theme.id === id);

  if (!themeExists) {
    throw new Error("unknown theme id: " + id);
  }

  data._active = id;
  return writeThemes(data);
}

export function saveTheme(theme, replace = false) {
  if (!theme || !theme.id || !theme.name || !theme.vars) {
    throw new Error("theme requires { id, name, vars }");
  }

  const data = readThemes();
  const existingIndex = data.themes.findIndex((item) => item.id === theme.id);

  if (existingIndex >= 0 && !replace) {
    const error = new Error("theme id already exists; pass replace:true to overwrite");
    error.code = "THEME_EXISTS";
    throw error;
  }

  if (existingIndex >= 0) {
    data.themes[existingIndex] = theme;
  } else {
    data.themes.push(theme);
  }

  writeThemes(data);
  return { saved: theme.id, total: data.themes.length };
}
