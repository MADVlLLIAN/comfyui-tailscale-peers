/**
 * ComfyUI Tailscale Peers — Toolbar Widget
 * Uses app.menu.settingsGroup.element.before() — same API as rgthree.
 */

import { app } from "../../scripts/app.js";

const REFRESH_INTERVAL = 60000;

const OS_ICONS = {
  windows: "🖥️", linux: "🐧", darwin: "🍎", macos: "🍎",
  android: "📱", ios: "📱", iphone: "📱", ipad: "📱",
};

function getOSIcon(os = "") {
  const lower = os.toLowerCase();
  for (const [key, icon] of Object.entries(OS_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "💻";
}

function formatHostname(peer) {
  return peer.hostname || (peer.dns_name || "").replace(/\.$/, "") || peer.ip || "Unknown";
}

function timeSince(isoString) {
  if (!isoString) return "";
  try {
    const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
    if (diff < 60) return `${Math.round(diff)}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
  } catch { return ""; }
}

function injectStyles() {
  if (document.getElementById("ts-styles")) return;
  const style = document.createElement("style");
  style.id = "ts-styles";
  style.textContent = `
    /* Toolbar button — matches ComfyUI's own .comfyui-button style */
    #ts-toolbar-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 3px 9px;
      background: transparent;
      border: 1px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      color: #999;
      font-family: inherit;
      white-space: nowrap;
      user-select: none;
      height: 28px;
      box-sizing: border-box;
      transition: background 0.12s, border-color 0.12s, color 0.12s;
    }
    #ts-toolbar-btn:hover,
    #ts-toolbar-btn.ts-open {
      background: #2a2a2a;
      border-color: #3a3a3a;
      color: #ddd;
    }
    #ts-toolbar-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3a3a3a;
      flex-shrink: 0;
      transition: background 0.4s;
    }

    /* Dropdown */
    #ts-dropdown {
      position: fixed;
      width: 220px;
      background: #161616;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      box-shadow: 0 8px 28px rgba(0,0,0,0.75);
      z-index: 99999;
      overflow: hidden;
      font-family: ui-monospace, 'JetBrains Mono', 'Fira Code', monospace;
      font-size: 12px;
      color: #999;
      display: none;
    }
    #ts-dropdown.ts-visible {
      display: block;
      animation: ts-drop 0.1s ease;
    }
    @keyframes ts-drop {
      from { opacity:0; transform:translateY(-3px); }
      to   { opacity:1; transform:translateY(0); }
    }

    .ts-section-label {
      padding: 5px 11px 2px;
      font-size: 9px;
      letter-spacing: 0.12em;
      font-weight: 700;
      text-transform: uppercase;
      color: #333;
    }
    .ts-section-label.ts-s-online  { color: #1e5c3a; }
    .ts-section-label.ts-s-idle    { color: #5c4a00; }
    .ts-section-label.ts-s-offline { color: #3a2020; }

    .ts-peer-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 11px;
      border-top: 1px solid #1c1c1c;
      background: transparent;
      transition: background 0.1s;
    }
    .ts-peer-row:hover { background: #1c1c1c; }

    .ts-peer-name        { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#bbb; }
    .ts-peer-name.ts-dim { color: #383838; }
    .ts-peer-meta        { font-size:10px; color:#2e2e2e; margin-top:1px; }

    .ts-you { background:#1a1a1a; color:#444; border-radius:3px; padding:1px 4px; font-size:9px; margin-left:3px; flex-shrink:0; }

    .ts-dot       { width:5px; height:5px; border-radius:50%; flex-shrink:0; }
    .ts-dot.ts-on   { background:#22c55e; }
    .ts-dot.ts-idle { background:#eab308; }
    .ts-dot.ts-of   { background:#ef4444; }

    #ts-footer {
      display:flex; align-items:center; justify-content:space-between;
      padding: 4px 11px;
      border-top: 1px solid #1c1c1c;
      font-size: 10px;
      color: #2a2a2a;
    }
    #ts-refresh-btn {
      background:none; border:none; color:#2e2e2e; cursor:pointer;
      font-size:13px; padding:0; line-height:1;
      transition: color 0.12s;
    }
    #ts-refresh-btn:hover { color:#666; }
    .ts-status-msg {
      padding:12px 11px; color:#2e2e2e; text-align:center; font-size:11px;
    }
  `;
  document.head.appendChild(style);
}

// ── DOM refs ────────────────────────────────────────────────────────────────
let btnEl = null;
let dropEl = null;
let isOpen = false;

function buildWidget() {
  // Button
  btnEl = document.createElement("button");
  btnEl.id = "ts-toolbar-btn";
  btnEl.title = "Tailscale Network";
  btnEl.innerHTML = `
    <span style="font-size:14px;line-height:1">🌐</span>
    <span id="ts-toolbar-label" style="font-size:10px;letter-spacing:-2px">⚫</span>
  `;
  btnEl.addEventListener("click", (e) => { e.stopPropagation(); if (!isOpen) fetchAndRender(); toggle(); });

  // Dropdown (appended to body so it layers above everything)
  dropEl = document.createElement("div");
  dropEl.id = "ts-dropdown";
  dropEl.innerHTML = `<div class="ts-status-msg">Connecting…</div>`;
  document.body.appendChild(dropEl);

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (isOpen && e.target !== btnEl && !dropEl.contains(e.target)) close();
  });

  return btnEl;
}

function position() {
  if (!btnEl || !dropEl) return;
  const r = btnEl.getBoundingClientRect();
  dropEl.style.left = r.left + "px";
  dropEl.style.top  = (r.bottom + 3) + "px";
}

function toggle() { isOpen ? close() : open(); }
function open()  { isOpen = true;  position(); dropEl.classList.add("ts-visible");    btnEl.classList.add("ts-open"); }
function close() { isOpen = false; dropEl.classList.remove("ts-visible"); btnEl.classList.remove("ts-open"); }

// ── Rendering ───────────────────────────────────────────────────────────────
let lastJson = "";

function updateToolbarLabel(peers) {
  const label = document.getElementById("ts-toolbar-label");
  if (!label) return;
  const active  = peers.filter(p => p.online).length;
  const idle    = peers.filter(p => !p.online && p.ts_online).length;
  const offline = peers.filter(p => !p.online && !p.ts_online).length;
  label.textContent = "🟢".repeat(active) + "🟡".repeat(idle) + "🔴".repeat(offline) || "⚫";
}

function renderPeers(peers) {
  const active  = peers.filter(p => p.online);
  const idle    = peers.filter(p => !p.online && p.ts_online);
  const offline = peers.filter(p => !p.online && !p.ts_online);

  updateToolbarLabel(peers);

  let html = "";
  if (active.length)  html += `<div class="ts-section-label ts-s-online">On ComfyUI · ${active.length}</div>`   + active.map(peerRow).join("");
  if (idle.length)    html += `<div class="ts-section-label ts-s-idle">Tailscale · ${idle.length}</div>`         + idle.map(peerRow).join("");
  if (offline.length) html += `<div class="ts-section-label ts-s-offline">Offline · ${offline.length}</div>`    + offline.map(peerRow).join("");
  if (!html) html = `<div class="ts-status-msg">No peers found</div>`;

  html += `<div id="ts-footer"><span id="ts-updated">–</span><button id="ts-refresh-btn" title="Refresh">↻</button></div>`;
  dropEl.innerHTML = html;

  document.getElementById("ts-refresh-btn")?.addEventListener("click", (e) => {
    e.stopPropagation(); fetchAndRender();
  });
}

function peerRow(p) {
  const dotCls  = p.online ? "ts-on" : p.ts_online ? "ts-idle" : "ts-of";
  const nameCls = p.online ? "" : p.ts_online ? "" : "ts-dim";
  const badge   = p.is_self ? `<span class="ts-you">you</span>` : "";
  const ip      = p.ip      ? `<div class="ts-peer-meta">${p.ip}</div>` : "";
  const since   = !p.online && p.last_seen ? `<div class="ts-peer-meta">${timeSince(p.last_seen)}</div>` : "";
  return `
    <div class="ts-peer-row">
      <span style="font-size:14px;flex-shrink:0">${getOSIcon(p.os)}</span>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:5px">
          <span class="ts-dot ${dotCls}"></span>
          <span class="ts-peer-name ${nameCls}">${formatHostname(p)}</span>${badge}
        </div>
        ${ip}${since}
      </div>
    </div>`;
}

// ── Fetch ────────────────────────────────────────────────────────────────────
let fetching = false;

async function fetchAndRender() {
  if (fetching) return; // don't pile up requests if the previous one is still running
  fetching = true;
  try {
    const data = await fetch("/tailscale/peers").then(r => r.json());

    if (data.status === "error") {
      const label = document.getElementById("ts-toolbar-label");
      if (label) label.textContent = "🔴";
      if (dropEl) dropEl.innerHTML = `<div class="ts-status-msg">⚠️ ${data.message || "Tailscale unavailable"}</div>`;
      return;
    }

    const peers = data.peers || [];
    const j = JSON.stringify(peers);
    if (j !== lastJson) { lastJson = j; renderPeers(peers); }
    else { updateToolbarLabel(peers); } // label element may have been recreated after page reload

    const el = document.getElementById("ts-updated");
    if (el) el.textContent = new Date().toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" });

  } catch {
    const label = document.getElementById("ts-toolbar-label");
    if (label) label.textContent = "⚫";
  } finally {
    fetching = false;
  }
}

// ── Extension ────────────────────────────────────────────────────────────────
app.registerExtension({
  name: "Tailscale.PeersPanel",

  async setup() {
    injectStyles();

    const mount = () => new Promise(resolve => {
      const attempt = () => {
        // Use the same API rgthree uses: app.menu.settingsGroup.element.before(...)
        if (app.menu?.settingsGroup?.element) {
          const btn = buildWidget();
          app.menu.settingsGroup.element.before(btn);
          console.log("[Tailscale] Mounted to toolbar via app.menu.settingsGroup");
          return resolve();
        }
        // Fallback: .comfyui-body-top (rgthree's fallback)
        const top = document.querySelector(".comfyui-body-top");
        if (top) {
          const btn = buildWidget();
          top.appendChild(btn);
          console.log("[Tailscale] Mounted to .comfyui-body-top");
          return resolve();
        }
        setTimeout(attempt, 200);
      };
      attempt();
    });

    await mount();
    await fetchAndRender();
    setInterval(fetchAndRender, REFRESH_INTERVAL);
  },
});
