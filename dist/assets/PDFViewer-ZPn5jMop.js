import{r,an as t}from"./vendor-C1WfLDDx.js";import{O as Ot,bE as At,n as it}from"./vendor-lucide-CLvHgTfq.js";const lt=["67cd74715bea46c247e48155e2c6d8e6","4ef55f2fecee8424ce5a46bc1ee6ceac"],Dt="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",$t="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",ue="https://textriva.vercel.app/",Ut=`
/* system fonts only (offline) */
:root {
  --surface2: color-mix(in srgb, var(--surface) 94%, var(--text) 6%);
  --surface3: color-mix(in srgb, var(--surface) 88%, var(--text) 12%);
  --surface4: color-mix(in srgb, var(--surface) 84%, var(--text) 16%);
  --border2: color-mix(in srgb, var(--border) 62%, var(--text) 38%);
  --text-dim: color-mix(in srgb, var(--text) 42%, var(--bg) 58%);
  --text-mid: color-mix(in srgb, var(--text) 62%, var(--bg) 38%);
  --accent: #4f8ef7;
  --accent-dim: rgba(79,142,247,0.15);
  --accent2: #a78bfa;
  --green: #3dd68c;
  --green-dim: rgba(61,214,140,0.12);
  --yellow: #f5c842;
  --yellow-dim: rgba(245,200,66,0.12);
  --red: #f87171;
  --red-dim: rgba(248,113,113,0.12);
  --orange: #fb923c;
  --lens-b:#4285f4; --lens-r:#ea4335; --lens-y:#fbbc05; --lens-g:#34a853;
  --r: 6px;
  --r2: 10px;
  --r3: 14px;
  --font: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  --font-display: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, 'Roboto Mono', 'Courier New', monospace;
  --shadow-sm: 0 1px 4px rgba(0,0,0,0.18);
  --shadow: 0 4px 20px rgba(0,0,0,0.14);
  --shadow-lg: 0 8px 40px rgba(0,0,0,0.18);
  --sidebar-w: 220px;
  --ocr-w: 360px;
  --topbar-h: 48px;
  --statusbar-h: 22px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
.pv-root {
  background: var(--bg);
  color: var(--text);
  font-family: var(--font);
  font-size: 13px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  user-select: none;
}

/* ── TOPBAR ── */
.topbar {
  height: var(--topbar-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 10px;
  flex-shrink: 0;
  z-index: 100;
  overflow: hidden;
}
.tb-cluster {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;
}
.tb-cluster-nav,
.tb-cluster-zoom,
.tb-cluster-tools,
.tb-cluster-meta {
  gap: 4px;
}
.tb-cluster-meta {
  margin-left: auto;
}
.tb-btn {
  width: 30px; height: 30px;
  border: 1px solid transparent; background: transparent;
  border-radius: var(--r); color: var(--text-dim);
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; transition: background 0.13s, color 0.13s;
  flex-shrink: 0; position: relative;
}
.tb-btn:hover:not(:disabled) { background: var(--surface2); color: var(--text); }
.tb-btn:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.tb-btn:disabled { opacity: 0.3; cursor: default; }
.tb-btn svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
.tb-page-nav { display: flex; align-items: center; gap: 4px; }
.tb-page-input {
  width: 38px; height: 26px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); color: var(--text);
  font-size: 11px; text-align: center; outline: none;
  font-family: var(--font-mono);
  transition: border-color 0.13s;
}
.tb-page-input:focus { border-color: var(--accent); }
.tb-total { font-size: 11px; color: var(--text-dim); font-family: var(--font-mono); white-space: nowrap; }
.tb-zoom {
  height: 26px; background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); color: var(--text); font-size: 11px;
  padding: 0 5px; outline: none; cursor: pointer; font-family: var(--font-mono);
}
.tb-zoom option { background: var(--surface2); }
.tb-mode {
  display: flex; gap: 2px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r2); padding: 2px;
}
.tb-mode-btn {
  padding: 3px 11px; border-radius: 8px;
  border: none; cursor: pointer;
  font-size: 11px; font-weight: 600; letter-spacing: 0.02em;
  transition: all 0.13s; font-family: var(--font);
  white-space: nowrap;
}
.tb-mode-btn.on { background: var(--accent); color: #fff; box-shadow: 0 0 0 1px rgba(79,142,247,0.4); }
.tb-mode-btn:not(.on) { background: transparent; color: var(--text-dim); }
.tb-mode-btn:not(.on):hover { color: var(--text); }
.tb-mode-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--accent-dim);
}
.tb-mobile-toggle { display: none; }
.tb-mobile-menu { display: none; }
.tb-filename {
  font-size: 11px; color: var(--text-mid); max-width: 200px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: var(--font-mono);
}

/* ── SEARCH BAR ── */
.search-bar {
  display: flex; align-items: center; gap: 5px;
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r); padding: 0 7px; height: 26px;
  transition: border-color 0.13s;
}
.search-bar.focus { border-color: var(--accent); }
.search-input {
  background: none; border: none; color: var(--text);
  font-size: 12px; width: 150px; outline: none; font-family: var(--font);
}
.search-input::placeholder { color: var(--text-dim); }
.search-count { font-size: 10px; color: var(--text-dim); white-space: nowrap; font-family: var(--font-mono); min-width: 36px; }

/* ── BODY ── */
.pv-body { display: flex; flex: 1; overflow: hidden; }

/* ── SIDEBAR ── */
.sidebar {
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.2s ease;
  flex-shrink: 0;
}
.sidebar.open { width: var(--sidebar-w); }
.sidebar.closed { width: 0; border-right: none; }
.s-tabs {
  display: flex; border-bottom: 1px solid var(--border);
  flex-shrink: 0; padding: 0 4px; gap: 1px;
}
.s-tab {
  flex: 1; padding: 8px 0; text-align: center; cursor: pointer;
  color: var(--text-dim); border-bottom: 2px solid transparent;
  font-size: 10px; font-weight: 600; letter-spacing: 0.04em;
  text-transform: uppercase; transition: all 0.13s;
}
.s-tab:hover { color: var(--text); }
.s-tab.on { color: var(--accent); border-bottom-color: var(--accent); }
.s-body { flex: 1; overflow-y: auto; overflow-x: hidden; }
.s-body::-webkit-scrollbar { width: 2px; }
.s-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 1px; }

/* THUMBNAILS */
.thumb-item {
  padding: 8px; cursor: pointer; transition: background 0.12s;
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.thumb-item:hover { background: var(--surface2); }
.thumb-item.on { background: var(--accent-dim); }
.thumb-wrap {
  width: 136px; height: 178px;
  background: #fff; border-radius: 3px;
  border: 1.5px solid transparent; overflow: hidden;
  display: flex; align-items: center; justify-content: center;
  position: relative;
}
.thumb-item.on .thumb-wrap { border-color: var(--accent); }
.thumb-wrap canvas { width: 100%; height: 100%; object-fit: contain; }
.thumb-page-num { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); }
.thumb-ocr-dot {
  position: absolute; top: 4px; right: 4px;
  width: 8px; height: 8px; border-radius: 50%;
}
.thumb-ocr-dot.done { background: var(--green); }
.thumb-ocr-dot.ready { background: var(--accent); }
.thumb-ocr-dot.uploading { background: var(--yellow); animation: pulse 1s infinite; }

/* TOC */
.toc-item {
  padding: 7px 10px; cursor: pointer;
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
  transition: background 0.12s; border-radius: 5px; margin: 2px 6px;
}
.toc-item:hover { background: var(--surface2); }
.toc-title { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.toc-pg { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); flex-shrink: 0; }

/* INFO TABLE */
.info-tbl { width: 100%; border-collapse: collapse; }
.info-tbl td { padding: 7px 10px; font-size: 11px; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,0.04); }
.info-tbl td:first-child { color: var(--text-dim); white-space: nowrap; width: 70px; }
.info-tbl td:last-child { color: var(--text); word-break: break-all; }

/* ── VIEWER ── */
.viewer {
  flex: 1; overflow: auto; display: flex; flex-direction: column;
  align-items: center; padding: 28px 0 60px; gap: 20px;
  background: var(--bg); position: relative;
}
.viewer::-webkit-scrollbar { width: 7px; }
.viewer::-webkit-scrollbar-track { background: var(--surface); }
.viewer::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }
.viewer::-webkit-scrollbar-thumb:hover { background: var(--text-dim); }
.page-wrap { position: relative; flex-shrink: 0; box-shadow: var(--shadow); border-radius: 1px; }
.page-wrap canvas { display: block; }
.page-lbl {
  position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%);
  font-size: 10px; color: var(--text-dim); white-space: nowrap;
  font-family: var(--font-mono);
}
.page-ocr-badge {
  position: absolute; top: 5px; right: 5px;
  padding: 2px 7px; border-radius: 999px;
  font-size: 9px; font-weight: 700; letter-spacing: 0.06em;
  pointer-events: none;
}
.page-ocr-badge.done { background: var(--green-dim); color: var(--green); border: 1px solid var(--green); }
.page-ocr-badge.ready { background: var(--accent-dim); color: var(--accent); border: 1px solid var(--accent); }
.page-ocr-badge.uploading { background: var(--yellow-dim); color: var(--yellow); border: 1px solid var(--yellow); }

/* DROP ZONE */
.drop-zone {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  z-index: 5;
}
.drop-inner {
  border: 2px dashed var(--border2); border-radius: 20px;
  padding: 60px 80px; display: flex; flex-direction: column;
  align-items: center; gap: 16px;
  background: color-mix(in srgb, var(--surface) 90%, var(--text) 10%); backdrop-filter: blur(8px);
  text-align: center; transition: all 0.2s; cursor: pointer;
}
.drop-inner:hover, .drop-inner.drag { border-color: var(--accent); background: rgba(79,142,247,0.06); }
.drop-emoji { font-size: 56px; }
.drop-title { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: var(--text); }
.drop-sub { font-size: 13px; color: var(--text-dim); line-height: 1.8; }
.drop-btn {
  background: var(--accent); color: #fff; border: none;
  padding: 9px 28px; border-radius: var(--r); cursor: pointer;
  font-size: 13px; font-weight: 600; transition: filter 0.15s; font-family: var(--font);
  box-shadow: 0 0 0 1px rgba(79,142,247,0.4), 0 4px 12px rgba(79,142,247,0.3);
}
.drop-btn:hover { filter: brightness(1.1); }
.drop-formats { font-size: 11px; color: var(--text-dim); margin-top: -4px; }
.drop-features {
  display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 4px;
}
.drop-feat-tag {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: 999px; padding: 3px 10px; font-size: 10px; color: var(--text-mid);
}

/* ── OCR PANEL ── */
.ocr-panel {
  background: var(--surface);
  border-left: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow: hidden; transition: width 0.2s ease;
  flex-shrink: 0;
}
.ocr-panel.open { width: var(--ocr-w); }
.ocr-panel.closed { width: 0; border-left: none; }

.ocr-header {
  padding: 0 12px;
  background: var(--surface2);
  border-bottom: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 0;
  flex-shrink: 0;
}
.ocr-header-top {
  height: 42px; display: flex; align-items: center; gap: 8px;
}
.ocr-title {
  flex: 1; font-family: var(--font-display); font-size: 13px; font-weight: 700;
  display: flex; align-items: center; gap: 6px;
}
.ocr-title-logo { display: flex; align-items: center; }
.g-b{color:#4285f4}.g-r{color:#ea4335}.g-y{color:#fbbc05}.g-g{color:#34a853}
.g-logo { font-family: var(--font-display); font-size: 13px; font-weight: 800; letter-spacing: -0.02em; }
.ocr-header-actions {
  display: flex; gap: 5px; padding-bottom: 9px;
}
.ocr-action-btn {
  flex: 1; padding: 5px 8px; border-radius: var(--r);
  border: 1px solid var(--border); cursor: pointer;
  background: var(--surface3); color: var(--text-mid);
  font-size: 10px; font-weight: 600; font-family: var(--font);
  display: flex; align-items: center; justify-content: center; gap: 4px;
  transition: all 0.13s; white-space: nowrap;
}
.ocr-action-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.ocr-action-btn.primary { background: var(--accent); color: #fff; border-color: var(--accent); }
.ocr-action-btn.primary:hover { filter: brightness(1.1); }
.ocr-action-btn.green { background: var(--green-dim); color: var(--green); border-color: var(--green); }
.ocr-action-btn:disabled { opacity: 0.35; cursor: default; }

.ocr-progress {
  margin: 8px 12px; padding: 7px 10px; border-radius: var(--r);
  background: var(--surface2); border: 1px solid var(--border);
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.ocr-progress-label { font-size: 11px; color: var(--text-dim); flex-shrink: 0; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ocr-progress-bar-wrap { flex: 1; height: 3px; background: var(--border); border-radius: 2px; overflow: hidden; }
.ocr-progress-bar { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s ease; }
.ocr-progress-pct { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); flex-shrink: 0; min-width: 28px; text-align: right; }

.ocr-body { flex: 1; overflow-y: auto; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.ocr-body::-webkit-scrollbar { width: 3px; }
.ocr-body::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

.ocr-empty {
  padding: 24px 16px; text-align: center; color: var(--text-dim); font-size: 12px; line-height: 1.8;
}
.ocr-empty-icon { font-size: 36px; margin-bottom: 10px; }
.ocr-workflow-steps {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r2); padding: 12px; margin: 8px 12px;
  display: flex; flex-direction: column; gap: 8px; flex-shrink: 0;
}
.ocr-workflow-title { font-size: 10px; font-weight: 700; color: var(--text-mid); letter-spacing: 0.06em; text-transform: uppercase; }
.ocr-wf-step {
  display: flex; align-items: flex-start; gap: 8px;
}
.ocr-wf-num {
  width: 18px; height: 18px; border-radius: 50%;
  background: var(--surface3); border: 1px solid var(--border2);
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700; color: var(--text-dim);
  flex-shrink: 0; margin-top: 1px;
}
.ocr-wf-text { font-size: 11px; color: var(--text-dim); line-height: 1.5; }

/* OCR PAGE CARD */
.ocr-card {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r2); padding: 10px;
  display: flex; flex-direction: column; gap: 8px;
  transition: all 0.15s;
}
.ocr-card.current { border-color: var(--accent); background: rgba(79,142,247,0.05); }
.ocr-card.done { border-color: var(--green); background: rgba(61,214,140,0.04); }
.ocr-card-head {
  display: flex; align-items: center; gap: 6px;
}
.ocr-card-page {
  font-size: 10px; font-family: var(--font-mono); color: var(--text-dim);
  background: var(--surface3); padding: 1px 6px; border-radius: 4px; flex-shrink: 0;
}
.ocr-card-status-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
.ocr-card-status-dot.pending { background: var(--text-dim); }
.ocr-card-status-dot.uploading { background: var(--yellow); animation: pulse 1s infinite; }
.ocr-card-status-dot.ready { background: var(--accent); }
.ocr-card-status-dot.done { background: var(--green); }
.ocr-card-status-dot.error { background: var(--red); }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

.ocr-card-status-txt { font-size: 10px; font-weight: 600; }
.ocr-card-status-txt.pending { color: var(--text-dim); }
.ocr-card-status-txt.uploading { color: var(--yellow); }
.ocr-card-status-txt.ready { color: var(--accent); }
.ocr-card-status-txt.done { color: var(--green); }
.ocr-card-status-txt.error { color: var(--red); }
.ocr-card-go { margin-left: auto; font-size: 10px; color: var(--accent); cursor: pointer; padding: 1px 4px; border-radius: 3px; }
.ocr-card-go:hover { background: var(--accent-dim); }

.lens-btn {
  width: 100%; padding: 7px 10px; border-radius: var(--r);
  font-size: 11px; font-weight: 700; border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  transition: all 0.15s; font-family: var(--font);
}
.lens-btn.active { background: var(--accent); color: #fff; box-shadow: 0 2px 8px rgba(79,142,247,0.35); }
.lens-btn.active:hover { filter: brightness(1.1); transform: translateY(-1px); }
.lens-btn.done { background: var(--green-dim); color: var(--green); border: 1px solid rgba(61,214,140,0.4); }
.lens-btn.done:hover { filter: brightness(1.1); }
.lens-btn:disabled { opacity: 0.35; cursor: default; }

.ocr-text-label {
  font-size: 9px; font-weight: 700; color: var(--text-dim);
  letter-spacing: 0.06em; text-transform: uppercase;
  display: flex; justify-content: space-between; align-items: center;
}
.ocr-text-chars { font-size: 9px; color: var(--text-dim); font-family: var(--font-mono); }
.ocr-textarea {
  width: 100%; min-height: 72px; max-height: 150px;
  background: var(--surface3); border: 1px solid var(--border);
  border-radius: var(--r); color: var(--text);
  font-size: 11px; font-family: var(--font-mono); line-height: 1.7;
  padding: 7px 8px; resize: vertical; outline: none; user-select: text;
  transition: border-color 0.13s;
}
.ocr-textarea:focus { border-color: var(--accent); }
.ocr-textarea::placeholder { color: var(--text-dim); font-style: italic; }

.ocr-card-actions { display: flex; gap: 4px; flex-wrap: wrap; }
.sm-btn {
  flex: 1; min-width: 60px; padding: 5px 6px; border-radius: 5px;
  font-size: 10px; font-weight: 600; border: 1px solid var(--border);
  cursor: pointer; background: var(--surface3); color: var(--text-dim);
  transition: all 0.13s; font-family: var(--font);
  display: flex; align-items: center; justify-content: center; gap: 3px;
}
.sm-btn:hover { border-color: var(--accent); color: var(--accent); background: var(--accent-dim); }
.sm-btn.save { background: var(--green-dim); color: var(--green); border-color: rgba(61,214,140,0.4); }
.sm-btn.save:hover { filter: brightness(1.1); }

/* OCR RESULTS */
.ocr-results {
  border: 1px solid rgba(61,214,140,0.3);
  border-radius: var(--r2); overflow: hidden;
  background: rgba(61,214,140,0.03); flex-shrink: 0;
  margin: 0 0 4px;
}
.ocr-results-head {
  padding: 8px 10px; background: rgba(61,214,140,0.07);
  border-bottom: 1px solid rgba(61,214,140,0.2);
  display: flex; align-items: center; justify-content: space-between;
}
.ocr-results-title { font-size: 11px; font-weight: 700; color: var(--green); display: flex; align-items: center; gap: 5px; }
.ocr-results-meta { font-size: 10px; color: var(--text-dim); font-family: var(--font-mono); }
.ocr-results-body { padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.ocr-all-textarea {
  width: 100%; min-height: 90px; max-height: 180px;
  background: var(--surface3); border: 1px solid var(--border);
  border-radius: var(--r); color: var(--text);
  font-size: 10px; font-family: var(--font-mono); line-height: 1.7;
  padding: 7px 8px; resize: vertical; outline: none; user-select: text;
}
.ocr-results-btns { display: flex; gap: 5px; }
.ocr-tip { font-size: 10px; color: var(--text-dim); padding: 8px 10px; text-align: center; line-height: 1.6; border-top: 1px solid var(--border); }

/* Textriva redirect button */
.textriva-btn {
  margin: 8px 10px 4px;
  padding: 8px 12px; border-radius: var(--r2);
  background: linear-gradient(135deg, rgba(79,142,247,0.08), rgba(167,139,250,0.08));
  border: 1px solid rgba(167,139,250,0.3);
  display: flex; align-items: center; gap: 8px; cursor: pointer;
  transition: all 0.2s; flex-shrink: 0;
}
.textriva-btn:hover { border-color: var(--accent2); background: rgba(167,139,250,0.12); }
.textriva-btn-content { flex: 1; }
.textriva-btn-title { font-size: 11px; font-weight: 700; color: var(--accent2); margin-bottom: 1px; }
.textriva-btn-sub { font-size: 10px; color: var(--text-dim); line-height: 1.4; }
.textriva-btn-icon { font-size: 20px; }
.textriva-btn-arrow { font-size: 14px; color: var(--text-dim); }

/* ── STATUSBAR ── */
.statusbar {
  height: var(--statusbar-h); background: var(--surface); border-top: 1px solid var(--border);
  display: flex; align-items: center; padding: 0 12px; gap: 14px;
  font-size: 10px; color: var(--text-dim); flex-shrink: 0; font-family: var(--font-mono);
}
.status-item { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
.status-dot { width: 5px; height: 5px; border-radius: 50%; }
.status-dot.green { background: var(--green); }
.status-dot.yellow { background: var(--yellow); }
.status-dot.dim { background: var(--text-dim); }

/* ── FULLSCREEN OVERLAY ── */
.fs-overlay {
  position: fixed; inset: 0; background: color-mix(in srgb, var(--bg) 78%, #000 22%); z-index: 9999;
  display: flex; flex-direction: column;
}
.fs-bar {
  height: 46px; background: color-mix(in srgb, var(--surface) 18%, #000 82%); backdrop-filter: blur(10px);
  position: absolute; top: 0; left: 0; right: 0;
  display: flex; align-items: center; padding: 0 14px; gap: 8px; z-index: 10;
  transition: opacity 0.3s;
}
.fs-bar.hide { opacity: 0; pointer-events: none; }
.fs-viewer {
  flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start;
  padding: 56px 24px 24px; cursor: none;
}
.fs-page-indicator {
  position: absolute; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: color-mix(in srgb, var(--surface) 16%, #000 84%); backdrop-filter: blur(8px);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 999px;
  padding: 5px 16px; font-size: 11px; color: rgba(255,255,255,0.6);
  font-family: var(--font-mono); pointer-events: none;
  transition: opacity 0.3s;
}
.fs-close-hint {
  position: absolute; top: 52px; right: 16px;
  font-size: 10px; color: color-mix(in srgb, var(--text) 26%, transparent);
  font-family: var(--font-mono);
}

/* ── TOASTS ── */
.toasts { position: fixed; bottom: 20px; right: 20px; z-index: 99999; display: flex; flex-direction: column; gap: 6px; pointer-events: none; }
.toast {
  background: var(--surface2); border: 1px solid var(--border);
  border-radius: var(--r2); padding: 8px 14px;
  font-size: 12px; color: var(--text); box-shadow: var(--shadow);
  display: flex; align-items: center; gap: 7px; animation: toastIn 0.2s ease;
  min-width: 180px; max-width: 320px; pointer-events: all;
}
.toast.ok { border-color: rgba(61,214,140,0.5); }
.toast.err { border-color: rgba(248,113,113,0.5); }
@keyframes toastIn { from{opacity:0;transform:translateX(16px)} to{opacity:1;transform:translateX(0)} }

/* ── SPINNER ── */
.spinner-wrap {
  position: absolute; inset: 0; background: color-mix(in srgb, var(--bg) 80%, #000 20%);
  display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 12px; z-index: 20; border-radius: inherit;
}
.spinner {
  width: 32px; height: 32px; border: 2.5px solid var(--border);
  border-top-color: var(--accent); border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to{transform:rotate(360deg)} }
.spinner-label { font-size: 12px; color: var(--text-dim); }

/* ── LOADING BAR ── */
.load-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 2px;
  background: var(--accent); z-index: 30;
  transition: width 0.3s ease;
  box-shadow: 0 0 8px rgba(79,142,247,0.6);
}

/* ── EMPTY STATE ── */
.empty-state { padding: 20px 10px; text-align: center; color: var(--text-dim); font-size: 11px; line-height: 1.7; }

/* ── URL OPEN MODAL ── */
.modal-overlay {
  position: fixed; inset: 0; background: color-mix(in srgb, var(--bg) 72%, #000 28%); z-index: 10000;
  display: flex; align-items: center; justify-content: center; backdrop-filter: blur(4px);
}
.modal {
  background: var(--surface2); border: 1px solid var(--border2);
  border-radius: var(--r3); padding: 20px; min-width: 360px; max-width: 480px;
  box-shadow: var(--shadow-lg);
}
.modal-title { font-family: var(--font-display); font-size: 15px; font-weight: 800; margin-bottom: 12px; }
.modal-input {
  width: 100%; height: 34px; background: var(--surface3); border: 1px solid var(--border);
  border-radius: var(--r); color: var(--text); font-size: 12px; padding: 0 10px;
  outline: none; font-family: var(--font-mono); margin-bottom: 12px;
  transition: border-color 0.13s; user-select: text;
}
.modal-input:focus { border-color: var(--accent); }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-btn {
  padding: 7px 18px; border-radius: var(--r); border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; font-family: var(--font); transition: filter 0.13s;
}
.modal-btn.cancel { background: var(--surface3); color: var(--text-mid); border: 1px solid var(--border); }
.modal-btn.cancel:hover { border-color: var(--border2); }
.modal-btn.confirm { background: var(--accent); color: #fff; }
.modal-btn.confirm:hover { filter: brightness(1.1); }

@media (max-width: 1024px) {
  .tb-filename { max-width: 140px; }
  .search-input { width: 120px; }
  .ocr-panel.open { width: min(44vw, 320px); }
}

@media (max-width: 768px) {
  .pv-root {
    height: 100dvh;
  }
  .topbar {
    min-height: 42px;
    height: 42px;
    padding: 4px 6px;
    gap: 4px;
    flex-wrap: nowrap;
    align-content: center;
    overflow-x: auto;
    overflow-y: hidden;
    border-bottom-color: color-mix(in srgb, var(--border) 70%, var(--accent) 30%);
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .topbar.mobile-fixed {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 300;
    background: color-mix(in srgb, var(--surface) 96%, var(--text) 4%);
    backdrop-filter: blur(10px);
    box-shadow: 0 1px 0 rgba(0,0,0,0.2);
    transition: transform 0.2s ease;
    justify-content: space-between;
    padding: 6px 8px;
  }
  .topbar::-webkit-scrollbar { display: none; }
  .tb-cluster {
    width: max-content;
    flex-wrap: nowrap;
  }
  .tb-cluster-nav {
    width: auto;
    flex: 1 1 auto;
    min-width: 0;
  }
  .tb-cluster-zoom {
    display: none;
  }
  .tb-cluster-tools,
  .tb-cluster-meta,
  .tb-mobile-toggle,
  .tb-mobile-menu {
    display: none;
  }
  .tb-sep {
    display: none;
  }
  .tb-cluster-mobile-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    flex: 0 0 auto;
  }
  .tb-filename {
    display: none;
  }
  .tb-page-nav {
    gap: 3px;
    min-width: 0;
    flex: 0 0 auto;
  }
  .tb-page-input {
    width: 44px;
    height: 26px;
    font-size: 11px;
  }
  .tb-btn {
    width: 30px;
    height: 30px;
  }
  .tb-btn svg {
    width: 15px;
    height: 15px;
  }
  .tb-cluster-mobile-actions .tb-mode-btn {
    min-height: 30px;
    padding: 0 10px;
    font-size: 10px;
    letter-spacing: 0.02em;
  }
  .pv-body {
    position: relative;
    margin-top: 42px;
  }
  .s-tabs {
    padding: 0 8px;
  }
  .s-tab:nth-child(n+2) {
    display: none;
  }
  .s-tab:first-child {
    flex: 1;
  }
  .sidebar.open {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: min(82vw, 300px);
    z-index: 20;
    box-shadow: 8px 0 32px rgba(0,0,0,0.45);
  }
  .ocr-panel.open {
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: min(88vw, 340px);
    z-index: 20;
    box-shadow: -8px 0 32px rgba(0,0,0,0.45);
  }
  .viewer {
    padding: 16px 0 56px;
  }
  .drop-inner {
    padding: 36px 20px;
    width: calc(100vw - 32px);
  }
  .modal {
    min-width: 0;
    width: calc(100vw - 24px);
    padding: 16px;
  }
  .search-bar.mobile {
    width: 100%;
    height: auto;
    padding: 6px 8px;
    flex-wrap: wrap;
  }
  .search-bar.mobile .search-input {
    width: 100%;
    min-width: 0;
    height: 28px;
  }
}

@media (max-width: 540px) {
  :root {
    --sidebar-w: 88vw;
    --ocr-w: 92vw;
  }
  .topbar {
    padding: 5px 6px;
  }
  .tb-cluster {
    gap: 2px;
  }
  .tb-btn { width: 28px; height: 28px; }
  .tb-page-nav {
    gap: 2px;
    flex: 0 0 auto;
  }
  .tb-page-input { width: 38px; height: 24px; }
  .tb-filename {
    display: none;
  }
  .statusbar {
    gap: 8px;
    padding: 0 10px;
  }
  .thumb-wrap {
    width: 118px;
    height: 156px;
  }
  .ocr-header {
    padding: 0 10px;
  }
  .ocr-progress,
  .ocr-workflow-steps,
  .textriva-btn {
    margin-left: 8px;
    margin-right: 8px;
  }
}
`,c=({d:x,s:v=15,...j})=>t.jsx("svg",{width:v,height:v,viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"1.8",strokeLinecap:"round",strokeLinejoin:"round",...j,children:Array.isArray(x)?x.map((f,N)=>t.jsx("path",{d:f},N)):t.jsx("path",{d:x})}),d={sidebar:"M3 3h18v18H3zM9 3v18",prev:"M15 18l-6-6 6-6",next:"M9 18l6-6-6-6",zoomIn:"M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6",zoomOut:"M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM8 11h6",rotate:"M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",search:"M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0",expand:"M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",compress:"M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3",download:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",print:"M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",copy:"M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1",columns:"M3 3h8v18H3zM13 3h8v18h-8",x:"M18 6L6 18M6 6l12 12",upload:"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",fit:"M21 9H3M21 15H3M9 3v18M15 3v18",paste:"M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",check:"M20 6L9 17l-5-5"};function It(x){return new Promise((v,j)=>{const f=new FileReader;f.onload=()=>v(f.result.split(",")[1]),f.onerror=j,f.readAsDataURL(x)})}async function Bt(x,v=3800){return x.size/1024<=v?x:new Promise(j=>{const f=new Image,N=URL.createObjectURL(x);f.onload=()=>{URL.revokeObjectURL(N);const l=x.size>8e6?.55:x.size>5e6?.7:.85,n=document.createElement("canvas");n.width=Math.round(f.width*l),n.height=Math.round(f.height*l),n.getContext("2d").drawImage(f,0,0,n.width,n.height),n.toBlob(L=>j(L||x),"image/jpeg",.88)},f.onerror=()=>j(x),f.src=N})}async function dt(x,v=0){const j=await Bt(x),f=await It(j),N=new URLSearchParams;N.append("key",lt[v%lt.length]),N.append("image",f),N.append("expiration","600");const n=await(await fetch("https://api.imgbb.com/1/upload",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:N.toString()})).json();if(n.success)return n.data.url;if(v===0)return dt(x,1);throw new Error(n.error?.message||"Upload failed")}function ct(x){return x<1024?x+" B":x<1024*1024?(x/1024).toFixed(1)+" KB":(x/1024/1024).toFixed(2)+" MB"}function Vt(){const[x,v]=r.useState([]),j=r.useCallback((f,N="",l=3200)=>{const n=Math.random().toString(36).slice(2);v(L=>[...L,{id:n,msg:f,type:N}]),setTimeout(()=>v(L=>L.filter(u=>u.id!==n)),l)},[]);return{toasts:x,add:j}}function Zt({initialUrl:x,initialName:v,onTextExtracted:j,onClose:f}){const{toasts:N,add:l}=Vt(),[n,L]=r.useState(null),[u,pt]=r.useState(0),[g,q]=r.useState(1),[be,V]=r.useState("1"),[h,Te]=r.useState(1.25),[O,Le]=r.useState(0),[J,Oe]=r.useState(!1),[D,xt]=r.useState(""),[Ae,ut]=r.useState(0),[me,$]=r.useState(!1),[H,U]=r.useState(0),[C,De]=r.useState([]),[bt,$e]=r.useState([]),[Ue,Ie]=r.useState([]),[mt,Be]=r.useState([]),[ft,Ve]=r.useState(!0),[Q,He]=r.useState("thumbs"),[ht,W]=r.useState(!1),[fe,ee]=r.useState("viewer"),[M,G]=r.useState(!1),[Z,A]=r.useState(1),[he,We]=r.useState(1.5),[Ge,Ze]=r.useState(null),[te,ge]=r.useState(!0),[ae,re]=r.useState(!1),[oe,_e]=r.useState(""),[k,Xe]=r.useState([]),[_,se]=r.useState(0),[gt,Ye]=r.useState(!1),[vt,ve]=r.useState(!1),[we,X]=r.useState(!1),[ye,Ke]=r.useState(""),[Ht,ne]=r.useState("page"),[S,wt]=r.useState(!1),[m,E]=r.useState([]),[ie,qe]=r.useState({show:!1,pct:0,label:""}),I=r.useRef(null),je=r.useRef(null),le=r.useRef(null),ke=r.useRef(null),Je=r.useRef(0),[Qe,yt]=r.useState(0),jt=r.useRef(null),Ne=r.useRef(1.25),Ce=r.useRef(!1),kt=r.useRef(0),ce=r.useRef(!1),de=r.useRef(!1),et=r.useRef(!1),ze=r.useRef(!1),pe=r.useRef(0),tt=r.useRef(1.25);r.useRef(0),r.useEffect(()=>{const e=()=>{const a=window.innerWidth<=768;wt(a),a?(ne("width"),He("thumbs"),et.current||(Ve(!1),W(!1),ze.current=!1,ce.current=!1)):ne("page"),et.current=a};return e(),window.addEventListener("resize",e),()=>window.removeEventListener("resize",e)},[]),r.useEffect(()=>{(()=>{if(window.pdfjsLib){le.current=window.pdfjsLib,x&&B(x,v||"document.pdf");return}const a=document.createElement("script");a.src=Dt,a.onload=()=>{window.pdfjsLib.GlobalWorkerOptions.workerSrc=$t,le.current=window.pdfjsLib,x&&B(x,v||"document.pdf")},document.head.appendChild(a)})()},[]),r.useEffect(()=>{const e=document.createElement("style");return e.textContent=Ut,document.head.appendChild(e),()=>e.remove()},[]);const F=r.useCallback(e=>{const a=Number.isFinite(h)?h:1.25,o=typeof e=="function"?e(a):e,s=Number.isFinite(o)?o:1.25,i=Math.max(.25,Math.min(4,+s.toFixed(2)));Ne.current=i,Ce.current=!1,de.current=!0,ne("page"),Te(i)},[h]),Y=r.useCallback((e,a=h)=>{const o=Number.isFinite(a)?a:1.25,s=Je.current-60;if(!(e>0)||s<=0)return!1;const i=e/o;if(!(i>0))return!1;const p=Math.min(4,+(s/i).toFixed(2));return Ne.current=o,Ce.current=!0,de.current=!1,ce.current=!0,ne("width"),kt.current=s,Te(p),!0},[h]),Nt=r.useCallback(()=>{C[0]&&Y(C[0].canvas.width,h)},[C,h,Y]);r.useEffect(()=>{!S||de.current||ce.current||!C[0]||!Qe||Y(C[0].canvas.width,h)},[S,C.length,Y,Qe,h]),r.useEffect(()=>{const e=a=>{const o=document.activeElement?.tagName,s=o==="INPUT"||o==="TEXTAREA";a.key==="Escape"&&(M&&G(!1),ae&&re(!1),we&&X(!1)),!s&&n&&((a.key==="ArrowLeft"||a.key==="ArrowUp")&&w(g-1),(a.key==="ArrowRight"||a.key==="ArrowDown")&&w(g+1),a.key==="Home"&&w(1),a.key==="End"&&w(u),(a.key==="+"||a.key==="=")&&F(i=>Math.min(4,+(i+.25).toFixed(2))),a.key==="-"&&F(i=>Math.max(.25,+(i-.25).toFixed(2))),a.key==="0"&&F(1),(a.key==="f"||a.key==="F")&&G(i=>!i)),(a.ctrlKey||a.metaKey)&&a.key==="f"&&!s&&(a.preventDefault(),re(i=>!i)),M&&(a.key==="ArrowLeft"&&A(i=>Math.max(1,i-1)),a.key==="ArrowRight"&&A(i=>Math.min(u,i+1)))};return window.addEventListener("keydown",e),()=>window.removeEventListener("keydown",e)},[M,ae,we,n,g,u,F]),r.useEffect(()=>{if(!I.current)return;const e=new ResizeObserver(a=>{const o=Math.round(a[0].contentRect.width);Je.current=o,yt(o)});return e.observe(I.current),()=>e.disconnect()},[]),r.useEffect(()=>{if(!M)return;const e=()=>{ge(!0),clearTimeout(ke.current),ke.current=setTimeout(()=>ge(!1),2800)};return window.addEventListener("mousemove",e),e(),()=>{window.removeEventListener("mousemove",e),clearTimeout(ke.current)}},[M]),r.useEffect(()=>{!M||!n||(async()=>{try{const e=await n.getPage(Math.min(Z,u)),a=e.getViewport({scale:he}),o=document.createElement("canvas");o.width=a.width,o.height=a.height,await e.render({canvasContext:o.getContext("2d"),viewport:a}).promise,Ze(o.toDataURL("image/jpeg",.92))}catch{Ze(null)}})()},[M,Z,he,n]),r.useEffect(()=>{if(!oe.trim()||!n){Xe([]);return}let e=!1;return(async()=>{const a=[];for(let o=1;o<=u&&!e;o++)try{const p=(await(await n.getPage(o)).getTextContent()).items.map(z=>z.str).join(" ").toLowerCase(),b=oe.toLowerCase();let y=p.indexOf(b),R=0;for(;y!==-1&&R<20;)a.push({page:o,idx:y}),y=p.indexOf(b,y+1),R++}catch{}e||(Xe(a),se(0),a.length&&w(a[0].page))})(),()=>{e=!0}},[oe,n,u]),r.useEffect(()=>{const e=I.current;if(!e)return;const a=()=>{const o=e.scrollTop+e.clientHeight/2;let s=null,i=1/0;if(e.querySelectorAll("[data-page]").forEach(p=>{const b=Math.abs(p.offsetTop+p.offsetHeight/2-o);b<i&&(i=b,s=p)}),s){const p=parseInt(s.dataset.page);p!==g&&q(p)}};return e.addEventListener("scroll",a,{passive:!0}),()=>e.removeEventListener("scroll",a)},[g]);const B=r.useCallback(async(e,a,o=0)=>{if(!le.current){l("PDF.js is loading, try again shortly","err");return}$(!0),U(10),xt(a||"document.pdf"),ut(o),q(1),V("1"),Ne.current=1.25,Ce.current=!1,de.current=!1,ce.current=!1,De([]),$e([]),E([]),Ie([]),Be([]);try{U(25);const s=await le.current.getDocument(e).promise;L(s),pt(s.numPages),q(1),V("1"),U(40);const i=Array.from({length:s.numPages},(p,b)=>({id:`p${b+1}-${Date.now()}`,pageNum:b+1,blob:null,url:null,status:"pending",remoteUrl:"",text:""}));E(i),await Pe(s,h,O,i),window.matchMedia("(max-width: 768px)").matches&&i[0]?.canvas?.width&&(ze.current=!1,Y(i[0].canvas.width,h),ze.current=!0),U(90);try{const p=await s.getOutline();if(p?.length){const b=await Promise.all(p.slice(0,50).map(async y=>{let R=null;try{if(y.dest){const z=Array.isArray(y.dest)?y.dest[0]:(await s.getDestination(y.dest))[0];R=await s.getPageIndex(z)+1}}catch{}return{title:y.title,page:R}}));Ie(b)}}catch{}try{const b=(await s.getMetadata()).info||{};Be([["Name",a||"—"],["Title",b.Title||"—"],["Author",b.Author||"—"],["Pages",s.numPages],["Size",o?ct(o):"—"],["Creator",b.Creator||"—"],["Producer",b.Producer||"—"],["PDF Version",b.PDFFormatVersion||"—"]])}catch{}U(100),l(`Opened: ${a}`,"ok",2500)}catch(s){l("Cannot open PDF: "+s.message,"err",5e3)}$(!1),U(0)},[h,O,l]),Pe=r.useCallback(async(e,a,o,s)=>{const i=[],p=[];for(let b=1;b<=e.numPages;b++){const y=await e.getPage(b),R=y.getViewport({scale:a,rotation:o}),z=document.createElement("canvas");z.width=R.width,z.height=R.height,await y.render({canvasContext:z.getContext("2d"),viewport:R}).promise;const Ft=z.toDataURL("image/jpeg",.9);i.push({num:b,canvas:z,dataUrl:Ft});const Ee=y.getViewport({scale:.22,rotation:o}),xe=document.createElement("canvas");xe.width=Ee.width,xe.height=Ee.height,await y.render({canvasContext:xe.getContext("2d"),viewport:Ee}).promise,p.push({num:b,canvas:xe});const Fe=await new Promise(Lt=>z.toBlob(Lt,"image/jpeg",.92)),Tt=Fe?URL.createObjectURL(Fe):"";s&&(s[b-1]={...s[b-1],blob:Fe,url:Tt}),(b%3===0||b===e.numPages)&&(De([...i]),$e([...p]),s&&E([...s]))}},[]),Ct=r.useCallback(async()=>{if(!n)return;$(!0);const e=m.map(a=>({...a}));await Pe(n,h,O,e),$(!1)},[n,h,O,m,Pe]);r.useEffect(()=>{n&&Ct()},[h,O,J]);const at=r.useCallback(async e=>{if(e)if(e.type==="application/pdf"||e.name.endsWith(".pdf")){const a=await e.arrayBuffer();await B(a,e.name,e.size)}else l("Please open a PDF file","err")},[B,l]),w=r.useCallback(e=>{e=Math.max(1,Math.min(u,e)),q(e),V(String(e)),requestAnimationFrame(()=>{const a=I.current?.querySelector(`[data-page="${e}"]`);a?a.scrollIntoView({behavior:"smooth",block:"start",inline:"nearest"}):I.current?.scrollTo({top:0,behavior:"smooth"})})},[u]),rt=r.useCallback(()=>{const e=parseInt(be,10);Number.isFinite(e)?w(e):V(String(g))},[g,w,be]);r.useCallback(()=>{n&&l("Download: re-open from your original source","")},[n]);const zt=r.useCallback(async()=>{if(!C.length)return;const e=window.open("","_blank");if(!e){l("Popup blocked — allow popups to print","err",4500);return}e.document.write(`<html><head><title>${D}</title><style>
      body{margin:0;padding:0;background:#fff;}
      img{display:block;width:100%;page-break-after:always;margin-bottom:0}
      @media print{img{page-break-after:always}}
    </style></head><body>`),C.forEach(a=>e.document.write(`<img src="${a.dataUrl}" />`)),e.document.write(`<script>
      window.addEventListener('load', () => {
        const images = Array.from(document.images);
        Promise.all(images.map(img => img.complete ? Promise.resolve() : new Promise(resolve => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }))).then(() => {
          window.focus();
          window.print();
        });
      });
    <\/script></body></html>`),e.document.close(),l("Print dialog opened","ok")},[C,D]),K=r.useCallback(async(e,a=0)=>{const o=m[e];if(!(!o||o.status==="ready"||o.status==="done")){E(s=>{const i=[...s];return i[e]={...i[e],status:"uploading"},i});try{const s=await dt(o.blob,a);E(i=>{const p=[...i];return p[e]={...p[e],status:"ready",remoteUrl:s},p}),l(`Page ${e+1} uploaded`,"ok",2e3)}catch(s){E(i=>{const p=[...i];return p[e]={...p[e],status:"error"},p}),l(`Page ${e+1}: ${s.message}`,"err",4e3)}}},[m,l]),Re=r.useCallback(async()=>{if(!n)return;if(!m.filter(a=>a.status==="pending"||a.status==="error").length){l("All pages already uploaded","ok");return}for(let a=0;a<m.length;a++){const o=m[a];o.status!=="pending"&&o.status!=="error"||(qe({show:!0,pct:Math.round(a/m.length*100),label:`Uploading page ${a+1} / ${m.length}…`}),await K(a))}qe({show:!1,pct:0,label:""}),l("All pages uploaded! Open Google Lens for each.","ok",4e3)},[n,m,K,l]),Pt=r.useCallback(e=>{const a=m[e];if(!a?.remoteUrl){l("Upload this page first","err");return}const o=`https://lens.google.com/uploadbyurl?url=${encodeURIComponent(a.remoteUrl)}`;window.open(o,`lens_pg${e}`,"width=1200,height=860,scrollbars=yes,toolbar=yes")?l(`Page ${e+1} opened in Google Lens`,"ok",2500):l("Popup blocked — please allow popups","err",5e3)},[m,l]),Rt=r.useCallback(async()=>{if(!n){window.open(ue,"_blank");return}const e=g-1,a=m[e];a&&a.status==="pending"&&(l("Uploading current page to Textriva…","",3e3),await K(e));const o=m[e];if(o?.remoteUrl){const s=`${ue}?img=${encodeURIComponent(o.remoteUrl)}`;window.open(s,"_blank"),l("Opened in Textriva ↗","ok")}else window.open(ue,"_blank")},[n,m,g,K,l]);r.useCallback(async()=>{n&&(l("Uploading all pages, then opening Textriva…","",5e3),await Re(),window.open(ue,"_blank"),l("Textriva opened — your pages are ready in OCR panel","ok"))},[n,Re,l]);const Mt=r.useCallback((e,a)=>{E(o=>{const s=[...o];return s[e]={...s[e],text:a.trim(),status:a.trim()?"done":s[e].status},s}),j&&j(e+1,a.trim())},[j]),ot=r.useCallback((e,a)=>{E(o=>{const s=[...o];return s[e]={...s[e],text:a},s})},[]),Me=r.useCallback(async e=>{try{return await navigator.clipboard.writeText(e),!0}catch{return!1}},[]),P=r.useMemo(()=>{const e=m.filter(a=>a.text);return e.length?e.map(a=>`--- Page ${a.pageNum} ---
${a.text}`).join(`

`):""},[m]),st=r.useCallback(()=>{if(!P){l("No extracted text yet","err");return}const e=document.createElement("a");e.href=URL.createObjectURL(new Blob([P],{type:"text/plain"})),e.download=`${D.replace(".pdf","")}_ocr_${Date.now()}.txt`,e.click(),l("Exported as .txt","ok")},[P,D]),nt=r.useCallback(async()=>{const e=ye.trim();if(e){X(!1),Ke("");try{$(!0);const a=await fetch(e);if(!a.ok)throw new Error("HTTP "+a.status);const o=await a.blob(),s=await o.arrayBuffer(),i=e.split("/").pop().split("?")[0]||"document.pdf";await B(s,i,o.size)}catch(a){$(!1),l("Failed to load URL: "+a.message,"err",5e3)}}},[ye,B,l]),T=m.filter(e=>e.status==="done").length,St=m.filter(e=>e.status==="ready").length,Se=T+St,Et=J?Array.from({length:Math.ceil(u/2)},(e,a)=>[a*2+1,a*2+2].filter(o=>o<=u)):Array.from({length:u},(e,a)=>[a+1]);return t.jsxs("div",{className:"pv-root",children:[t.jsxs("div",{className:`topbar ${S?"mobile-fixed":""}`,children:[t.jsxs("div",{className:"tb-cluster tb-cluster-nav",children:[!S&&f&&t.jsx("button",{className:"tb-btn",onClick:f,title:"Close viewer",children:t.jsx(c,{d:d.x})}),t.jsx("button",{className:"tb-btn",onClick:()=>Ve(e=>!e),title:"Toggle sidebar [S]",children:t.jsx(c,{d:d.sidebar})}),t.jsx("button",{className:"tb-btn",onClick:()=>w(g-1),disabled:!n||g<=1,title:"Previous page [←]",children:t.jsx(c,{d:d.prev})}),t.jsxs("div",{className:"tb-page-nav",children:[t.jsx("input",{className:"tb-page-input",type:"number",min:1,max:u||1,ref:jt,value:be,disabled:!n,onChange:e=>V(e.target.value),onKeyDown:e=>{e.key==="Enter"&&rt()},onBlur:rt}),t.jsxs("span",{className:"tb-total",children:["/ ",u||"—"]})]}),t.jsx("button",{className:"tb-btn",onClick:()=>w(g+1),disabled:!n||g>=u,title:"Next page [→]",children:t.jsx(c,{d:d.next})})]}),t.jsxs("div",{className:"tb-cluster tb-cluster-mobile-actions",children:[t.jsx("button",{className:"tb-btn",onClick:()=>Le(e=>(e+90)%360),disabled:!n,title:"Rotate 90°",children:t.jsx(c,{d:d.rotate})}),t.jsx("button",{className:`tb-btn ${J?"on":""}`,onClick:()=>Oe(e=>!e),disabled:!n,title:"Two-page spread",children:t.jsx(c,{d:d.columns})}),t.jsx("button",{className:"tb-btn",onClick:()=>{G(!0),A(g)},disabled:!n,title:"Fullscreen [F]",children:t.jsx(c,{d:d.expand})}),t.jsx("button",{className:`tb-mode-btn ${fe==="ocr"?"on":""}`,onClick:()=>{ee("ocr"),W(!0)},disabled:!n,title:"OCR mode","aria-label":"OCR mode",children:"OCR"})]}),t.jsxs("div",{className:"tb-cluster tb-cluster-zoom",children:[t.jsx("button",{className:"tb-btn",onClick:()=>F(e=>Math.max(.25,+(e-.25).toFixed(2))),disabled:!n,title:"Zoom out [-]",children:t.jsx(c,{d:d.zoomOut})}),t.jsx("select",{className:"tb-zoom",value:Number.isFinite(h)?h:1.25,disabled:!n,onChange:e=>F(parseFloat(e.target.value)),children:[.25,.5,.75,1,1.25,1.5,1.75,2,2.5,3,4].map(e=>t.jsxs("option",{value:e,children:[Math.round(e*100),"%"]},e))}),t.jsx("button",{className:"tb-btn",onClick:()=>F(e=>Math.min(4,+(e+.25).toFixed(2))),disabled:!n,title:"Zoom in [+]",children:t.jsx(c,{d:d.zoomIn})}),t.jsx("button",{className:"tb-btn",onClick:Nt,disabled:!n,title:"Fit to width",children:t.jsx(c,{d:d.fit})})]}),t.jsxs("div",{className:"tb-cluster tb-cluster-tools",children:[t.jsx("button",{className:"tb-btn",onClick:()=>Le(e=>(e+90)%360),disabled:!n,title:"Rotate 90°",children:t.jsx(c,{d:d.rotate})}),t.jsx("button",{className:`tb-btn ${J?"on":""}`,onClick:()=>Oe(e=>!e),disabled:!n,title:"Two-page spread",children:t.jsx(c,{d:d.columns})}),t.jsx("button",{className:`tb-btn ${ae?"on":""}`,onClick:()=>re(e=>!e),disabled:!n,title:"Find in document [Ctrl+F]",children:t.jsx(c,{d:d.search})}),ae&&t.jsxs("div",{className:`search-bar ${gt?"focus":""}`,children:[t.jsx(c,{d:d.search,s:12,style:{color:"var(--text-dim)",flexShrink:0}}),t.jsx("input",{className:"search-input",placeholder:"Search…",value:oe,autoFocus:!0,onFocus:()=>Ye(!0),onBlur:()=>Ye(!1),onChange:e=>_e(e.target.value),onKeyDown:e=>{if(e.key==="Enter"){if(!k.length)return;const a=e.shiftKey?(_-1+k.length)%k.length:(_+1)%k.length;se(a),w(k[a].page)}}}),k.length>0&&t.jsxs(t.Fragment,{children:[t.jsxs("span",{className:"search-count",children:[_+1,"/",k.length]}),t.jsx("button",{className:"tb-btn",style:{width:22,height:22},onClick:()=>{const e=(_-1+k.length)%k.length;se(e),w(k[e].page)},title:"Previous search result","aria-label":"Previous search result",children:t.jsx(c,{d:d.prev,s:11})}),t.jsx("button",{className:"tb-btn",style:{width:22,height:22},onClick:()=>{const e=(_+1)%k.length;se(e),w(k[e].page)},title:"Next search result","aria-label":"Next search result",children:t.jsx(c,{d:d.next,s:11})})]}),t.jsx("button",{className:"tb-btn",style:{width:22,height:22},onClick:()=>{re(!1),_e("")},title:"Close search","aria-label":"Close search",children:t.jsx(c,{d:d.x,s:11})})]}),t.jsx("button",{className:"tb-btn",onClick:zt,disabled:!n,title:"Print",children:t.jsx(c,{d:d.print})}),t.jsx("button",{className:"tb-btn",onClick:()=>{G(!0),A(g)},disabled:!n,title:"Fullscreen [F]",children:t.jsx(c,{d:d.expand})})]}),t.jsxs("div",{className:"tb-cluster tb-cluster-meta",children:[D&&t.jsx("span",{className:"tb-filename",children:D}),t.jsxs("div",{className:"tb-mode",children:[t.jsx("button",{className:`tb-mode-btn ${fe==="viewer"?"on":""}`,onClick:()=>{ee("viewer"),W(!1)},title:"Reader mode","aria-label":"Reader mode",children:"Reader"}),t.jsxs("button",{className:`tb-mode-btn ${fe==="ocr"?"on":""}`,onClick:()=>{ee("ocr"),W(!0)},title:"OCR mode","aria-label":"OCR mode",children:["OCR ",T>0?`(${T} done)`:""]})]})]})]}),t.jsxs("div",{className:"pv-body",children:[t.jsxs("div",{className:`sidebar ${ft?"open":"closed"}`,children:[t.jsx("div",{className:"s-tabs",children:[["thumbs","Pages"],["toc","Outline"],["info","Info"]].map(([e,a])=>t.jsx("div",{className:`s-tab ${Q===e?"on":""}`,onClick:()=>He(e),children:a},e))}),t.jsxs("div",{className:"s-body",children:[!n&&t.jsx("div",{className:"empty-state",children:"Open a PDF to begin"}),n&&Q==="thumbs"&&bt.map(e=>{const a=m[e.num-1];return t.jsxs("div",{className:`thumb-item ${g===e.num?"on":""}`,onClick:()=>w(e.num),children:[t.jsxs("div",{className:"thumb-wrap",children:[t.jsx("canvas",{ref:o=>{o&&e.canvas&&e.canvas.width>0&&e.canvas.height>0&&(o.width=e.canvas.width,o.height=e.canvas.height,o.getContext("2d").drawImage(e.canvas,0,0))}}),a&&a.status!=="pending"&&t.jsx("div",{className:`thumb-ocr-dot ${a.status}`})]}),t.jsx("div",{className:"thumb-page-num",children:e.num})]},e.num)}),n&&Q==="toc"&&(Ue.length>0?Ue.map((e,a)=>t.jsxs("div",{className:"toc-item",onClick:()=>e.page&&w(e.page),children:[t.jsx("span",{className:"toc-title",children:e.title}),e.page&&t.jsx("span",{className:"toc-pg",children:e.page})]},a)):t.jsx("div",{className:"empty-state",children:"No outline in this document"})),n&&Q==="info"&&t.jsx("table",{className:"info-tbl",children:t.jsx("tbody",{children:mt.map(([e,a])=>t.jsxs("tr",{children:[t.jsx("td",{children:e}),t.jsx("td",{children:a})]},e))})})]})]}),t.jsxs("div",{className:`viewer ${S?"mobile":""}`,ref:I,tabIndex:0,onTouchStart:e=>{if(S&&e.touches.length===2){const a=e.touches[0].clientX-e.touches[1].clientX,o=e.touches[0].clientY-e.touches[1].clientY;pe.current=Math.hypot(a,o)||1,tt.current=h}},onTouchMove:e=>{if(!S||e.touches.length!==2||!pe.current)return;const a=e.touches[0].clientX-e.touches[1].clientX,o=e.touches[0].clientY-e.touches[1].clientY,s=Math.hypot(a,o)||1;e.preventDefault(),F(Math.max(.25,Math.min(4,+(tt.current*(s/pe.current)).toFixed(2))))},onTouchEnd:e=>{S&&e.touches.length<2&&(pe.current=0)},onDragOver:e=>{e.preventDefault(),ve(!0)},onDragLeave:()=>ve(!1),onDrop:e=>{e.preventDefault(),ve(!1),at(e.dataTransfer.files[0])},children:[me&&H>0&&H<100&&t.jsx("div",{className:"load-bar",style:{width:`${H}%`}}),me&&t.jsxs("div",{className:"spinner-wrap",children:[t.jsx("div",{className:"spinner"}),t.jsx("span",{className:"spinner-label",children:H>0?`Loading… ${H}%`:"Rendering…"})]}),!n&&!me&&t.jsx("div",{className:"drop-zone",children:t.jsxs("div",{className:`drop-inner ${vt?"drag":""}`,onClick:()=>je.current?.click(),children:[t.jsx("div",{className:"drop-emoji",children:t.jsx(Ot,{size:28,color:"var(--muted)"})}),t.jsx("div",{className:"drop-title",children:"Open a PDF"}),t.jsxs("div",{className:"drop-sub",children:["Drag & drop your PDF here",t.jsx("br",{}),"or click to browse files"]}),t.jsx("button",{className:"drop-btn",onClick:e=>{e.stopPropagation(),je.current?.click()},children:"Choose PDF"}),t.jsx("div",{className:"drop-formats",children:"Supports PDF files"}),t.jsx("div",{className:"drop-features",children:["Full text search","Page thumbnails","Two-page spread","Fullscreen","Google Lens OCR"].map(e=>t.jsx("span",{className:"drop-feat-tag",children:e},e))})]})}),C.length>0&&Et.map((e,a)=>t.jsx("div",{style:{display:"flex",gap:12,position:"relative",flexShrink:0,marginBottom:12},children:e.map(o=>{const s=C.find(p=>p.num===o),i=m[o-1];return s?t.jsxs("div",{className:"page-wrap","data-page":o,children:[t.jsx("canvas",{ref:p=>{p&&s.canvas&&s.canvas.width>0&&s.canvas.height>0&&(p.width=s.canvas.width,p.height=s.canvas.height,p.getContext("2d").drawImage(s.canvas,0,0))}}),i&&["ready","done","uploading"].includes(i.status)&&t.jsx("div",{className:`page-ocr-badge ${i.status}`,children:i.status==="done"?"OCR done":i.status==="ready"?"Uploaded":"Uploading…"}),t.jsx("div",{className:"page-lbl",children:e.length>1?`${e[0]}–${e[e.length-1]}`:`Page ${e[0]}`})]},o):null})},a))]}),t.jsxs("div",{className:`ocr-panel ${ht?"open":"closed"}`,children:[t.jsxs("div",{className:"ocr-header",children:[t.jsxs("div",{className:"ocr-header-top",children:[t.jsxs("div",{className:"ocr-title",children:[t.jsxs("span",{className:"g-logo",children:[t.jsx("span",{className:"g-b",children:"G"}),t.jsx("span",{className:"g-r",children:"o"}),t.jsx("span",{className:"g-y",children:"o"}),t.jsx("span",{className:"g-b",children:"g"}),t.jsx("span",{className:"g-g",children:"l"}),t.jsx("span",{className:"g-r",children:"e"})]})," Lens OCR"]}),t.jsx("button",{className:"tb-btn",style:{width:26,height:26,flexShrink:0},onClick:()=>{W(!1),ee("viewer")},title:"Close OCR panel",children:t.jsx(c,{d:d.x,s:12})})]}),t.jsxs("div",{className:"ocr-header-actions",children:[t.jsxs("button",{className:"ocr-action-btn primary",onClick:Re,disabled:!n,children:[t.jsx(c,{d:d.upload,s:11})," Upload All"]}),t.jsxs("button",{className:"ocr-action-btn green",onClick:st,disabled:!P,children:[t.jsx(c,{d:d.download,s:11})," Export"]}),P&&t.jsxs("button",{className:"ocr-action-btn",onClick:async()=>{await Me(P)?l("All text copied!","ok"):l("Copy failed","err")},children:[t.jsx(c,{d:d.copy,s:11})," Copy All"]})]})]}),ie.show&&t.jsxs("div",{className:"ocr-progress",children:[t.jsx("span",{className:"ocr-progress-label",children:ie.label}),t.jsx("div",{className:"ocr-progress-bar-wrap",children:t.jsx("div",{className:"ocr-progress-bar",style:{width:`${ie.pct}%`}})}),t.jsxs("span",{className:"ocr-progress-pct",children:[ie.pct,"%"]})]}),t.jsxs("div",{className:"textriva-btn",onClick:Rt,children:[t.jsx("div",{className:"textriva-btn-icon",children:t.jsx(At,{size:20,color:"var(--accent)"})}),t.jsxs("div",{className:"textriva-btn-content",children:[t.jsx("div",{className:"textriva-btn-title",children:"Open in Textriva"}),t.jsx("div",{className:"textriva-btn-sub",children:"Advanced OCR workspace — auto-uploads current page"})]}),t.jsx("div",{className:"textriva-btn-arrow",children:"↗"})]}),t.jsxs("div",{className:"ocr-body",children:[!n&&t.jsxs(t.Fragment,{children:[t.jsxs("div",{className:"ocr-empty",children:[t.jsx("div",{className:"ocr-empty-icon",children:t.jsx(it,{size:28,color:"var(--muted)"})}),"Open a PDF to start OCR workflow"]}),t.jsxs("div",{className:"ocr-workflow-steps",children:[t.jsx("div",{className:"ocr-workflow-title",children:"How it works"}),[["1","Open a PDF file above"],["2","Click Upload All to send pages to cloud"],["3","Click Open in Google Lens for each page"],["4","Copy text from Lens and paste here"],["5","Save each page, then Export all text"]].map(([e,a])=>t.jsxs("div",{className:"ocr-wf-step",children:[t.jsx("div",{className:"ocr-wf-num",children:e}),t.jsx("div",{className:"ocr-wf-text",children:a})]},e))]})]}),m.map((e,a)=>t.jsxs("div",{className:`ocr-card ${g===e.pageNum?"current":""} ${e.status==="done"?"done":""}`,children:[t.jsxs("div",{className:"ocr-card-head",children:[t.jsxs("span",{className:"ocr-card-page",children:["PG ",e.pageNum]}),t.jsx("div",{className:`ocr-card-status-dot ${e.status}`}),t.jsx("span",{className:`ocr-card-status-txt ${e.status}`,children:e.status==="pending"?"Pending":e.status==="uploading"?"Uploading…":e.status==="ready"?"Uploaded":e.status==="done"?"Done":"Error"}),t.jsx("span",{className:"ocr-card-go",onClick:()=>w(e.pageNum),children:"→ Go"})]}),t.jsx("button",{className:`lens-btn ${e.status==="done"?"done":e.status==="ready"?"active":""}`,disabled:e.status!=="ready"&&e.status!=="done",onClick:()=>Pt(a),children:e.status==="done"?"Done — Open Lens Again":"Open in Google Lens"}),t.jsxs("div",{children:[t.jsxs("div",{className:"ocr-text-label",children:[t.jsx("span",{children:"Extracted Text"}),t.jsxs("span",{className:"ocr-text-chars",children:[e.text.length," chars"]})]}),t.jsx("textarea",{className:"ocr-textarea",value:e.text,onChange:o=>ot(a,o.target.value),placeholder:e.status==="ready"||e.status==="done"?"Paste from Google Lens (Ctrl+V)…":"Upload first, then open in Google Lens…"})]}),t.jsxs("div",{className:"ocr-card-actions",children:[(e.status==="pending"||e.status==="error")&&t.jsxs("button",{className:"sm-btn",onClick:()=>K(a),children:[t.jsx(c,{d:d.upload,s:10})," Upload"]}),t.jsxs("button",{className:"sm-btn",onClick:async()=>{try{const o=await navigator.clipboard.readText();ot(a,o),l("Pasted!","ok",1500)}catch{l("Use Ctrl+V to paste manually","")}},children:[t.jsx(c,{d:d.paste,s:10})," Paste"]}),t.jsxs("button",{className:"sm-btn save",onClick:()=>{Mt(a,e.text),l(`Page ${e.pageNum} saved`,"ok",2e3)},children:[t.jsx(c,{d:d.check,s:10})," Save"]}),e.text&&t.jsxs("button",{className:"sm-btn",onClick:async()=>{await Me(e.text)?l(`Page ${e.pageNum} copied`,"ok"):l("Copy failed","err")},children:[t.jsx(c,{d:d.copy,s:10})," Copy"]})]})]},e.id)),P&&t.jsxs("div",{className:"ocr-results",children:[t.jsxs("div",{className:"ocr-results-head",children:[t.jsxs("span",{className:"ocr-results-title",children:[t.jsx(c,{d:d.check,s:12})," All Extracted Text"]}),t.jsxs("span",{className:"ocr-results-meta",children:[T," page",T!==1?"s":""]})]}),t.jsxs("div",{className:"ocr-results-body",children:[t.jsx("textarea",{className:"ocr-all-textarea",readOnly:!0,value:P}),t.jsxs("div",{className:"ocr-results-btns",children:[t.jsxs("button",{className:"sm-btn",onClick:async()=>{await Me(P)?l("Copied all!","ok"):l("Copy failed","err")},children:[t.jsx(c,{d:d.copy,s:10})," Copy"]}),t.jsxs("button",{className:"sm-btn save",onClick:st,children:[t.jsx(c,{d:d.download,s:10})," Export .txt"]})]})]})]}),m.length>0&&t.jsx("div",{className:"ocr-tip",children:"Tip: Upload All → Open each in Lens → Copy text → Paste → Save"})]})]})]}),t.jsxs("div",{className:"statusbar",children:[t.jsxs("div",{className:"status-item",children:[t.jsx("div",{className:`status-dot ${n?"green":"dim"}`}),t.jsx("span",{children:u>0?`${u} pages`:"No document"})]}),u>0&&t.jsxs(t.Fragment,{children:[t.jsx("div",{className:"status-item",children:t.jsxs("span",{children:["Page ",g,"/",u]})}),t.jsx("div",{className:"status-item",children:t.jsxs("span",{children:[Math.round(h*100),"% · ",O>0?O+"°":"0°"]})}),Ae>0&&t.jsx("div",{className:"status-item",children:t.jsx("span",{children:ct(Ae)})})]}),T>0&&t.jsxs("div",{className:"status-item",children:[t.jsx("div",{className:"status-dot green"}),t.jsxs("span",{children:["OCR: ",T,"/",u," done"]})]}),Se>0&&T<Se&&t.jsxs("div",{className:"status-item",children:[t.jsx("div",{className:"status-dot",style:{background:"var(--accent)"}}),t.jsxs("span",{children:[Se," uploaded"]})]}),k.length>0&&t.jsx("div",{className:"status-item",children:t.jsxs("span",{style:{display:"inline-flex",alignItems:"center",gap:4},children:[t.jsx(it,{size:12}),k.length," results"]})}),t.jsxs("div",{className:"status-item",style:{marginLeft:"auto"},children:[t.jsx("div",{className:"status-dot green"}),t.jsx("span",{children:"Local · Private"})]})]}),M&&t.jsxs("div",{className:"fs-overlay",children:[t.jsxs("div",{className:`fs-bar ${te?"":"hide"}`,children:[t.jsx("button",{className:"tb-btn",onClick:()=>A(e=>Math.max(1,e-1)),style:{color:"#fff"},title:"Previous page","aria-label":"Previous page",children:t.jsx(c,{d:d.prev})}),t.jsxs("div",{className:"tb-page-nav",children:[t.jsx("input",{className:"tb-page-input",type:"number",style:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"#fff"},value:Z,min:1,max:u,onChange:e=>A(Math.max(1,Math.min(u,parseInt(e.target.value)||1)))}),t.jsxs("span",{className:"tb-total",style:{color:"rgba(255,255,255,0.4)"},children:["/ ",u]})]}),t.jsx("button",{className:"tb-btn",onClick:()=>A(e=>Math.min(u,e+1)),style:{color:"#fff"},title:"Next page","aria-label":"Next page",children:t.jsx(c,{d:d.next})}),t.jsx("div",{className:"tb-sep",style:{background:"rgba(255,255,255,0.1)"}}),t.jsx("button",{className:"tb-btn",onClick:()=>We(e=>Math.max(.5,+(e-.25).toFixed(2))),style:{color:"#fff"},title:"Zoom out","aria-label":"Zoom out",children:t.jsx(c,{d:d.zoomOut})}),t.jsxs("span",{style:{color:"rgba(255,255,255,0.6)",fontSize:11,fontFamily:"var(--font-mono)",minWidth:42,textAlign:"center"},children:[Math.round(he*100),"%"]}),t.jsx("button",{className:"tb-btn",onClick:()=>We(e=>Math.min(4,+(e+.25).toFixed(2))),style:{color:"#fff"},title:"Zoom in","aria-label":"Zoom in",children:t.jsx(c,{d:d.zoomIn})}),t.jsx("div",{style:{flex:1}}),t.jsx("button",{className:"tb-btn",onClick:()=>G(!1),style:{color:"#fff"},title:"Exit fullscreen [Esc/F]",children:t.jsx(c,{d:d.compress})})]}),t.jsx("div",{className:"fs-viewer",onClick:()=>ge(e=>!e),children:Ge?t.jsx("img",{src:Ge,alt:`Page ${Z}`,style:{borderRadius:2,boxShadow:"0 8px 60px rgba(0,0,0,0.95)",maxWidth:"100%"}}):t.jsx("div",{style:{color:"#444",fontSize:14},children:"Loading…"})}),t.jsxs("div",{className:`fs-page-indicator ${te?"":"hide"}`,style:{opacity:te?1:0},children:[Z," / ",u]}),t.jsx("div",{className:"fs-close-hint",style:{opacity:te?1:0},children:"Esc or F to exit · ← → navigate · click to toggle toolbar"})]}),we&&t.jsx("div",{className:"modal-overlay",onClick:e=>{e.target===e.currentTarget&&X(!1)},children:t.jsxs("div",{className:"modal",children:[t.jsx("div",{className:"modal-title",children:"Open PDF from URL"}),t.jsx("input",{className:"modal-input",type:"url",placeholder:"https://example.com/document.pdf",value:ye,autoFocus:!0,onChange:e=>Ke(e.target.value),onKeyDown:e=>{e.key==="Enter"&&nt(),e.key==="Escape"&&X(!1)}}),t.jsxs("div",{className:"modal-actions",children:[t.jsx("button",{className:"modal-btn cancel",onClick:()=>X(!1),children:"Cancel"}),t.jsx("button",{className:"modal-btn confirm",onClick:nt,children:"Open"})]})]})}),t.jsx("input",{type:"file",ref:je,accept:".pdf,application/pdf",style:{display:"none"},onChange:e=>{const a=e.target.files[0];a&&at(a),e.target.value=""}}),t.jsx("div",{className:"toasts",children:N.map(e=>t.jsx("div",{className:`toast ${e.type}`,children:e.msg},e.id))})]})}export{Zt as P};
