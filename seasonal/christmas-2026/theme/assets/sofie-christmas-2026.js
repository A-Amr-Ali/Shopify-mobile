(() => {
  'use strict';
  const configElement = document.getElementById('sf-christmas-config');
  if (!configElement || window.sfChristmas2026) return;
  let config;
  try { config = JSON.parse(configElement.textContent); } catch { return; }
  const root = document.documentElement;
  const inSeason = () => Date.now() >= config.startsAt && Date.now() < config.expiresAt;
  if (!inSeason()) {
    root.removeAttribute('data-sf-christmas');
    document.querySelectorAll('[data-sf-festive]').forEach(element => element.remove());
    return;
  }
  root.setAttribute('data-sf-christmas', 'active');
  const controller = new AbortController();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = window.matchMedia('(max-width: 800px)');
  const snow = document.querySelector('[data-sf-festive-snow]');
  const storageKey = 'sofie-christmas-motion-2026';
  let paused = false;
  let expiryTimer;
  let snowInitialized = false;
  try { paused = localStorage.getItem(storageKey) === 'paused'; } catch {}

  function buildSnow() {
    if (!snow || snowInitialized || !config.snow || reducedMotion.matches || paused) return;
    if (navigator.connection && navigator.connection.saveData) return;
    snowInitialized = true;
    const count = mobile.matches ? 12 : 24;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const flake = document.createElement('span');
      flake.className = 'sf-xmas-flake';
      flake.style.setProperty('--x', `${((index * 41 + 13) % 101)}%`);
      flake.style.setProperty('--size', `${2 + index % 4}px`);
      flake.style.setProperty('--opacity', `${0.22 + (index % 4) * 0.07}`);
      flake.style.setProperty('--duration', `${16 + index % 11}s`);
      flake.style.setProperty('--delay', `${-(index * 3 % 27)}s`);
      flake.style.setProperty('--drift', `${(index % 2 ? 1 : -1) * (15 + index % 40)}px`);
      fragment.appendChild(flake);
    }
    snow.appendChild(fragment);
  }

  function syncMotion() {
    const stopped = paused || reducedMotion.matches;
    root.setAttribute('data-sf-christmas-motion', stopped ? 'paused' : 'running');
    root.setAttribute('data-sf-christmas-hidden', document.hidden ? 'true' : 'false');
    document.querySelectorAll('[data-sf-festive-toggle]').forEach(button => {
      button.setAttribute('aria-pressed', String(stopped));
      button.disabled = reducedMotion.matches;
      const label = button.querySelector('[data-sf-festive-toggle-label]');
      if (label) label.textContent = reducedMotion.matches ? config.strings.reduced : stopped ? config.strings.resume : config.strings.pause;
    });
    buildSnow();
  }

  function destroySeason() {
    window.clearTimeout(expiryTimer);
    controller.abort();
    root.removeAttribute('data-sf-christmas');
    root.removeAttribute('data-sf-christmas-motion');
    root.removeAttribute('data-sf-christmas-hidden');
    document.querySelectorAll('[data-sf-festive]').forEach(element => element.remove());
    const stylesheet = document.getElementById('sf-christmas-styles');
    if (stylesheet) stylesheet.remove();
    configElement.remove();
    delete window.sfChristmas2026;
  }

  function checkSeason() {
    if (!inSeason()) { destroySeason(); return; }
    window.clearTimeout(expiryTimer);
    expiryTimer = window.setTimeout(checkSeason, Math.min(config.expiresAt - Date.now(), 60000));
  }

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('[data-sf-festive-toggle]');
    if (!button || reducedMotion.matches) return;
    paused = !paused;
    try { localStorage.setItem(storageKey, paused ? 'paused' : 'running'); } catch {}
    syncMotion();
  }, { signal: controller.signal });
  reducedMotion.addEventListener('change', syncMotion, { signal: controller.signal });
  document.addEventListener('visibilitychange', () => { checkSeason(); if (inSeason()) syncMotion(); }, { signal: controller.signal });
  window.addEventListener('pageshow', () => { checkSeason(); if (inSeason()) syncMotion(); }, { signal: controller.signal });
  window.sfChristmas2026 = { destroy: destroySeason };
  syncMotion();
  checkSeason();
})();
