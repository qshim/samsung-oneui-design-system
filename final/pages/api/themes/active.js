import { setActiveTheme } from "../../../lib/themes/themeStore";

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const body = req.body || {};
    const data = setActiveTheme(body.id);
    res.status(200).json({ active: data._active });
  } catch (error) {
    if (/unknown theme id/i.test(error.message)) {
      res.status(400).json({ error: error.message });
      return;
    }

    res.status(500).json({ error: error.message });
  }
}
