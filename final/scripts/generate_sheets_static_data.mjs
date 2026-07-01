import fs from "node:fs/promises";
import path from "node:path";

// Usage:
//   node scripts/generate_sheets_static_data.mjs <SHEET_ID>
// If omitted, falls back to the historical default.
const SHEET_ID = process.argv?.[2] || "1E8UMK080DW05VXntVnUJpfr1X1nPAtvqHhzrwGIg0Ss";
const SHEET_NAMES = ["main", "about", "desc", "works", "members"];

function csvParse(text) {
  // RFC4180-ish CSV parser supporting quotes, commas, CRLF/LF, and multiline quoted fields.
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Avoid adding trailing empty last row from EOF
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        const next = text[i + 1];
        if (next === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === ",") {
      pushField();
      i += 1;
      continue;
    }

    if (c === "\r") {
      // Handle CRLF
      if (text[i + 1] === "\n") i += 2;
      else i += 1;
      pushField();
      pushRow();
      continue;
    }

    if (c === "\n") {
      i += 1;
      pushField();
      pushRow();
      continue;
    }

    field += c;
    i += 1;
  }

  // Flush last field/row if there is anything left
  pushField();
  // If the last row is a single empty field and nothing else, drop it
  if (!(row.length === 1 && row[0] === "" && rows.length > 0)) pushRow();

  // Trim trailing completely-empty rows
  while (rows.length > 0 && rows[rows.length - 1].every((x) => x === "")) {
    rows.pop();
  }

  return rows;
}

async function fetchSheetCsv(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download CSV for sheet=${sheetName} (status ${res.status})`);
  }
  return await res.text();
}

async function main() {
  const data = {};

  for (const name of SHEET_NAMES) {
    const csv = await fetchSheetCsv(name);
    data[name] = csvParse(csv);
  }

  const outDir = path.join(process.cwd(), "src", "app", "data");
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, "sheetsStatic.js");

  const header =
    `// AUTO-GENERATED from Google Sheets (CCID Web Q2)\n` +
    `// Source: https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit\n` +
    `// Do not edit by hand. Re-generate via: node scripts/generate_sheets_static_data.mjs\n\n`;

  const body =
    `export const sheetsStatic = ${JSON.stringify(data, null, 2)};\n`;

  await fs.writeFile(outFile, header + body, "utf8");
  process.stdout.write(`Wrote ${path.relative(process.cwd(), outFile)}\\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


