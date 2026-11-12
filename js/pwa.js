// Registrace Service Workeru (jen na https nebo localhost) a nabídka "Nová verze – obnovit".
export function canRegister(loc = globalThis.location, nav = globalThis.navigator) {
  if (!loc || !nav || !('serviceWorker' in nav)) return false;
  return loc.protocol === 'https:' || loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname === '[::1]';
}

export function showUpdateToast(doc, onReload) {
  if (!doc || doc.getElementById('update-toast')) return null;
  const box = doc.createElement('div');
  box.id = 'update-toast';
  box.className = 'update-toast';
  box.setAttribute('role', 'status');
  const text = doc.createElement('span');
  text.textContent = 'Nová verze je připravená.';
  const btn = doc.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Nová verze – obnovit';
  btn.addEventListener('click', onReload);
  box.append(text, btn);
  doc.body.append(box);
  return box;
}

export function registerServiceWorker({ loc = globalThis.location, nav = globalThis.navigator, doc = globalThis.document } = {}) {
  try {
    if (!canRegister(loc, nav)) return;
    const hadController = !!nav.serviceWorker.controller;
    let reloading = false;
    nav.serviceWorker.addEventListener('controllerchange', () => {
      // Při první instalaci (bez předchozí verze) se nic nehlásí.
      if (!hadController || reloading) return;
      showUpdateToast(doc, () => { reloading = true; loc.reload(); });
    });
    nav.serviceWorker.register('sw.js').catch(() => {});
  } catch { /* offline podpora je jen bonus */ }
}
