// ==UserScript==
// @name         Grepolis Map (Turunmap) Loader
// @namespace    https://github.com/Turun/GrepolisMap
// @version      0.1.0
// @description  Integreert de GrepolisMap (Rust+WASM) als zwevend paneel in Grepolis via een iframe.
// @author       You
// @match        https://*.grepolis.com/*
// @icon         https://www.grepolis.com/favicon.ico
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // ======== CONFIG ========
  // Vervang dit met de uiteindelijke gehoste URL van de gebouwde webversie (via trunk build) van GrepolisMap.
  // Voorbeeld (GitHub Pages): https://<user>.github.io/GrepolisMap/
  // Voorbeeld (Netlify):      https://<subdomain>.netlify.app/
  const HOSTED_APP_URL = 'https://boodtrap.github.io/Map-Master/'; // <-- Live URL van gehoste webbuild

  // Als je service worker caching wil vermijden, kun je de app openen met hash #dev
  const USE_DEV_HASH = true;

  // =========================

  if (!HOSTED_APP_URL || HOSTED_APP_URL === 'https://boodtrap.github.io/Map-Master/'') {
    console.warn('[GrepolisMap] HOSTED_APP_URL is nog niet ingesteld. Pas dit aan in het userscript na het hosten.');
  }

  // Detecteer wereld/taal van de huidige Grepolis pagina voor context naar de app.
  function detectContext() {
    const { hostname, href } = window.location;
    // Heuristiek: subdomein kan iets als en123.grepolis.com zijn
    // Probeer wereldcode uit subdomein te halen
    let world = '';
    const hostParts = hostname.split('.');
    if (hostParts.length >= 3) {
      world = hostParts[0];
    }

    // Taalcode raden (eerste twee letters van subdomein, als het voldoet)
    let lang = '';
    const langMatch = world.match(/^([a-z]{2})\d+/i);
    if (langMatch) {
      lang = langMatch[1].toLowerCase();
    }

    return { world, lang, href };
  }

  // UI injectie: knop + paneel + iframe
  function injectUI() {
    const existing = document.getElementById('gp-map-toggle');
    if (existing) return; // al aanwezig

    const styles = document.createElement('style');
    styles.textContent = `
      #gp-map-toggle {
        position: fixed;
        bottom: 16px;
        right: 16px;
        z-index: 999999;
        background: #2c7be5;
        color: #fff;
        border: none;
        border-radius: 6px;
        padding: 10px 12px;
        font: 600 13px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(0,0,0,0.25);
      }
      #gp-map-panel {
        position: fixed;
        bottom: 64px;
        right: 16px;
        width: min(1000px, 90vw);
        height: min(700px, 80vh);
        background: #1f1f1f;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 10px;
        overflow: hidden;
        display: none;
        z-index: 999998;
        box-shadow: 0 16px 48px rgba(0,0,0,0.45);
      }
      #gp-map-header {
        height: 36px;
        background: rgba(0,0,0,0.5);
        color: #fff;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        user-select: none;
        cursor: move;
      }
      #gp-map-title {
        font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        opacity: 0.9;
      }
      #gp-map-actions {
        display: flex;
        gap: 6px;
      }
      .gp-map-btn {
        background: rgba(255,255,255,0.12);
        color: #fff;
        border: 0;
        border-radius: 6px;
        padding: 6px 8px;
        font: 600 12px/1 system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
        cursor: pointer;
      }
      #gp-map-iframe {
        width: 100%;
        height: calc(100% - 36px);
        border: 0;
        display: block;
        background: #404040;
      }
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

    header.appendChild(title);
    actions.appendChild(popoutBtn);
    actions.appendChild(closeBtn);
    header.appendChild(actions);

    panel.appendChild(header);
    panel.appendChild(iframe);

    document.body.appendChild(panel);
    document.body.appendChild(toggleBtn);

    function buildAppUrl() {
      const ctx = detectContext();
      const url = new URL(HOSTED_APP_URL, window.location.origin);
      if (USE_DEV_HASH) url.hash = 'dev';
      // Geef context mee als query parameters. De app kan (optioneel) deze lezen via JS.
      url.searchParams.set('world', ctx.world);
      url.searchParams.set('lang', ctx.lang);
      url.searchParams.set('from', 'tampermonkey');
      return url.toString();
    }

    function openPanel() {
      iframe.src = buildAppUrl();
      panel.style.display = 'block';
      saveOpenState(true);
    }

    function closePanel() {
      panel.style.display = 'none';
      saveOpenState(false);
    }

    toggleBtn.addEventListener('click', () => {
      if (panel.style.display === 'none' || panel.style.display === '') {
        openPanel();
      } else {
        closePanel();
      }
    });

    popoutBtn.addEventListener('click', () => {
      window.open(buildAppUrl(), '_blank');
    });

    closeBtn.addEventListener('click', () => closePanel());

    // Drag verplaatsing en opslag positie
    makeDraggable(panel, header);
    restorePanelState(panel);
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
    const rect = panel.getBoundingClientRect();
    const pos = { left: rect.left, top: rect.top };
    localStorage.setItem('gp-map-pos', JSON.stringify(pos));
  }

  function restorePanelState(panel) {
    const saved = localStorage.getItem('gp-map-pos');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        panel.style.left = pos.left + 'px';
        panel.style.top = pos.top + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
        panel.style.position = 'fixed';
      } catch {}
    }
    const open = localStorage.getItem('gp-map-open');
    if (open === '1') {
      // iframe src wordt gezet in openPanel()
      panel.style.display = 'block';
    }
  }

  function saveOpenState(isOpen) {
    localStorage.setItem('gp-map-open', isOpen ? '1' : '0');
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  ready(() => {
    injectUI();
  });
})();
