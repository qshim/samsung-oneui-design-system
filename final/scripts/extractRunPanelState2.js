/* eslint-disable no-console */
/**
 * Extract orange dot coordinates from a run-panel reference image.
 *
 * Usage (PowerShell):
 *   node scripts/extractRunPanelState2.js --in "C:\path\to\image.png" --out "public\datasets\runPanelState2.json"
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function argValue(args, key, fallback = null) {
  const idx = args.indexOf(key);
  if (idx < 0) return fallback;
  return args[idx + 1] ?? fallback;
}

function isOrange(r, g, b) {
  // tuned for #FF7F24-ish dots on black
  return r > 200 && g > 70 && g < 180 && b < 120;
}
function isGray(r, g, b) {
  // tuned for medium gray dots on black
  return r > 40 && r < 140 && Math.abs(r - g) < 14 && Math.abs(r - b) < 14;
}

function clustersFromProjection(proj, thr) {
  const idxs = [];
  for (let i = 0; i < proj.length; i++) if (proj[i] > thr) idxs.push(i);
  const centers = [];
  if (!idxs.length) return centers;
  let s = idxs[0];
  let p = idxs[0];
  for (let k = 1; k < idxs.length; k++) {
    const v = idxs[k];
    if (v === p + 1) {
      p = v;
      continue;
    }
    centers.push((s + p) / 2);
    s = v;
    p = v;
  }
  centers.push((s + p) / 2);
  return centers;
}

function nearestIndex(arr, v) {
  let best = 0;
  let bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v);
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}

async function main() {
  const args = process.argv.slice(2);
  const inPath = argValue(args, '--in');
  const outPathArg = argValue(args, '--out', 'public/datasets/runPanelState2.json');
  if (!inPath) {
    console.error('Missing --in <imagePath>');
    process.exit(1);
  }

  const outPath = path.isAbsolute(outPathArg)
    ? outPathArg
    : path.join(process.cwd(), outPathArg);

  const { data, info } = await sharp(inPath).raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const C = info.channels;

  const orange = new Uint8Array(W * H);
  const gray = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * C];
    const g = data[i * C + 1];
    const b = data[i * C + 2];
    if (isOrange(r, g, b)) orange[i] = 1;
    if (isGray(r, g, b)) gray[i] = 1;
  }

  // Connected components on orange mask → blob centers.
  const visited = new Uint8Array(W * H);
  const comps = [];
  const qx = new Int32Array(W * H);
  const qy = new Int32Array(W * H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      if (!orange[idx] || visited[idx]) continue;
      let head = 0;
      let tail = 0;
      qx[tail] = x;
      qy[tail] = y;
      tail++;
      visited[idx] = 1;

      let sumX = 0;
      let sumY = 0;
      let count = 0;
      while (head < tail) {
        const cx = qx[head];
        const cy = qy[head];
        head++;
        const cidx = cy * W + cx;
        sumX += cx;
        sumY += cy;
        count++;

        // 4-neighbors
        if (cx > 0) {
          const ni = cidx - 1;
          if (orange[ni] && !visited[ni]) {
            visited[ni] = 1;
            qx[tail] = cx - 1;
            qy[tail] = cy;
            tail++;
          }
        }
        if (cx < W - 1) {
          const ni = cidx + 1;
          if (orange[ni] && !visited[ni]) {
            visited[ni] = 1;
            qx[tail] = cx + 1;
            qy[tail] = cy;
            tail++;
          }
        }
        if (cy > 0) {
          const ni = cidx - W;
          if (orange[ni] && !visited[ni]) {
            visited[ni] = 1;
            qx[tail] = cx;
            qy[tail] = cy - 1;
            tail++;
          }
        }
        if (cy < H - 1) {
          const ni = cidx + W;
          if (orange[ni] && !visited[ni]) {
            visited[ni] = 1;
            qx[tail] = cx;
            qy[tail] = cy + 1;
            tail++;
          }
        }
      }

      // Filter noise blobs
      if (count >= 10) comps.push({ cx: sumX / count, cy: sumY / count, px: count });
    }
  }

  // Infer grid centers from gray projection peaks.
  const xProj = new Int32Array(W);
  const yProj = new Int32Array(H);
  for (let y = 0; y < H; y++) {
    const base = y * W;
    for (let x = 0; x < W; x++) {
      if (!gray[base + x]) continue;
      xProj[x]++;
      yProj[y]++;
    }
  }
  const xMax = xProj.reduce((m, v) => (v > m ? v : m), 0);
  const yMax = yProj.reduce((m, v) => (v > m ? v : m), 0);
  const cols = clustersFromProjection(xProj, xMax * 0.6);
  const rows = clustersFromProjection(yProj, yMax * 0.6);

  if (!cols.length || !rows.length) {
    console.error('Failed to infer grid centers. cols=', cols.length, 'rows=', rows.length);
    process.exit(2);
  }

  const coordsSet = new Set();
  for (const c of comps) {
    const ix = nearestIndex(cols, c.cx);
    const iy = nearestIndex(rows, c.cy);
    coordsSet.add(`${ix},${iy}`);
  }
  const coords = [...coordsSet]
    .map(s => s.split(',').map(n => parseInt(n, 10)))
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));

  const xs = coords.map(p => p[0]);
  const ys = coords.map(p => p[1]);
  const out = {
    source: { path: inPath, width: W, height: H },
    grid: {
      cols: cols.length,
      rows: rows.length,
      colCenters: cols,
      rowCenters: rows
    },
    orangeDots: {
      count: coords.length,
      coords
    },
    bounds: {
      xMin: Math.min(...xs),
      xMax: Math.max(...xs),
      yMin: Math.min(...ys),
      yMax: Math.max(...ys)
    }
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log('saved', outPath);
  console.log('grid', out.grid.cols, 'x', out.grid.rows, 'orangeDots', out.orangeDots.count);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

