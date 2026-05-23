import { readThemes, saveTheme } from "../../../lib/themes/themeStore";

export default function handler(req, res) {
  if (req.method === "GET") {
    try {
      const data = readThemes();
      res.status(200).json(data);
      return;
    } catch (error) {
      res.status(500).json({ error: error.message });
      return;
    }
  }

  if (req.method === "POST") {
    try {
      const body = req.body || {};
      const result = saveTheme(body.theme, body.replace === true);
      res.status(200).json(result);
      return;
    } catch (error) {
      if (error.code === "THEME_EXISTS") {
        res.status(409).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message });
      return;
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  res.status(405).json({ error: "Method not allowed" });
}
