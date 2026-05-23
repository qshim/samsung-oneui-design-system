  css += ' * ' + (theme.name || 'Theme template') + ' //One UI GenUI theme\n';
  css += ' * Base: ' + (theme.id || 'unknown') + ' · Exported: ' + new Date().toISOString() + '\n';
  css += ' *\n';
  css += ' * Edit any --variable below. Save as theme.css and re-import\n';
  css += ' * via /customize //Import HTML to register a new theme.\n';
  css += ' *\n';
  css += ' * Optional metadata (parsed by the importer):\n';
  css += ' *   oneui-theme: { "name": "My Theme", "author": "you", "baseThemeId": "' + (theme.id || '') + '" }\n';
  css += ' */\n\n';
  css += ':root {\n';
  THEME_EDIT_SCHEMA.forEach((section, secIdx) => {
    if (secIdx > 0) css += '\n';
    css += '  /* ?? ' + section.section + ' ?? */\n';
    section.vars.forEach(v => {
      const val = themeVars[v.key] || '';
      if (val) css += '  ' + v.key + ': ' + val + ';\n';
    });
  });
  css += '}\n';

  // (2) theme.json //machine-readable counterpart. Same vars, plus
  //     metadata. The importer reads this directly when present.
  const meta = {
    schema:        'oneui.export/v1',
    exportedAt:    new Date().toISOString(),
    name:          theme.name || 'My Theme',
    baseThemeId:   theme.id || null,
    description:   theme.description || '',
    themeVars:     themeVars
  };
  const json = JSON.stringify(meta, null, 2);

  // (3) theme-preview.html //comprehensive offline gallery.
  //
  //     Composed from three live sources, captured at download time so
  //     the designer's current edits + active theme are baked in:
  //
  //       a) Cards-mode preview  //every themed card from #preview-grid
  //       b) Screen-mode preview //6 phone compositions w/ 1-col + 2-col mix
  //       c) components.html     //the 22 base One UI 8.5 components
  //
  //     Plus the three sources' inlined CSS (genui.css atomic styles,
  //     customize.html preview layout, components.html component styles)
  //     so the file renders standalone from any folder. theme.css is
  //     <link>ed LAST so the designer's tokens override the bases.
  const html = await _buildPreviewGalleryHTML(theme);

  // README inside the ZIP //gives any designer who receives the file
  // pack a 30-second orientation without needing access to the site.
  const readme =
    '# ' + (theme.name || 'Theme') + ' template\n\n' +
    'A self-contained bundle for tweaking the theme tokens of Samsung One UI GenUI.\n\n' +
    '## Files\n\n' +
    '- `theme.css` //the editable variables. Open in any code editor.\n' +
    '- `theme.json` //machine-readable mirror (the tool reads this on import).\n' +
    '- `theme-preview.html` //drag into a browser to verify your edits. Has three sections:\n' +
    '    1. **Cards** //every themed card from Customize //Cards mode\n' +
    '    2. **Screen compositions** //6 S26-ratio phones with mixed 1-col + 2-col groups\n' +
    '    3. **One UI 8.5 base components** //the full primitive set (Buttons, FAB,\n' +
    '       Toggle Switches, Checkboxes, Radios, Inputs, Search, Chips, Tabs, App Bar,\n' +
    '       Bottom Nav, Cards, List Items, Dialogs, Bottom Sheet, Sliders, Progress,\n' +
    '       Snackbar, Tooltips, Badges, Menus, Dividers //22 in total)\n\n' +
    '## Edit\n\n' +
    'Open `theme.css`, change any `--variable` value, save, refresh\n' +
    '`theme-preview.html` to verify.\n\n' +
    'Optional metadata at the top of `theme.css`:\n\n' +
    '```css\n' +
    '/*! oneui-theme: { "name": "Sunset Glow", "author": "you" } */\n' +
    '```\n\n' +
    '## Apply\n\n' +
    'Send the updated `theme.css` (or all three files) to whoever runs\n' +
    'the One UI GenUI site //they import via `/customize //Import theme`\n' +
    'and click Save to register your work as a new theme preset.\n';

  // Single ZIP download //bundling all three files dodges the browser's
  // multi-download throttle that previously delivered only the first
  // (theme.css), leaving designers without the json + preview files
  // they need to verify their work locally.
  if (typeof window.JSZip !== 'function') {
    showToast('ERROR: ZIP library not loaded yet //refresh and retry');
    return;
  }
  try {
    const zip = new window.JSZip();
    zip.file('theme.css',          css);
    zip.file('theme.json',         json);
    zip.file('theme-preview.html', html);
    zip.file('README.md',          readme);
    const baseId = (theme.id || 'theme').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'oneui-' + baseId + '-template.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    showToast('Downloaded · oneui-' + baseId + '-template.zip (4 files inside)');
  } catch (e) {
    console.error('[customize] zip generation failed:', e);
    showToast('ERROR: zip generation failed (' + e.message + ')');
  }
}

// ---------------------------------------------------------------------------
//  Import HTML //load theme from a self-contained export
//
//  The genui Export HTML button writes a file that embeds (a) all of
//  css/genui.css inline, (b) the active <style id="theme-vars">
//  block, (c) any unsaved inline overrides, and (d) a JSON metadata
//  comment of the form:
//
//    <!-- ONEUI_EXPORT_META:{"schema":"oneui.export/v1",...}:END -->
//
//  This handler reads the file as text, extracts that JSON block first
//  (cheapest path), falls back to regex-scraping `:root { --xxx: // }`
//  if metadata is missing, applies each --xxx via _writeVar so the
//  preview updates live, and marks the editor unsaved so a Save
//  persists it as a brand-new theme.
// ---------------------------------------------------------------------------
// Whitelist of theme variable prefixes //used to filter out base
// design-system tokens (--primary, --bg, etc.) that live in the
// inlined genui.css inside the new gallery HTML. Without this filter
// an unsuspecting designer who imports theme-preview.html would
// accidentally overwrite their theme tokens with the base palette.
// The whitelist matches the prefixes used by THEME_EDIT_SCHEMA in
// this same file.
const _THEME_VAR_PREFIXES = [
  '--font-', '--letter-spacing', '--line-height',
  '--space-', '--screen-', '--gap-', '--container-',
  '--card-', '--qs-', '--nowbar-', '--fab-',
  '--surface-', '--text-primary', '--text-secondary', '--text-tertiary',
  '--accent-', '--primary-', '--oneui-theme-style', '--preview-bg'
];
function _isThemeVar(key) {
  if (!key || typeof key !== 'string') return false;
  return _THEME_VAR_PREFIXES.some(p => key.startsWith(p));
}

// ZIP path //accept the whole download bundle as-is. Designer drops
// `oneui-<theme>-template.zip` directly without unpacking. We read
// the embedded theme.json (preferred) or theme.css; theme-preview.html
// + README.md are intentionally skipped.
async function _parseZipFile(file) {
  if (typeof window.JSZip !== 'function') {
    return { vars: {}, source: 'skipped · JSZip not loaded', name: file.name, error: 'JSZip missing' };
  }
  let zip;
  try {
    const ab = await file.arrayBuffer();
    zip = await window.JSZip.loadAsync(ab);
  } catch (e) {
    return { vars: {}, source: 'skipped · not a valid zip', name: file.name, error: e.message };
  }
  // Find candidate files inside (case-insensitive, allow nested folders).
  const entries = Object.keys(zip.files);
  const findEntry = (pattern) => entries.find(p => pattern.test(p));
  const jsonEntry = findEntry(/(^|\/)theme\.json$/i);
  const cssEntry  = findEntry(/(^|\/)theme\.css$/i);

  // Prefer theme.json //exact values, no parsing risk.
  if (jsonEntry) {
    const txt = await zip.files[jsonEntry].async('string');
    try {
      const meta = JSON.parse(txt);
      if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
        return {
          vars: meta.themeVars,
          source: 'zip · ' + jsonEntry + ' (' + Object.keys(meta.themeVars).length + ' vars)',
          name: file.name,
          themeName: meta.name || null
        };
      }
    } catch (e) { /* fall through to CSS */ }
  }
  // Fall back to theme.css inside the zip.
  if (cssEntry) {
    const txt = await zip.files[cssEntry].async('string');
    const vars = _scrapeCssRootVars(txt);
    if (Object.keys(vars).length > 0) {
      return {
        vars,
        source: 'zip · ' + cssEntry + ' (' + Object.keys(vars).length + ' vars)',
        name: file.name
      };
    }
  }
  return {
    vars: {},
    source: 'zip · no theme.json or theme.css found',
    name: file.name,
    error: 'expected theme.json or theme.css inside the zip'
  };
}

// Scrape `:root { --xxx: value; }` blocks from a CSS-ish text and
// return them as an object. Shared by CSS files and the legacy
// inline-CSS HTML export fallback.
function _scrapeCssRootVars(text) {
  const out = {};
  if (!text) return out;
  const rootBlockRe = /:root[^{]*\{([^}]*)\}/g;
  let block;
  while ((block = rootBlockRe.exec(text)) !== null) {
    const varRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let m;
    while ((m = varRe.exec(block[1])) !== null) {
      out[m[1].trim()] = m[2].trim();
    }
  }
  return out;
}

// Parse a single file //its themeVars + a tag describing the source.
// Pure function //does NOT touch :root or the editor. Caller (the
// multi-file import handler) merges the maps and applies them.
async function _parseThemeFile(file) {
  if (!file) return { vars: {}, source: '(empty)', name: '(empty)' };
  const MAX_BYTES = 8 * 1024 * 1024;   // bumped to 8 MB to fit the comprehensive gallery zip + preview html
  if (file.size > MAX_BYTES) {
    return { vars: {}, source: 'skipped · too large', name: file.name, error: 'too large (' + Math.round(file.size / 1024) + ' KB)' };
  }

  // ZIP-aware path //bypass text parsing entirely for .zip files.
  const fname = (file.name || '').toLowerCase();
  if (fname.endsWith('.zip')) {
    return await _parseZipFile(file);
  }

  let text = '';
  try { text = await file.text(); }
  catch (e) { return { vars: {}, source: 'skipped · read failure', name: file.name, error: e.message }; }

  // Format detection //same handler accepts .html (full export with
  // metadata comment), .css (just the theme vars), or .json (machine
  // export from /customize //Download template). Detection is by
  // extension first, then by content sniffing as a safety net.
  const looksJSON = fname.endsWith('.json') ||
                    /^\s*\{[\s\S]*"themeVars"\s*:/m.test(text);
  const looksCSS  = fname.endsWith('.css')  ||
                    (/:root[^{]*\{/.test(text) && !/<!DOCTYPE|<html/i.test(text) && !looksJSON);

  let themeVars = null;
  let importedFrom = null;

  // (1a) JSON path //parse the file as a metadata document directly.
  if (looksJSON && !themeVars) {
    try {
      const meta = JSON.parse(text);
      if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
        themeVars = meta.themeVars;
        importedFrom = 'json · ' + (meta.name || meta.baseThemeId || 'theme.json');
      }
    } catch (e) {
      console.warn('[import] JSON parse failed:', e.message);
    }
  }

  // (1b) HTML metadata comment path //fast, structured. Old genui
  // Export HTML used this; new gallery preview omits it.
  if (!themeVars) {
    const metaMatch = text.match(/<!--\s*ONEUI_EXPORT_META:([\s\S]*?):END\s*-->/);
    if (metaMatch) {
      try {
        const meta = JSON.parse(metaMatch[1]);
        if (meta && meta.themeVars && typeof meta.themeVars === 'object') {
          themeVars = meta.themeVars;
          importedFrom = 'metadata · ' + (meta.exportedAt || 'unknown date');
        }
      } catch (e) {
        console.warn('[import] metadata JSON parse failed, falling back to CSS scan:', e.message);
      }
    }
  }

  // (1c) GALLERY PREVIEW DETECTION //the new theme-preview.html links to
  // an external theme.css and inlines the base genui.css. Importing it
  // alone would scrape the base :root tokens (wrong: not the user's
  // theme). Tell the user what to do instead.
  if (!themeVars && fname.endsWith('.html')) {
    const isGalleryPreview = /<link[^>]+href="theme\.css"/i.test(text) ||
                             /body class="tp-page"/.test(text);
    if (isGalleryPreview) {
      return {
        vars: {},
        source: 'gallery preview · cannot import alone',
        name: file.name,
        error: 'theme-preview.html links to theme.css externally. Drop the .zip or theme.css/theme.json instead.'
      };
    }
  }

  // (1d) CSS comment metadata //designer-authored .css files MAY include
  //   /*! oneui-theme: { "name": "...", "baseThemeId": "...", ... } */
  //  We don't need it for the vars themselves but capture the name.
  let cssMetaName = null;
  if (looksCSS) {
    const cssMeta = text.match(/oneui-theme\s*:\s*(\{[\s\S]*?\})/);
    if (cssMeta) {
      try { cssMetaName = JSON.parse(cssMeta[1]).name || null; }
      catch (_) { /* optional, ignore */ }
    }
  }

  // (2) Fallback: scrape every `:root { --xxx: VALUE; }` block. Works
  // for raw CSS files AND for legacy HTML exports lacking the metadata
  // comment. For HTML inputs we additionally filter by theme-var
  // prefix so an accidental import of a file that bundles base CSS
  // (e.g. a self-contained genui export) doesn't bring in --primary /
  // --bg / etc. //only tokens the editor actually owns.
  if (!themeVars) {
    const scraped = _scrapeCssRootVars(text);
    if (looksCSS) {
      // CSS files are trusted //designer wrote them, no filter.
      themeVars = scraped;
    } else {
      // HTML scan //filter to theme-token prefixes only.
      themeVars = {};
      Object.keys(scraped).forEach(k => {
        if (_isThemeVar(k)) themeVars[k] = scraped[k];
      });
    }
    const sourceTag = looksCSS ? 'css' : 'html-scan';
    importedFrom = sourceTag + (cssMetaName ? (' · ' + cssMetaName) : '') +
                   ' · ' + Object.keys(themeVars).length + ' vars';
  }

  return { vars: themeVars || {}, source: importedFrom || '(unknown)', name: file.name };
}

// Top-level handler //accepts ONE OR MANY files, parses each, then
// merges them in selection order (later files win on conflicts) and
// applies the merged map in one pass. Designers can split their work
// into multiple .css files (theme-base.css + theme-overrides.css) or
// drop a {.css, .json, .html} bundle and have it merge cleanly.
async function importThemeFiles(files) {
  const list = Array.from(files || []);
  if (list.length === 0) return;

  const reports = [];
  const merged = {};
  for (const file of list) {
    const r = await _parseThemeFile(file);
    reports.push(r);
    if (r.vars) {
      // Later files overwrite earlier on conflict.
      Object.keys(r.vars).forEach(k => {
        if (r.vars[k]) merged[k] = r.vars[k];
      });
    }
  }

  const keys = Object.keys(merged);
  if (keys.length === 0) {
    const errs = reports.filter(r => r.error).map(r => r.name + ': ' + r.error).join('; ');
    showToast('ERROR: no theme variables found' + (errs ? ' (' + errs + ')' : ''));
    return;
  }

  // Apply the merged map. _writeVar already marks unsaved + the
  // editor input listeners trigger a preview re-render on the next
  // tick. We still rebuild the editor body explicitly so all inputs
  // reflect the new values immediately.
  let applied = 0;
  keys.forEach(k => {
    if (!merged[k]) return;
    _writeVar(k, merged[k]);
    applied += 1;
  });
  buildEditorBody();
  renderPreviewGrid();

  // Build a friendly summary toast //single-file shows the source tag,
  // multi-file shows file count + total var count.
  let summary;
  if (reports.length === 1) {
    summary = 'Imported ' + applied + ' theme var(s) from ' + reports[0].name;
  } else {
    summary = 'Merged ' + reports.length + ' files · ' + applied + ' theme var(s)';
  }
  showToast(summary + ' //name + Save to keep');
  console.log('[import] ' + summary);
  reports.forEach(r => console.log('   · ' + r.name + ' (' + r.source + ')' + (r.error ? ' [error: ' + r.error + ']' : '')));
}

// Back-compat alias //older code paths or external scripts may still
// call importHTMLFile() with a single file. Forwards to the multi
// handler so behavior is identical.
async function importHTMLFile(file) { return importThemeFiles(file ? [file] : []); }

// Wire up the file input + button. Hidden input pattern keeps the
// styling consistent with the rest of the toolbar. The input has the
// `multiple` attribute, so e.target.files can hold any number of
// files; the handler merges them in selection order.
(function _wireImportTheme() {
  const btn = document.getElementById('btn-import-html');
  const input = document.getElementById('import-html-file');
  if (!btn || !input) return;
  btn.addEventListener('click', () => input.click());
  input.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files && files.length) await importThemeFiles(files);
    input.value = '';   // reset so re-picking the same files still fires
  });
})();

// Drag-and-drop: any file dropped anywhere in the customize window
// triggers the import path. While a drag is in progress we show a
// fullscreen overlay so the user knows it's a valid drop target.
//
// Implementation details:
//   - dragenter/dragleave use a counter pattern because dragleave
//     fires every time the cursor crosses a child element, not just
//     when leaving the window
//   - we only react when the drag carries actual files (not text,
//     selected divs, etc.) //that's the `types.includes('Files')` check
//   - the overlay is created on first dragenter so the markup cost is
//     deferred until the user actually drags something in
(function _wireImportDragDrop() {
  let dragDepth = 0;
  let overlay = null;
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'import-dropzone-overlay';
    overlay.innerHTML =
      '<div class="dropzone-card">' +
      '  <div class="dropzone-icon" aria-hidden="true">&#8615;</div>' +
      '  <div class="dropzone-title">Drop to import theme</div>' +
      '  <div class="dropzone-hint">accepts .zip / .css / .json / .html · drop multiple files to merge</div>' +
      '</div>';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '9999',
      background: 'rgba(3, 129, 254, 0.10)',
      backdropFilter: 'blur(6px)', webkitBackdropFilter: 'blur(6px)',
      display: 'none', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', /* let the drop event reach the body */
      transition: 'opacity 0.12s ease'
    });
    // Inner card styling //uses fixed values rather than CSS vars so
    // the overlay reads the same regardless of the active theme.
    const style = document.createElement('style');
    style.textContent =
      '#import-dropzone-overlay .dropzone-card{padding:36px 44px;border-radius:24px;background:rgba(10,10,12,0.85);border:2px dashed rgba(3,129,254,0.65);color:#fff;text-align:center;max-width:520px;}' +
      '#import-dropzone-overlay .dropzone-icon{font-size:48px;line-height:1;margin-bottom:16px;color:#0381FE;}' +
      '#import-dropzone-overlay .dropzone-title{font-size:20px;font-weight:700;letter-spacing:-0.3px;margin-bottom:6px;}' +
      '#import-dropzone-overlay .dropzone-hint{font-size:13px;color:rgba(255,255,255,0.65);}';
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    return overlay;
  }
  function carriesFiles(e) {
    if (!e.dataTransfer || !e.dataTransfer.types) return false;
    // Modern browsers expose `types` as a DOMStringList; convert.
    return Array.from(e.dataTransfer.types).indexOf('Files') !== -1;
  }
  window.addEventListener('dragenter', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth += 1;
    const ov = ensureOverlay();
    ov.style.display = 'flex';
  });
  window.addEventListener('dragover', (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();   // required for `drop` to fire
    e.dataTransfer.dropEffect = 'copy';
  });
  window.addEventListener('dragleave', (e) => {
    if (!carriesFiles(e)) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0 && overlay) overlay.style.display = 'none';
  });
  window.addEventListener('drop', async (e) => {
    if (!carriesFiles(e)) return;
    e.preventDefault();
    dragDepth = 0;
    if (overlay) overlay.style.display = 'none';
    const files = e.dataTransfer.files;
    if (files && files.length) {
      await importThemeFiles(files);
    }
  });
})();

// Wire the Download template button //produces a single .zip with
// theme.css + theme.json + theme-preview.html + README.md so designers
// receive every file they need in one download (single-download keeps
// the browser's multi-download throttle out of the picture).
(function _wireDownloadTemplate() {
  const btn = document.getElementById('btn-download-template');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await downloadThemeTemplate(); }
    catch (e) { console.error('[customize] download template failed:', e); showToast('ERROR: ' + e.message); }
  });
})();

// Left panel: header toggles whole editor-body; each schema section toggles
// its own .editor-section-body. buildEditorBody() runs on boot and on
// theme / preview selection changes.

// ---------------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------------
async function boot() {
  try {
    const data = await fetchJSON('/api/themes');
    THEMES = data.themes || [];
    ACTIVE_ID = data._active;
    // Build dropdown
    const sel = $('theme-select');
    sel.innerHTML = THEMES.map(t =>
      '<option value="' + t.id + '">' + t.name + '</option>'
    ).join('');
    sel.value = ACTIVE_ID;
    updateOnSelect(ACTIVE_ID, false);
    // Wait for renderer to be ready (the script tag is async-ish; if not
    // ready yet, retry once on next tick).
    if (typeof window.renderAtomicForRole === 'function') {
      renderPreviewGrid();
    } else {
      setTimeout(renderPreviewGrid, 50);
    }
  } catch (e) {
    console.error('boot failed', e);
    document.body.innerHTML = '<div style="padding:32px;color:#EF4444;">Failed to load themes: ' + e.message + '</div>';
  }
}

function updateOnSelect(id, applyServer) {
  SELECTED_PREVIEW_INDEX = null;
  INSPECTOR_LAYER = null;
  INSPECTOR_DOM_PATH = null;
  PREVIEW_CELL_VAR_OVERRIDES = {};
  const theme = THEMES.find(t => t.id === id);
  if (!theme) return;
  applyThemeVars(theme.vars);
  if (isFlatThemeActive()) setFlatScheme(FLAT_SCHEME, false);
  else updateFlatSchemeToggle();
  $('active-pill').textContent = (theme.id === ACTIVE_ID ? 'Active · ' : 'Preview · ') + theme.name;
  // Re-render preview so any cards that compute color from vars at render
  // time pick up the new values.
  renderPreviewGrid();
  // Always rebuild editor inputs //they should reflect the newly-
  // selected theme's values. (The panel is no longer collapsible.)
  buildEditorBody();
}

$('theme-select').addEventListener('change', (e) => {
  SELECTED_PREVIEW_INDEX = null;
  INSPECTOR_LAYER = null;
  INSPECTOR_DOM_PATH = null;
  var pickedId = e.target.value;
  updateOnSelect(pickedId, false);
  var picked = THEMES.find(function (t) { return t.id === pickedId; });
  if (picked) {
    showToast('\ubbf8\ub9ac\ubcf4\uae30 \ud14c\ub9c8: ' + picked.name);
  }
  _markUnsaved(false);
});

document.getElementById('flat-scheme-toggle')?.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.flat-scheme-btn');
  if (!btn || !this.contains(btn) || !isFlatThemeActive()) return;
  setFlatScheme(btn.getAttribute('data-flat-scheme'), true);
});

document.getElementById('preview-bg-swatches')?.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('.preview-bg-swatch');
  if (!btn || !this.contains(btn)) return;
  var bg = btn.getAttribute('data-preview-bg');
  if (!bg) return;
  document.documentElement.style.setProperty('--preview-bg', bg);
  this.querySelectorAll('.preview-bg-swatch').forEach(function (swatch) {
    swatch.setAttribute('aria-pressed', swatch === btn ? 'true' : 'false');
  });
});

// btn-apply ("Apply to Site") and btn-reset ("Reset preview") removed //// their roles are now folded into Save (which both creates a new theme
// AND sets it active) and Discard (which clears unsaved edits without
// touching the server). The dropdown's onChange already handles preset
// switching.

(function wireEditorPanelDelegates() {
  var panel = document.getElementById('editor-panel');
  if (!panel || panel.__delegatesBound) return;
  panel.__delegatesBound = true;
  panel.addEventListener('input', function (e) {
    if (!e.target.closest('#editor-body')) return;
    _onEditorInput(e);
  });
  panel.addEventListener('change', function (e) {
    if (!e.target.closest('#editor-body')) return;
    _onEditorInput(e);
  });
  panel.addEventListener('click', function (e) {
    var t = e.target;
    var pToggle = t.closest && t.closest('.editor-panel-toggle');
    if (pToggle) {
      e.preventDefault();
      var pel = document.getElementById('editor-panel');
      if (pel) {
        var collapsed = pel.classList.toggle('is-collapsed');
        pToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      }
      return;
    }
    var sToggle = t.closest && t.closest('.editor-section-toggle');
    if (sToggle) {
      e.preventDefault();
      var wasOpen = sToggle.getAttribute('aria-expanded') === 'true';
      sToggle.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
      var bid = sToggle.getAttribute('aria-controls');
      var sBody = bid && document.getElementById(bid);
      if (sBody) sBody.hidden = wasOpen;
      return;
    }
    if (t.closest && t.closest('#btn-save')) { e.preventDefault(); saveAsCustom(); return; }
    if (t.closest && t.closest('#btn-discard')) { e.preventDefault(); discardChanges(); return; }
    if (t.closest && t.closest('#btn-clear-focus')) {
      e.preventDefault();
      setInspectorByKind(null);
      _highlightActiveScreenCards();
      return;
    }
    if (t.closest && t.closest('#btn-show-all-vars')) {
      e.preventDefault();
      SELECTED_PREVIEW_INDEX = null;
      INSPECTOR_LAYER = null;
      INSPECTOR_DOM_PATH = null;
      PREVIEW_CELL_VAR_OVERRIDES = {};
      renderPreviewGrid();
      buildEditorBody();
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !INSPECTOR_LAYER || !$('editor-body')) return;
    INSPECTOR_LAYER = null;
    INSPECTOR_DOM_PATH = null;
    buildEditorBody();
    updateEditorScopeUI();
    _applyInspectorOutline();
  });
})();

(function wirePreviewGridDelegates() {
  var grid = $('preview-grid');
  if (!grid || grid.__delegatesBound) return;
  grid.__delegatesBound = true;
  function applyPreviewSelection(idx) {
    INSPECTOR_LAYER = null;
    INSPECTOR_DOM_PATH = null;
    if (SELECTED_PREVIEW_INDEX === idx) SELECTED_PREVIEW_INDEX = null;
    else SELECTED_PREVIEW_INDEX = idx;
    if (SELECTED_PREVIEW_INDEX === null) PREVIEW_CELL_VAR_OVERRIDES = {};
    renderPreviewGrid();
    buildEditorBody();
    updateEditorScopeUI();
  }
  grid.addEventListener('click', function (e) {
    if (e.detail !== 1) return;
    var cell = e.target.closest('.preview-cell');
    if (!cell || !grid.contains(cell)) return;
    var raw = cell.getAttribute('data-preview-index');
    if (raw == null || raw === '') return;
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    e.preventDefault();
    applyPreviewSelection(idx);
  });
  grid.addEventListener('dblclick', function (e) {
    var stage = e.target.closest && e.target.closest('.preview-cell .stage');
    var cell = e.target.closest && e.target.closest('.preview-cell');
    if (!stage || !cell || !grid.contains(cell)) return;
    e.preventDefault();
    e.stopPropagation();
    var raw = cell.getAttribute('data-preview-index');
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    if (SELECTED_PREVIEW_INDEX !== idx) SELECTED_PREVIEW_INDEX = idx;
    var card = PREVIEW_CARDS[idx];
    var targetEl = e.target.nodeType === 3 ? e.target.parentElement : e.target;
    var hit = _resolveInspectorLayer(card, targetEl, stage);
    INSPECTOR_LAYER = hit;
    INSPECTOR_DOM_PATH = hit ? { idx: idx, path: _domPathFromStage(stage, targetEl) } : null;
    renderPreviewGrid();
    buildEditorBody();
    updateEditorScopeUI();
  });
  grid.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var cell = e.target.closest('.preview-cell');
    if (!cell || !grid.contains(cell)) return;
    var raw = cell.getAttribute('data-preview-index');
    if (raw == null || raw === '') return;
    e.preventDefault();
    var idx = parseInt(raw, 10);
    if (isNaN(idx)) return;
    applyPreviewSelection(idx);
  });
})();

boot();
