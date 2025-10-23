// ==UserScript==
// @name         Grepolis Map (Turunmap) Loader
// @namespace    https://github.com/Turun/GrepolisMap
// @version      0.1.2
// @description  Integreert de GrepolisMap (Rust+WASM) als zwevend paneel in Grepolis via een iframe.
// @author       You
// @match        https://*.grepolis.com/*
// @icon         https://www.grepolis.com/favicon.ico
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ======== CONFIG ========
  // Set this to the hosted URL of the built web app (Trunk output).
  const HOSTED_APP_URL = 'https://boodtrap.github.io/Map-Master/';
  // When true the loader will add #dev to the app URL to bypass SW caching when you want.
  const USE_DEV_HASH = true;
  // =========================

  console.info('[GrepolisMap] loader initializing');

  if (!HOSTED_APP_URL) {
    console.warn('[GrepolisMap] HOSTED_APP_URL is leeg — pas dit aan in het userscript.');
  }

  function detectContext() {
    const { hostname, href } = window.location;
    let world = '';
    const hostParts = hostname.split('.');
    if (hostParts.length >= 3) world = hostParts[0];
    let lang = '';
    const langMatch = world.match(/^([a-z]{2})\d+/i);
    if (langMatch) lang = langMatch[1].toLowerCase();
    return { world, lang, href };
  }

  function injectUI() {
    if (document.getElementById('gp-map-toggle')) return;

    const styles = document.createElement('style');
    styles.textContent = `
      #gp-map-toggle { position: fixed; bottom: 16px; right: 16px; z-index: 999999; background:#2c7be5; color:#fff; border:0; border-radius:6px; padding:10px 12px; font:600 13px/1 system-ui,Segoe UI,Roboto,Arial; cursor:pointer; box-shadow:0 6px 16px rgba(0,0,0,0.25); }
      #gp-map-panel { position: fixed; bottom:64px; right:16px; width: min(1000px,90vw); height: min(700px,80vh); background:#1f1f1f; border:1px solid rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; display:none; z-index:999998; box-shadow:0 16px 48px rgba(0,0,0,0.45); }
      #gp-map-header { height:36px; background:rgba(0,0,0,0.5); color:#fff; display:flex; align-items:center; justify-content:space-between; padding:0 10px; user-select:none; cursor:move; }
      #gp-map-title { font:600 12px system-ui,Segoe UI,Roboto,Arial; opacity:0.9; }
      #gp-map-actions { display:flex; gap:6px; }
      .gp-map-btn { background:rgba(255,255,255,0.12); color:#fff; border:0; border-radius:6px; padding:6px 8px; font:600 12px system-ui,Segoe UI,Roboto,Arial; cursor:pointer; }
      #gp-map-iframe { width:100%; height:calc(100% - 36px); border:0; display:block; background:#404040; }
      #gp-map-overlay { position:absolute; left:0; top:36px; right:0; bottom:0; background:rgba(20,20,20,0.9); color:#fff; display:none; align-items:center; justify-content:center; padding:16px; text-align:center; z-index:1000000; }
      #gp-map-overlay a { color:#9fd0ff; text-decoration:underline; }
    `;
    document.head.appendChild(styles);

    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'gp-map-toggle';
    toggleBtn.textContent = 'Grepolis Map';

    const panel = document.createElement('div');
    panel.id = 'gp-map-panel';

    const header = document.createElement('div');
    header.id = 'gp-map-header';

    const title = document.createElement('div');
    title.id = 'gp-map-title';
    title.textContent = 'Grepolis Map';

    const actions = document.createElement('div');
    actions.id = 'gp-map-actions';

    const popoutBtn = document.createElement('button');
    popoutBtn.className = 'gp-map-btn';
    popoutBtn.textContent = 'Open in nieuw tabblad';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'gp-map-btn';
    closeBtn.textContent = 'Sluiten';

    const iframe = document.createElement('iframe');
    iframe.id = 'gp-map-iframe';
    // NOTE: intentionally not using sandbox here to avoid extra restrictions while debugging

    const overlay = document.createElement('div');
    overlay.id = 'gp-map-overlay';

    header.appendChild(title);
    actions.appendChild(popoutBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);

    panel.appendChild(header);
    panel.appendChild(iframe);
    panel.appendChild(overlay);

    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);

    function buildAppUrl() {
      const ctx = detectContext();
      let url;
      try {
        url = new URL(HOSTED_APP_URL);
      } catch (e) {
        url = new URL(HOSTED_APP_URL, window.location.origin);
      }
      if (USE_DEV_HASH) url.hash = 'dev';
      url.searchParams.set('world', ctx.world);
      url.searchParams.set('lang', ctx.lang);
      url.searchParams.set('from', 'tampermonkey');
      return url.toString();
    }

    function showOverlay(html) {
      overlay.innerHTML = html;
      overlay.style.display = 'flex';
    }
    function hideOverlay() {
      overlay.style.display = 'none';
      overlay.innerHTML = '';
    }

    function openPanel() {
      hideOverlay();
      try {
        iframe.src = buildAppUrl();
        panel.style.display = 'block';
        saveOpenState(true);
        // If iframe doesn't fire load within X seconds, show helpful overlay (embedding blocked / network issue)
        const failTimer = setTimeout(() => {
          if (!iframe.contentWindow) {
            const safeUrl = buildAppUrl();
            showOverlay(
              '<div><strong>Map could not be embedded.</strong><br><br>' +
              'This page cannot show the hosted map inside an iframe (CSP / X-Frame-Options or network issue).<br><br>' +
              `Open the map in a new tab: <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open Map</a></div>`
            );
          }
        }, 4000);
        iframe.addEventListener('load', function onLoad() {
          clearTimeout(failTimer);
          iframe.removeEventListener('load', onLoad);
          hideOverlay();
          console.info('[GrepolisMap] iframe loaded.');
        });
      } catch (err) {
        console.error('[GrepolisMap] openPanel error', err);
        showOverlay('<div><strong>Failed to set iframe.src</strong><br>' + String(err) + '</div>');
      }
    }

    function closePanel() {
      panel.style.display = 'none';
      // avoid keeping src loaded when closed to reduce memory
      try { iframe.src = 'about:blank'; } catch (e) {}
      saveOpenState(false);
    }

    toggleBtn.addEventListener('click', () => {
      if (panel.style.display === 'none' || panel.style.display === '') openPanel(); else closePanel();
    });

    popoutBtn.addEventListener('click', () => {
      window.open(buildAppUrl(), '_blank');
    });

    closeBtn.addEventListener('click', () => closePanel());

    iframe.addEventListener('error', (e) => {
      console.error('[GrepolisMap] iframe error loading:', e);
      const safeUrl = buildAppUrl();
      showOverlay(
        '<div><strong>Failed to load map.</strong><br><br>' +
        'There was an error loading the hosted map. Open in a new tab to continue:<br>' +
        ` <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">Open Map</a></div>`
      );
    });

    makeDraggable(panel, header);
    // restorePanelState will set iframe.src if open flag was saved
    restorePanelState(panel, iframe, openPanel);
  }

  function makeDraggable(panel, handle) {
    let isDown = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;

    handle.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      e.preventDefault();
    });

    function onMove(e) {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, startLeft + dx));
      const top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, startTop + dy));
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      panel.style.position = 'fixed';
    }

    function onUp() {
      if (!isDown) return;
      isDown = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      savePanelPos(panel);
    }
  }

  function savePanelPos(panel) {
    try {
      const rect = panel.getBoundingClientRect();
      const pos = { left: rect.left, top: rect.top };
      localStorage.setItem('gp-map-pos', JSON.stringify(pos));
    } catch (e) { /* ignore */ }
  }

  // restorePanelState: if open flag is set, call provided openPanel function so iframe.src is set reliably
  function restorePanelState(panel, iframe, openPanelFn) {
    const saved = localStorage.getItem('gp-map-pos');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        panel.style.left = pos.left + 'px';
        panel.style.top = pos.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.position = 'fixed';
      } catch (error) { /* ignore */ }
    }
    const open = localStorage.getItem('gp-map-open');
    if (open === '1') {
      if (typeof openPanelFn === 'function') {
        // call the same open routine to ensure src + diagnostics run
        openPanelFn();
      } else {
        // fallback: set src directly
        try {
          let ctx = detectContext();
          let url;
          try { url = new URL(HOSTED_APP_URL); } catch (e) { url = new URL(HOSTED_APP_URL, window.location.origin); }
          if (USE_DEV_HASH) url.hash = 'dev';
          url.searchParams.set('world', ctx.world);
          url.searchParams.set('lang', ctx.lang);
          url.searchParams.set('from', 'tampermonkey');
          iframe.src = url.toString();
        } catch (e) { console.warn('[GrepolisMap] restore fallback failed', e); }
      }
      panel.style.display = 'block';
    }
  }

  function saveOpenState(isOpen) {
    try { localStorage.setItem('gp-map-open', isOpen ? '1' : '0'); } catch (e) { /* ignore */ }
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn); else fn();
  }

  ready(() => injectUI());
})();
