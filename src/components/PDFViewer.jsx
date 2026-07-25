import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FileText, Search, Microscope } from "lucide-react";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const IMGBB_KEYS = [
  "67cd74715bea46c247e48155e2c6d8e6",
  "4ef55f2fecee8424ce5a46bc1ee6ceac",
];
const PDFJS_CDN = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const TEXTRIVA_URL = "https://textriva.vercel.app/";

// ─── CSS ─────────────────────────────────────────────────────────────────────
const STYLES = `
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
`;

// ─── SVG ICONS ────────────────────────────────────────────────────────────────
const Ic = ({ d, s = 15, ...p }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...p}>
    {Array.isArray(d) ? d.map((dd, i) => <path key={i} d={dd} />) : <path d={d} />}
  </svg>
);
const IC = {
  sidebar: "M3 3h18v18H3zM9 3v18",
  open: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
  url: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
  prev: "M15 18l-6-6 6-6",
  next: "M9 18l6-6-6-6",
  first: ["M11 17l-5-5 5-5", "M18 17l-5-5 5-5"],
  last: ["M13 17l5-5-5-5", "M6 17l5-5-5-5"],
  zoomIn: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM11 8v6M8 11h6",
  zoomOut: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0zM8 11h6",
  rotate: "M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15",
  search: "M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0",
  expand: "M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3",
  compress: "M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3",
  download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  print: "M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z",
  copy: "M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1",
  ocr: "M15 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 12h6M9 16h4",
  columns: "M3 3h8v18H3zM13 3h8v18h-8",
  x: "M18 6L6 18M6 6l12 12",
  upload: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  pages: "M9 17H7a2 2 0 0 0-2 2v.5M9 7H7a2 2 0 0 0-2 2v.5M15 7h2a2 2 0 0 1 2 2v.5M15 17h2a2 2 0 0 1 2 2v.5M4 11.5v1M20 11.5v1",
  list: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
  info: "M12 16v-4M12 8h.01M22 12A10 10 0 1 1 2 12a10 10 0 0 1 20 0",
  fit: "M21 9H3M21 15H3M9 3v18M15 3v18",
  dark: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z",
  externalLink: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3",
  paste: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2",
  check: "M20 6L9 17l-5-5",
};

// ─── UTILS ───────────────────────────────────────────────────────────────────
function blobToBase64(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = rej; r.readAsDataURL(blob);
  });
}

async function compressBlob(blob, maxKB = 3800) {
  if (blob.size / 1024 <= maxKB) return blob;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = blob.size > 8e6 ? 0.55 : blob.size > 5e6 ? 0.7 : 0.85;
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      c.toBlob(b => resolve(b || blob), "image/jpeg", 0.88);
    };
    img.onerror = () => resolve(blob); img.src = url;
  });
}

async function uploadToImgbb(blob, keyIndex = 0) {
  const compressed = await compressBlob(blob);
  const b64 = await blobToBase64(compressed);
  const params = new URLSearchParams();
  params.append("key", IMGBB_KEYS[keyIndex % IMGBB_KEYS.length]);
  params.append("image", b64);
  params.append("expiration", "600"); // 10 min expiry
  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const data = await res.json();
  if (data.success) return data.data.url;
  // Retry with other key
  if (keyIndex === 0) return uploadToImgbb(blob, 1);
  throw new Error(data.error?.message || "Upload failed");
}

function formatBytes(n) {
  if (n < 1024) return n + " B";
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
  return (n / 1024 / 1024).toFixed(2) + " MB";
}

// ─── TOAST HOOK ──────────────────────────────────────────────────────────────
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((msg, type = "", dur = 3200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), dur);
  }, []);
  return { toasts, add };
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function PDFViewer({ initialUrl, initialName, onTextExtracted, onClose }) {
  const { toasts, add: toast } = useToasts();

  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoom, setZoom] = useState(1.25);
  const [rotation, setRotation] = useState(0);
  const [twoPage, setTwoPage] = useState(false);
  const [docName, setDocName] = useState("");
  const [docSize, setDocSize] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadPct, setLoadPct] = useState(0);
  const [renderedPages, setRenderedPages] = useState([]);
  const [thumbs, setThumbs] = useState([]);
  const [toc, setToc] = useState([]);
  const [docInfo, setDocInfo] = useState([]);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState("thumbs");
  const [ocrOpen, setOcrOpen] = useState(false);
  const [mode, setMode] = useState("viewer");
  const [fullscreen, setFullscreen] = useState(false);
  const [fsPage, setFsPage] = useState(1);
  const [fsZoom, setFsZoom] = useState(1.5);
  const [fsCanvas, setFsCanvas] = useState(null);
  const [fsBarVisible, setFsBarVisible] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchIdx, setSearchIdx] = useState(0);
  const [searchFocus, setSearchFocus] = useState(false);
  const [drag, setDrag] = useState(false);
  const [urlModal, setUrlModal] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [fitMode, setFitMode] = useState("page"); // "page" | "width" | "auto"
  const [isMobileView, setIsMobileView] = useState(false);

  // OCR state
  const [ocrPages, setOcrPages] = useState([]);
  const [uploadProg, setUploadProg] = useState({ show: false, pct: 0, label: "" });

  const viewerRef = useRef(null);
  const fileInputRef = useRef(null);
  const pdfjsRef = useRef(null);
  const fsTimerRef = useRef(null);
  const viewerWidthRef = useRef(0);
  const [viewerWidth, setViewerWidth] = useState(0);
  const pageInputRef = useRef(null);
  const lastManualZoomRef = useRef(1.25);
  const fitWidthActiveRef = useRef(false);
  const lastAutoFitWidthRef = useRef(0);
  const mobileWidthFitAppliedRef = useRef(false);
  const manualZoomUsedRef = useRef(false);
  const wasMobileRef = useRef(false);
  const mobileAutoFitDoneRef = useRef(false);
  const pinchStartDistRef = useRef(0);
  const pinchStartZoomRef = useRef(1.25);
  const lastScrollTopRef = useRef(0);

  useEffect(() => {
    const syncMobileLayout = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileView(mobile);
      if (mobile) {
        setFitMode("width");
        setSidebarTab("thumbs");
        if (!wasMobileRef.current) {
          setSidebarOpen(false);
          setOcrOpen(false);
          mobileAutoFitDoneRef.current = false;
          mobileWidthFitAppliedRef.current = false;
        }
      } else {
        setFitMode("page");
      }
      wasMobileRef.current = mobile;
    };
    syncMobileLayout();
    window.addEventListener("resize", syncMobileLayout);
    return () => window.removeEventListener("resize", syncMobileLayout);
  }, []);

  // ── Load PDF.js ──
  useEffect(() => {
    const inject = () => {
      if (window.pdfjsLib) {
        pdfjsRef.current = window.pdfjsLib;
        if (initialUrl) loadPDF(initialUrl, initialName || "document.pdf");
        return;
      }
      const s = document.createElement("script");
      s.src = PDFJS_CDN;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        pdfjsRef.current = window.pdfjsLib;
        if (initialUrl) loadPDF(initialUrl, initialName || "document.pdf");
      };
      document.head.appendChild(s);
    };
    inject();
  }, []);

  // ── Inject CSS ──
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = STYLES; document.head.appendChild(el);
    return () => el.remove();
  }, []);

  const applyZoom = useCallback((nextZoom) => {
    const baseZoom = Number.isFinite(zoom) ? zoom : 1.25;
    const resolved = typeof nextZoom === "function" ? nextZoom(baseZoom) : nextZoom;
    const numericZoom = Number.isFinite(resolved) ? resolved : 1.25;
    const clamped = Math.max(0.25, Math.min(4, +numericZoom.toFixed(2)));
    lastManualZoomRef.current = clamped;
    fitWidthActiveRef.current = false;
    manualZoomUsedRef.current = true;
    setFitMode("page");
    setZoom(clamped);
  }, [zoom]);

  const fitToWidthFromCanvas = useCallback((currentCanvasWidth, currentZoom = zoom) => {
    const baseZoom = Number.isFinite(currentZoom) ? currentZoom : 1.25;
    const available = viewerWidthRef.current - 60;
    if (!(currentCanvasWidth > 0) || available <= 0) return false;
    const baseWidth = currentCanvasWidth / baseZoom;
    if (!(baseWidth > 0)) return false;
    const newZoom = Math.min(4, +(available / baseWidth).toFixed(2));
    lastManualZoomRef.current = baseZoom;
    fitWidthActiveRef.current = true;
    manualZoomUsedRef.current = false;
    mobileWidthFitAppliedRef.current = true;
    setFitMode("width");
    lastAutoFitWidthRef.current = available;
    setZoom(newZoom);
    return true;
  }, [zoom]);

  const fitToWidth = useCallback(() => {
    if (!renderedPages[0]) return;
    fitToWidthFromCanvas(renderedPages[0].canvas.width, zoom);
  }, [renderedPages, zoom, fitToWidthFromCanvas]);

  useEffect(() => {
    if (!isMobileView || manualZoomUsedRef.current || mobileWidthFitAppliedRef.current || !renderedPages[0] || !viewerWidth) return;
    fitToWidthFromCanvas(renderedPages[0].canvas.width, zoom);
  }, [isMobileView, renderedPages.length, fitToWidthFromCanvas, viewerWidth, zoom]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA";
      if (e.key === "Escape") {
        if (fullscreen) setFullscreen(false);
        if (searchVisible) setSearchVisible(false);
        if (urlModal) setUrlModal(false);
      }
      if (!inInput && pdfDoc) {
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToPage(currentPage - 1);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") goToPage(currentPage + 1);
        if (e.key === "Home") goToPage(1);
        if (e.key === "End") goToPage(totalPages);
        if (e.key === "+" || e.key === "=") applyZoom(z => Math.min(4, +(z + 0.25).toFixed(2)));
        if (e.key === "-") applyZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)));
        if (e.key === "0") applyZoom(1);
        if (e.key === "f" || e.key === "F") setFullscreen(v => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !inInput) {
        e.preventDefault(); setSearchVisible(v => !v);
      }
      if (fullscreen) {
        if (e.key === "ArrowLeft") setFsPage(p => Math.max(1, p - 1));
        if (e.key === "ArrowRight") setFsPage(p => Math.min(totalPages, p + 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [fullscreen, searchVisible, urlModal, pdfDoc, currentPage, totalPages, applyZoom]);

  // ── Measure viewer width for fit ──
  useEffect(() => {
    if (!viewerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const width = Math.round(entries[0].contentRect.width);
      viewerWidthRef.current = width;
      setViewerWidth(width);
    });
    ro.observe(viewerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Fullscreen toolbar auto-hide ──
  useEffect(() => {
    if (!fullscreen) return;
    const show = () => {
      setFsBarVisible(true);
      clearTimeout(fsTimerRef.current);
      fsTimerRef.current = setTimeout(() => setFsBarVisible(false), 2800);
    };
    window.addEventListener("mousemove", show);
    show();
    return () => { window.removeEventListener("mousemove", show); clearTimeout(fsTimerRef.current); };
  }, [fullscreen]);

  // ── Render FS canvas when fsPage/fsZoom changes ──
  useEffect(() => {
    if (!fullscreen || !pdfDoc) return;
    (async () => {
      try {
        const page = await pdfDoc.getPage(Math.min(fsPage, totalPages));
        const vp = page.getViewport({ scale: fsZoom });
        const c = document.createElement("canvas");
        c.width = vp.width; c.height = vp.height;
        await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
        setFsCanvas(c.toDataURL("image/jpeg", 0.92));
      } catch { setFsCanvas(null); }
    })();
  }, [fullscreen, fsPage, fsZoom, pdfDoc]);

  // ── Search ──
  useEffect(() => {
    if (!searchTerm.trim() || !pdfDoc) { setSearchResults([]); return; }
    let cancelled = false;
    (async () => {
      const results = [];
      for (let p = 1; p <= totalPages; p++) {
        if (cancelled) break;
        try {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          const text = content.items.map(i => i.str).join(" ").toLowerCase();
          const q = searchTerm.toLowerCase();
          let idx = text.indexOf(q), count = 0;
          while (idx !== -1 && count < 20) { results.push({ page: p, idx }); idx = text.indexOf(q, idx + 1); count++; }
        } catch {}
      }
      if (!cancelled) { setSearchResults(results); setSearchIdx(0); if (results.length) goToPage(results[0].page); }
    })();
    return () => { cancelled = true; };
  }, [searchTerm, pdfDoc, totalPages]);

  // ── Scroll sync ──
  useEffect(() => {
    const el = viewerRef.current;
    if (!el) return;
    const handler = () => {
      const mid = el.scrollTop + el.clientHeight / 2;
      let best = null, bestD = Infinity;
      el.querySelectorAll("[data-page]").forEach(w => {
        const d = Math.abs(w.offsetTop + w.offsetHeight / 2 - mid);
        if (d < bestD) { bestD = d; best = w; }
      });
      if (best) { const p = parseInt(best.dataset.page); if (p !== currentPage) setCurrentPage(p); }
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [currentPage]);

  // ── Load PDF ──
  const loadPDF = useCallback(async (src, name, size = 0) => {
    if (!pdfjsRef.current) { toast("PDF.js is loading, try again shortly", "err"); return; }
    setLoading(true); setLoadPct(10);
    setDocName(name || "document.pdf"); setDocSize(size);
    setCurrentPage(1);
    setPageInput("1");
    lastManualZoomRef.current = 1.25;
    fitWidthActiveRef.current = false;
    manualZoomUsedRef.current = false;
    mobileWidthFitAppliedRef.current = false;
    setRenderedPages([]); setThumbs([]); setOcrPages([]); setToc([]); setDocInfo([]);
    try {
      setLoadPct(25);
      const doc = await pdfjsRef.current.getDocument(src).promise;
      setPdfDoc(doc); setTotalPages(doc.numPages); setCurrentPage(1); setPageInput("1");
      setLoadPct(40);

      const pages = Array.from({ length: doc.numPages }, (_, i) => ({
        id: `p${i + 1}-${Date.now()}`, pageNum: i + 1,
        blob: null, url: null, status: "pending", remoteUrl: "", text: "",
      }));
      setOcrPages(pages);

      await renderAll(doc, zoom, rotation, pages);
      if (window.matchMedia("(max-width: 768px)").matches && pages[0]?.canvas?.width) {
        mobileAutoFitDoneRef.current = false;
        fitToWidthFromCanvas(pages[0].canvas.width, zoom);
        mobileAutoFitDoneRef.current = true;
      }
      setLoadPct(90);

      // TOC
      try {
        const outline = await doc.getOutline();
        if (outline?.length) {
          const items = await Promise.all(outline.slice(0, 50).map(async item => {
            let pg = null;
            try {
              if (item.dest) {
                const ref = Array.isArray(item.dest) ? item.dest[0] : (await doc.getDestination(item.dest))[0];
                pg = (await doc.getPageIndex(ref)) + 1;
              }
            } catch {}
            return { title: item.title, page: pg };
          }));
          setToc(items);
        }
      } catch {}

      // Metadata
      try {
        const meta = await doc.getMetadata();
        const info = meta.info || {};
        setDocInfo([
          ["Name", name || "—"],
          ["Title", info.Title || "—"],
          ["Author", info.Author || "—"],
          ["Pages", doc.numPages],
          ["Size", size ? formatBytes(size) : "—"],
          ["Creator", info.Creator || "—"],
          ["Producer", info.Producer || "—"],
          ["PDF Version", info.PDFFormatVersion || "—"],
        ]);
      } catch {}

      setLoadPct(100);
      toast(`Opened: ${name}`, "ok", 2500);
    } catch (e) {
      toast("Cannot open PDF: " + e.message, "err", 5000);
    }
    setLoading(false); setLoadPct(0);
  }, [zoom, rotation, toast]);

  // ── Render all pages ──
  const renderAll = useCallback(async (doc, z, rot, ocrList) => {
    const pages = [], newThumbs = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const vp = page.getViewport({ scale: z, rotation: rot });
      const c = document.createElement("canvas");
      c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      const dataUrl = c.toDataURL("image/jpeg", 0.9);
      pages.push({ num: p, canvas: c, dataUrl });

      // Thumb
      const tvp = page.getViewport({ scale: 0.22, rotation: rot });
      const tc = document.createElement("canvas");
      tc.width = tvp.width; tc.height = tvp.height;
      await page.render({ canvasContext: tc.getContext("2d"), viewport: tvp }).promise;
      newThumbs.push({ num: p, canvas: tc });

      // Blob for OCR
      const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.92));
      const url = blob ? URL.createObjectURL(blob) : "";
      if (ocrList) ocrList[p - 1] = { ...ocrList[p - 1], blob, url };

      if (p % 3 === 0 || p === doc.numPages) {
        setRenderedPages([...pages]);
        setThumbs([...newThumbs]);
        if (ocrList) setOcrPages([...ocrList]);
      }
    }
  }, []);

  // ── Re-render on zoom/rotation change ──
  const reRender = useCallback(async () => {
    if (!pdfDoc) return;
    setLoading(true);
    const list = ocrPages.map(p => ({ ...p }));
    await renderAll(pdfDoc, zoom, rotation, list);
    setLoading(false);
  }, [pdfDoc, zoom, rotation, ocrPages, renderAll]);

  useEffect(() => { if (pdfDoc) reRender(); }, [zoom, rotation, twoPage]);

  // ── File handler ──
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      const buf = await file.arrayBuffer();
      await loadPDF(buf, file.name, file.size);
    } else {
      toast("Please open a PDF file", "err");
    }
  }, [loadPDF, toast]);

  // ── Navigate ──
  const goToPage = useCallback((p) => {
    p = Math.max(1, Math.min(totalPages, p));
    setCurrentPage(p);
    setPageInput(String(p));
    requestAnimationFrame(() => {
      const el = viewerRef.current?.querySelector(`[data-page="${p}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      else viewerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [totalPages]);

  const commitPageInput = useCallback(() => {
    const next = parseInt(pageInput, 10);
    if (Number.isFinite(next)) goToPage(next);
    else setPageInput(String(currentPage));
  }, [currentPage, goToPage, pageInput]);

  // ── Download ──
  const downloadPDF = useCallback(() => {
    if (!pdfDoc) return;
    toast("Download: re-open from your original source", "");
  }, [pdfDoc]);

  // ── Print ──
  const printPDF = useCallback(async () => {
    if (!renderedPages.length) return;
    const w = window.open("", "_blank");
    if (!w) {
      toast("Popup blocked — allow popups to print", "err", 4500);
      return;
    }
    w.document.write(`<html><head><title>${docName}</title><style>
      body{margin:0;padding:0;background:#fff;}
      img{display:block;width:100%;page-break-after:always;margin-bottom:0}
      @media print{img{page-break-after:always}}
    </style></head><body>`);
    renderedPages.forEach(rp => w.document.write(`<img src="${rp.dataUrl}" />`));
    w.document.write(`<script>
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
    <\/script></body></html>`);
    w.document.close();
    toast("Print dialog opened", "ok");
  }, [renderedPages, docName]);

  // ── Fit width ──
  // ── OCR: Upload single ──
  const uploadPage = useCallback(async (idx, keyIdx = 0) => {
    const pg = ocrPages[idx];
    if (!pg || pg.status === "ready" || pg.status === "done") return;
    setOcrPages(prev => {
      const n = [...prev]; n[idx] = { ...n[idx], status: "uploading" }; return n;
    });
    try {
      const url = await uploadToImgbb(pg.blob, keyIdx);
      setOcrPages(prev => {
        const n = [...prev]; n[idx] = { ...n[idx], status: "ready", remoteUrl: url }; return n;
      });
      toast(`Page ${idx + 1} uploaded`, "ok", 2000);
    } catch (e) {
      setOcrPages(prev => {
        const n = [...prev]; n[idx] = { ...n[idx], status: "error" }; return n;
      });
      toast(`Page ${idx + 1}: ${e.message}`, "err", 4000);
    }
  }, [ocrPages, toast]);

  // ── OCR: Upload all ──
  const uploadAll = useCallback(async () => {
    if (!pdfDoc) return;
    const pending = ocrPages.filter(p => p.status === "pending" || p.status === "error");
    if (!pending.length) { toast("All pages already uploaded", "ok"); return; }
    for (let i = 0; i < ocrPages.length; i++) {
      const pg = ocrPages[i];
      if (pg.status !== "pending" && pg.status !== "error") continue;
      setUploadProg({ show: true, pct: Math.round((i / ocrPages.length) * 100), label: `Uploading page ${i + 1} / ${ocrPages.length}…` });
      await uploadPage(i);
    }
    setUploadProg({ show: false, pct: 0, label: "" });
    toast("All pages uploaded! Open Google Lens for each.", "ok", 4000);
  }, [pdfDoc, ocrPages, uploadPage, toast]);

  // ── OCR: Open Lens ──
  const openLens = useCallback((idx) => {
    const pg = ocrPages[idx];
    if (!pg?.remoteUrl) { toast("Upload this page first", "err"); return; }
    const url = `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(pg.remoteUrl)}`;
    const w = window.open(url, `lens_pg${idx}`, "width=1200,height=860,scrollbars=yes,toolbar=yes");
    if (!w) toast("Popup blocked — please allow popups", "err", 5000);
    else toast(`Page ${idx + 1} opened in Google Lens`, "ok", 2500);
  }, [ocrPages, toast]);

  // ── OCR: Open in Textriva ──
  const openInTextriva = useCallback(async () => {
    if (!pdfDoc) { window.open(TEXTRIVA_URL, "_blank"); return; }
    // Upload current page first if not done, then redirect to Textriva
    const idx = currentPage - 1;
    const pg = ocrPages[idx];
    if (pg && pg.status === "pending") {
      toast("Uploading current page to Textriva…", "", 3000);
      await uploadPage(idx);
    }
    const updatedPg = ocrPages[idx];
    if (updatedPg?.remoteUrl) {
      // Open Textriva with the image URL pre-loaded via query param
      const url = `${TEXTRIVA_URL}?img=${encodeURIComponent(updatedPg.remoteUrl)}`;
      window.open(url, "_blank");
      toast("Opened in Textriva ↗", "ok");
    } else {
      window.open(TEXTRIVA_URL, "_blank");
    }
  }, [pdfDoc, ocrPages, currentPage, uploadPage, toast]);

  // ── OCR: Open all pages in Textriva ──
  const openAllInTextriva = useCallback(async () => {
    if (!pdfDoc) return;
    toast("Uploading all pages, then opening Textriva…", "", 5000);
    await uploadAll();
    window.open(TEXTRIVA_URL, "_blank");
    toast("Textriva opened — your pages are ready in OCR panel", "ok");
  }, [pdfDoc, uploadAll, toast]);

  // ── OCR: Save text ──
  const saveText = useCallback((idx, text) => {
    setOcrPages(prev => {
      const n = [...prev];
      n[idx] = { ...n[idx], text: text.trim(), status: text.trim() ? "done" : n[idx].status };
      return n;
    });
    if (onTextExtracted) onTextExtracted(idx + 1, text.trim());
  }, [onTextExtracted]);

  const updateText = useCallback((idx, text) => {
    setOcrPages(prev => { const n = [...prev]; n[idx] = { ...n[idx], text }; return n; });
  }, []);

  const copyText = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }, []);

  // ── OCR: Export all ──
  const allExtracted = useMemo(() => {
    const done = ocrPages.filter(p => p.text);
    if (!done.length) return "";
    return done.map(p => `--- Page ${p.pageNum} ---\n${p.text}`).join("\n\n");
  }, [ocrPages]);

  const exportAll = useCallback(() => {
    if (!allExtracted) { toast("No extracted text yet", "err"); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([allExtracted], { type: "text/plain" }));
    a.download = `${docName.replace(".pdf", "")}_ocr_${Date.now()}.txt`;
    a.click();
    toast("Exported as .txt", "ok");
  }, [allExtracted, docName]);

  // ── URL Open ──
  const openUrl = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    setUrlModal(false); setUrlInput("");
    try {
      setLoading(true);
      const res = await fetch(url);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const buf = await blob.arrayBuffer();
      const name = url.split("/").pop().split("?")[0] || "document.pdf";
      await loadPDF(buf, name, blob.size);
    } catch (e) {
      setLoading(false);
      toast("Failed to load URL: " + e.message, "err", 5000);
    }
  }, [urlInput, loadPDF, toast]);

  const donePgs = ocrPages.filter(p => p.status === "done").length;
  const readyPgs = ocrPages.filter(p => p.status === "ready").length;
  const uploadedPgs = donePgs + readyPgs;

  const pageGroups = twoPage
    ? Array.from({ length: Math.ceil(totalPages / 2) }, (_, i) => [i * 2 + 1, i * 2 + 2].filter(p => p <= totalPages))
    : Array.from({ length: totalPages }, (_, i) => [i + 1]);

  return (
    <div className="pv-root">
      {/* ── Inject CSS ── */}
      {/* ── TOPBAR ── */}
      <div className={`topbar ${isMobileView ? "mobile-fixed" : ""}`}>
        <div className="tb-cluster tb-cluster-nav">
          {!isMobileView && onClose && (
            <button className="tb-btn" onClick={onClose} title="Close viewer">
              <Ic d={IC.x} />
            </button>
          )}
          <button className="tb-btn" onClick={() => setSidebarOpen(v => !v)} title="Toggle sidebar [S]">
            <Ic d={IC.sidebar} />
          </button>
          <button className="tb-btn" onClick={() => goToPage(currentPage - 1)} disabled={!pdfDoc || currentPage <= 1} title="Previous page [←]">
            <Ic d={IC.prev} />
          </button>
          <div className="tb-page-nav">
            <input className="tb-page-input" type="number" min={1} max={totalPages || 1}
              ref={pageInputRef}
              value={pageInput} disabled={!pdfDoc}
              onChange={e => setPageInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") commitPageInput(); }}
              onBlur={commitPageInput} />
            <span className="tb-total">/ {totalPages || "—"}</span>
          </div>
          <button className="tb-btn" onClick={() => goToPage(currentPage + 1)} disabled={!pdfDoc || currentPage >= totalPages} title="Next page [→]">
            <Ic d={IC.next} />
          </button>
        </div>

        <div className="tb-cluster tb-cluster-mobile-actions">
          <button className="tb-btn" onClick={() => setRotation(r => (r + 90) % 360)} disabled={!pdfDoc} title="Rotate 90°">
            <Ic d={IC.rotate} />
          </button>
          <button className={`tb-btn ${twoPage ? "on" : ""}`} onClick={() => setTwoPage(v => !v)} disabled={!pdfDoc} title="Two-page spread">
            <Ic d={IC.columns} />
          </button>
          <button className="tb-btn" onClick={() => { setFullscreen(true); setFsPage(currentPage); }} disabled={!pdfDoc} title="Fullscreen [F]">
            <Ic d={IC.expand} />
          </button>
          <button className={`tb-mode-btn ${mode === "ocr" ? "on" : ""}`} onClick={() => { setMode("ocr"); setOcrOpen(true); }} disabled={!pdfDoc} title="OCR mode" aria-label="OCR mode">
            OCR
          </button>
        </div>

        <div className="tb-cluster tb-cluster-zoom">
          <button className="tb-btn" onClick={() => applyZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={!pdfDoc} title="Zoom out [-]">
            <Ic d={IC.zoomOut} />
          </button>
          <select className="tb-zoom" value={Number.isFinite(zoom) ? zoom : 1.25} disabled={!pdfDoc}
            onChange={e => applyZoom(parseFloat(e.target.value))}>
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4].map(z => (
              <option key={z} value={z}>{Math.round(z * 100)}%</option>
            ))}
          </select>
          <button className="tb-btn" onClick={() => applyZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} disabled={!pdfDoc} title="Zoom in [+]">
            <Ic d={IC.zoomIn} />
          </button>
          <button className="tb-btn" onClick={fitToWidth} disabled={!pdfDoc} title="Fit to width">
            <Ic d={IC.fit} />
          </button>
        </div>

        <div className="tb-cluster tb-cluster-tools">
          <button className="tb-btn" onClick={() => setRotation(r => (r + 90) % 360)} disabled={!pdfDoc} title="Rotate 90°">
            <Ic d={IC.rotate} />
          </button>
          <button className={`tb-btn ${twoPage ? "on" : ""}`} onClick={() => setTwoPage(v => !v)} disabled={!pdfDoc} title="Two-page spread">
            <Ic d={IC.columns} />
          </button>
          <button className={`tb-btn ${searchVisible ? "on" : ""}`} onClick={() => setSearchVisible(v => !v)} disabled={!pdfDoc} title="Find in document [Ctrl+F]">
            <Ic d={IC.search} />
          </button>

          {searchVisible && (
            <div className={`search-bar ${searchFocus ? "focus" : ""}`}>
              <Ic d={IC.search} s={12} style={{ color: "var(--text-dim)", flexShrink: 0 }} />
              <input className="search-input" placeholder="Search…" value={searchTerm}
                autoFocus
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                onChange={e => setSearchTerm(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    if (!searchResults.length) return;
                    const ni = e.shiftKey
                      ? (searchIdx - 1 + searchResults.length) % searchResults.length
                      : (searchIdx + 1) % searchResults.length;
                    setSearchIdx(ni); goToPage(searchResults[ni].page);
                  }
                }}
              />
              {searchResults.length > 0 && (
                <>
                  <span className="search-count">{searchIdx + 1}/{searchResults.length}</span>
                  <button className="tb-btn" style={{ width: 22, height: 22 }} onClick={() => {
                    const ni = (searchIdx - 1 + searchResults.length) % searchResults.length;
                    setSearchIdx(ni); goToPage(searchResults[ni].page);
                  }} title="Previous search result" aria-label="Previous search result"><Ic d={IC.prev} s={11} /></button>
                  <button className="tb-btn" style={{ width: 22, height: 22 }} onClick={() => {
                    const ni = (searchIdx + 1) % searchResults.length;
                    setSearchIdx(ni); goToPage(searchResults[ni].page);
                  }} title="Next search result" aria-label="Next search result"><Ic d={IC.next} s={11} /></button>
                </>
              )}
              <button className="tb-btn" style={{ width: 22, height: 22 }} onClick={() => { setSearchVisible(false); setSearchTerm(""); }} title="Close search" aria-label="Close search">
                <Ic d={IC.x} s={11} />
              </button>
            </div>
          )}

          <button className="tb-btn" onClick={printPDF} disabled={!pdfDoc} title="Print">
            <Ic d={IC.print} />
          </button>
          <button className="tb-btn" onClick={() => { setFullscreen(true); setFsPage(currentPage); }} disabled={!pdfDoc} title="Fullscreen [F]">
            <Ic d={IC.expand} />
          </button>
        </div>

        <div className="tb-cluster tb-cluster-meta">
          {docName && <span className="tb-filename">{docName}</span>}

          <div className="tb-mode">
            <button
              className={`tb-mode-btn ${mode === "viewer" ? "on" : ""}`}
              onClick={() => {
                setMode("viewer");
                setOcrOpen(false);
              }}
              title="Reader mode"
              aria-label="Reader mode"
            >
              Reader
            </button>
            <button
              className={`tb-mode-btn ${mode === "ocr" ? "on" : ""}`}
              onClick={() => {
                setMode("ocr");
                setOcrOpen(true);
              }}
              title="OCR mode"
              aria-label="OCR mode"
            >
              OCR {donePgs > 0 ? `(${donePgs} done)` : ""}
            </button>
          </div>
        </div>
      </div>

      {/* ── BODY ── */}
      <div className="pv-body">
        {/* ── SIDEBAR ── */}
        <div className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="s-tabs">
            {[["thumbs", "Pages"], ["toc", "Outline"], ["info", "Info"]].map(([tab, lbl]) => (
              <div key={tab} className={`s-tab ${sidebarTab === tab ? "on" : ""}`} onClick={() => setSidebarTab(tab)}>
                {lbl}
              </div>
            ))}
          </div>
          <div className="s-body">
            {!pdfDoc && <div className="empty-state">Open a PDF to begin</div>}

            {/* Thumbnails */}
            {pdfDoc && sidebarTab === "thumbs" && thumbs.map(th => {
              const ocrPg = ocrPages[th.num - 1];
              return (
                <div key={th.num} className={`thumb-item ${currentPage === th.num ? "on" : ""}`}
                  onClick={() => goToPage(th.num)}>
                  <div className="thumb-wrap">
                    <canvas ref={el => {
                      if (el && th.canvas && th.canvas.width > 0 && th.canvas.height > 0) {
                        el.width = th.canvas.width; el.height = th.canvas.height;
                        el.getContext("2d").drawImage(th.canvas, 0, 0);
                      }
                    }} />
                    {ocrPg && ocrPg.status !== "pending" && (
                      <div className={`thumb-ocr-dot ${ocrPg.status}`} />
                    )}
                  </div>
                  <div className="thumb-page-num">{th.num}</div>
                </div>
              );
            })}

            {/* TOC */}
            {pdfDoc && sidebarTab === "toc" && (
              toc.length > 0
                ? toc.map((item, i) => (
                  <div key={i} className="toc-item" onClick={() => item.page && goToPage(item.page)}>
                    <span className="toc-title">{item.title}</span>
                    {item.page && <span className="toc-pg">{item.page}</span>}
                  </div>
                ))
                : <div className="empty-state">No outline in this document</div>
            )}

            {/* Info */}
            {pdfDoc && sidebarTab === "info" && (
              <table className="info-tbl">
                <tbody>
                  {docInfo.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── VIEWER ── */}
        <div className={`viewer ${isMobileView ? "mobile" : ""}`} ref={viewerRef} tabIndex={0}
          onTouchStart={e => {
            if (!isMobileView) return;
            if (e.touches.length === 2) {
              const dx = e.touches[0].clientX - e.touches[1].clientX;
              const dy = e.touches[0].clientY - e.touches[1].clientY;
              pinchStartDistRef.current = Math.hypot(dx, dy) || 1;
              pinchStartZoomRef.current = zoom;
            }
          }}
          onTouchMove={e => {
            if (!isMobileView || e.touches.length !== 2 || !pinchStartDistRef.current) return;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy) || 1;
            e.preventDefault();
            applyZoom(Math.max(0.25, Math.min(4, +(pinchStartZoomRef.current * (dist / pinchStartDistRef.current)).toFixed(2))));
          }}
          onTouchEnd={e => {
            if (!isMobileView) return;
            if (e.touches.length < 2) {
              pinchStartDistRef.current = 0;
            }
          }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}>

          {/* Loading bar */}
          {loading && loadPct > 0 && loadPct < 100 && (
            <div className="load-bar" style={{ width: `${loadPct}%` }} />
          )}

          {/* Spinner */}
          {loading && (
            <div className="spinner-wrap">
              <div className="spinner" />
              <span className="spinner-label">{loadPct > 0 ? `Loading… ${loadPct}%` : "Rendering…"}</span>
            </div>
          )}

          {/* Drop zone */}
          {!pdfDoc && !loading && (
            <div className="drop-zone">
              <div className={`drop-inner ${drag ? "drag" : ""}`} onClick={() => fileInputRef.current?.click()}>
                <div className="drop-emoji"><FileText size={28} color="var(--muted)" /></div>
                <div className="drop-title">Open a PDF</div>
                <div className="drop-sub">Drag & drop your PDF here<br />or click to browse files</div>
                <button className="drop-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                  Choose PDF
                </button>
                <div className="drop-formats">Supports PDF files</div>
                <div className="drop-features">
                  {["Full text search", "Page thumbnails", "Two-page spread", "Fullscreen", "Google Lens OCR"].map(f => (
                    <span key={f} className="drop-feat-tag">{f}</span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pages */}
          {renderedPages.length > 0 && pageGroups.map((grp, gi) => (
            <div key={gi} style={{ display: "flex", gap: 12, position: "relative", flexShrink: 0, marginBottom: 12 }}>
              {grp.map(pNum => {
                const rp = renderedPages.find(r => r.num === pNum);
                const ocrPg = ocrPages[pNum - 1];
                return rp ? (
                  <div key={pNum} className="page-wrap" data-page={pNum}>
                    <canvas ref={el => {
                      if (el && rp.canvas && rp.canvas.width > 0 && rp.canvas.height > 0) {
                        el.width = rp.canvas.width; el.height = rp.canvas.height;
                        el.getContext("2d").drawImage(rp.canvas, 0, 0);
                      }
                    }} />
                    {ocrPg && ["ready", "done", "uploading"].includes(ocrPg.status) && (
                      <div className={`page-ocr-badge ${ocrPg.status}`}>
                        {ocrPg.status === "done" ? "OCR done" : ocrPg.status === "ready" ? "Uploaded" : "Uploading…"}
                      </div>
                    )}
                    <div className="page-lbl">
                      {grp.length > 1 ? `${grp[0]}–${grp[grp.length - 1]}` : `Page ${grp[0]}`}
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          ))}
        </div>

        {/* ── OCR PANEL ── */}
        <div className={`ocr-panel ${ocrOpen ? "open" : "closed"}`}>
          {/* Header */}
          <div className="ocr-header">
            <div className="ocr-header-top">
              <div className="ocr-title">
                <span className="g-logo">
                  <span className="g-b">G</span><span className="g-r">o</span>
                  <span className="g-y">o</span><span className="g-b">g</span>
                  <span className="g-g">l</span><span className="g-r">e</span>
                </span>
                &nbsp;Lens OCR
              </div>
              <button className="tb-btn" style={{ width: 26, height: 26, flexShrink: 0 }}
                onClick={() => {
                  setOcrOpen(false);
                  setMode("viewer");
                }} title="Close OCR panel">
                <Ic d={IC.x} s={12} />
              </button>
            </div>
            <div className="ocr-header-actions">
              <button className="ocr-action-btn primary" onClick={uploadAll} disabled={!pdfDoc}>
                <Ic d={IC.upload} s={11} /> Upload All
              </button>
              <button className="ocr-action-btn green" onClick={exportAll} disabled={!allExtracted}>
                <Ic d={IC.download} s={11} /> Export
              </button>
              {allExtracted && (
                <button className="ocr-action-btn" onClick={async () => {
                  if (await copyText(allExtracted)) toast("All text copied!", "ok"); else toast("Copy failed", "err");
                }}>
                  <Ic d={IC.copy} s={11} /> Copy All
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {uploadProg.show && (
            <div className="ocr-progress">
              <span className="ocr-progress-label">{uploadProg.label}</span>
              <div className="ocr-progress-bar-wrap">
                <div className="ocr-progress-bar" style={{ width: `${uploadProg.pct}%` }} />
              </div>
              <span className="ocr-progress-pct">{uploadProg.pct}%</span>
            </div>
          )}

          {/* Textriva redirect button */}
          <div className="textriva-btn" onClick={openInTextriva}>
            <div className="textriva-btn-icon"><Microscope size={20} color="var(--accent)" /></div>
            <div className="textriva-btn-content">
              <div className="textriva-btn-title">Open in Textriva</div>
              <div className="textriva-btn-sub">Advanced OCR workspace — auto-uploads current page</div>
            </div>
            <div className="textriva-btn-arrow">↗</div>
          </div>

          {/* Body */}
          <div className="ocr-body">
            {!pdfDoc && (
              <>
                <div className="ocr-empty">
                  <div className="ocr-empty-icon"><Search size={28} color="var(--muted)" /></div>
                  Open a PDF to start OCR workflow
                </div>
                <div className="ocr-workflow-steps">
                  <div className="ocr-workflow-title">How it works</div>
                  {[
                    ["1", "Open a PDF file above"],
                    ["2", "Click Upload All to send pages to cloud"],
                    ["3", "Click Open in Google Lens for each page"],
                    ["4", "Copy text from Lens and paste here"],
                    ["5", "Save each page, then Export all text"],
                  ].map(([n, t]) => (
                    <div key={n} className="ocr-wf-step">
                      <div className="ocr-wf-num">{n}</div>
                      <div className="ocr-wf-text">{t}</div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {ocrPages.map((pg, idx) => (
              <div key={pg.id} className={`ocr-card ${currentPage === pg.pageNum ? "current" : ""} ${pg.status === "done" ? "done" : ""}`}>
                {/* Card header */}
                <div className="ocr-card-head">
                  <span className="ocr-card-page">PG {pg.pageNum}</span>
                  <div className={`ocr-card-status-dot ${pg.status}`} />
                  <span className={`ocr-card-status-txt ${pg.status}`}>
                    {pg.status === "pending" ? "Pending"
                      : pg.status === "uploading" ? "Uploading…"
                        : pg.status === "ready" ? "Uploaded"
                          : pg.status === "done" ? "Done"
                            : "Error"}
                  </span>
                  <span className="ocr-card-go" onClick={() => goToPage(pg.pageNum)}>→ Go</span>
                </div>

                {/* Lens button */}
                <button className={`lens-btn ${pg.status === "done" ? "done" : pg.status === "ready" ? "active" : ""}`}
                  disabled={pg.status !== "ready" && pg.status !== "done"}
                  onClick={() => openLens(idx)}>
                  {pg.status === "done" ? "Done — Open Lens Again" : "Open in Google Lens"}
                </button>

                {/* Text area */}
                <div>
                  <div className="ocr-text-label">
                    <span>Extracted Text</span>
                    <span className="ocr-text-chars">{pg.text.length} chars</span>
                  </div>
                  <textarea className="ocr-textarea"
                    value={pg.text}
                    onChange={e => updateText(idx, e.target.value)}
                    placeholder={pg.status === "ready" || pg.status === "done"
                      ? "Paste from Google Lens (Ctrl+V)…"
                      : "Upload first, then open in Google Lens…"}
                  />
                </div>

                {/* Card actions */}
                <div className="ocr-card-actions">
                  {(pg.status === "pending" || pg.status === "error") && (
                    <button className="sm-btn" onClick={() => uploadPage(idx)}>
                      <Ic d={IC.upload} s={10} /> Upload
                    </button>
                  )}
                  <button className="sm-btn" onClick={async () => {
                    try {
                      const t = await navigator.clipboard.readText();
                      updateText(idx, t); toast("Pasted!", "ok", 1500);
                    } catch { toast("Use Ctrl+V to paste manually", ""); }
                  }}>
                    <Ic d={IC.paste} s={10} /> Paste
                  </button>
                  <button className="sm-btn save" onClick={() => {
                    saveText(idx, pg.text); toast(`Page ${pg.pageNum} saved`, "ok", 2000);
                  }}>
                    <Ic d={IC.check} s={10} /> Save
                  </button>
                  {pg.text && (
                    <button className="sm-btn" onClick={async () => {
                      if (await copyText(pg.text)) toast(`Page ${pg.pageNum} copied`, "ok"); else toast("Copy failed", "err");
                    }}>
                      <Ic d={IC.copy} s={10} /> Copy
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* All results */}
            {allExtracted && (
              <div className="ocr-results">
                <div className="ocr-results-head">
                  <span className="ocr-results-title">
                    <Ic d={IC.check} s={12} /> All Extracted Text
                  </span>
                  <span className="ocr-results-meta">{donePgs} page{donePgs !== 1 ? "s" : ""}</span>
                </div>
                <div className="ocr-results-body">
                  <textarea className="ocr-all-textarea" readOnly value={allExtracted} />
                  <div className="ocr-results-btns">
                    <button className="sm-btn" onClick={async () => {
                      if (await copyText(allExtracted)) toast("Copied all!", "ok"); else toast("Copy failed", "err");
                    }}><Ic d={IC.copy} s={10} /> Copy</button>
                    <button className="sm-btn save" onClick={exportAll}>
                      <Ic d={IC.download} s={10} /> Export .txt
                    </button>
                  </div>
                </div>
              </div>
            )}

            {ocrPages.length > 0 && (
              <div className="ocr-tip">
                Tip: Upload All → Open each in Lens → Copy text → Paste → Save
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── STATUSBAR ── */}
      <div className="statusbar">
        <div className="status-item">
          <div className={`status-dot ${pdfDoc ? "green" : "dim"}`} />
          <span>{totalPages > 0 ? `${totalPages} pages` : "No document"}</span>
        </div>
        {totalPages > 0 && (
          <>
            <div className="status-item">
              <span>Page {currentPage}/{totalPages}</span>
            </div>
            <div className="status-item">
              <span>{Math.round(zoom * 100)}% · {rotation > 0 ? rotation + "°" : "0°"}</span>
            </div>
            {docSize > 0 && <div className="status-item"><span>{formatBytes(docSize)}</span></div>}
          </>
        )}
        {donePgs > 0 && (
          <div className="status-item">
            <div className="status-dot green" />
            <span>OCR: {donePgs}/{totalPages} done</span>
          </div>
        )}
        {uploadedPgs > 0 && donePgs < uploadedPgs && (
          <div className="status-item">
            <div className="status-dot" style={{ background: "var(--accent)" }} />
            <span>{uploadedPgs} uploaded</span>
          </div>
        )}
        {searchResults.length > 0 && (
          <div className="status-item">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Search size={12} />{searchResults.length} results</span>
          </div>
        )}
        <div className="status-item" style={{ marginLeft: "auto" }}>
          <div className="status-dot green" />
          <span>Local · Private</span>
        </div>
      </div>

      {/* ── FULLSCREEN ── */}
      {fullscreen && (
        <div className="fs-overlay">
          <div className={`fs-bar ${fsBarVisible ? "" : "hide"}`}>
            <button className="tb-btn" onClick={() => setFsPage(p => Math.max(1, p - 1))} style={{ color: "#fff" }} title="Previous page" aria-label="Previous page">
              <Ic d={IC.prev} />
            </button>
            <div className="tb-page-nav">
              <input className="tb-page-input" type="number"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", color: "#fff" }}
                value={fsPage} min={1} max={totalPages}
                onChange={e => setFsPage(Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1)))} />
              <span className="tb-total" style={{ color: "rgba(255,255,255,0.4)" }}>/ {totalPages}</span>
            </div>
            <button className="tb-btn" onClick={() => setFsPage(p => Math.min(totalPages, p + 1))} style={{ color: "#fff" }} title="Next page" aria-label="Next page">
              <Ic d={IC.next} />
            </button>
            <div className="tb-sep" style={{ background: "rgba(255,255,255,0.1)" }} />
            <button className="tb-btn" onClick={() => setFsZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))} style={{ color: "#fff" }} title="Zoom out" aria-label="Zoom out">
              <Ic d={IC.zoomOut} />
            </button>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "var(--font-mono)", minWidth: 42, textAlign: "center" }}>
              {Math.round(fsZoom * 100)}%
            </span>
            <button className="tb-btn" onClick={() => setFsZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} style={{ color: "#fff" }} title="Zoom in" aria-label="Zoom in">
              <Ic d={IC.zoomIn} />
            </button>
            <div style={{ flex: 1 }} />
            <button className="tb-btn" onClick={() => setFullscreen(false)} style={{ color: "#fff" }} title="Exit fullscreen [Esc/F]">
              <Ic d={IC.compress} />
            </button>
          </div>

          <div className="fs-viewer" onClick={() => setFsBarVisible(v => !v)}>
            {fsCanvas
              ? <img src={fsCanvas} alt={`Page ${fsPage}`} style={{ borderRadius: 2, boxShadow: "0 8px 60px rgba(0,0,0,0.95)", maxWidth: "100%" }} />
              : <div style={{ color: "#444", fontSize: 14 }}>Loading…</div>}
          </div>

          <div className={`fs-page-indicator ${fsBarVisible ? "" : "hide"}`} style={{ opacity: fsBarVisible ? 1 : 0 }}>
            {fsPage} / {totalPages}
          </div>
          <div className="fs-close-hint" style={{ opacity: fsBarVisible ? 1 : 0 }}>
            Esc or F to exit · ← → navigate · click to toggle toolbar
          </div>
        </div>
      )}

      {/* ── URL MODAL ── */}
      {urlModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUrlModal(false); }}>
          <div className="modal">
            <div className="modal-title">Open PDF from URL</div>
            <input className="modal-input" type="url" placeholder="https://example.com/document.pdf"
              value={urlInput} autoFocus
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") openUrl(); if (e.key === "Escape") setUrlModal(false); }}
            />
            <div className="modal-actions">
              <button className="modal-btn cancel" onClick={() => setUrlModal(false)}>Cancel</button>
              <button className="modal-btn confirm" onClick={openUrl}>Open</button>
            </div>
          </div>
        </div>
      )}

      {/* ── FILE INPUT ── */}
      <input type="file" ref={fileInputRef} accept=".pdf,application/pdf" style={{ display: "none" }}
        onChange={e => { const f = e.target.files[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {/* ── TOASTS ── */}
      <div className="toasts">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}
