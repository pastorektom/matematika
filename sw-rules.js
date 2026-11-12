// Pravidla Service Workeru. Prostý skript bez importů: sw.js ho načte přes importScripts
// a testy ho načtou v Node (nastaví globalThis.SWRules).
(function (root) {
  // Kam se nikdy nesahá: databáze, přihlášení a pevné příklady (content/).
  var BLOCKED_HOSTS = /(^|\.)supabase\.(co|in|net)$/i;
  var PINNED_CDN = 'cdn.jsdelivr.net';
  var EXACT_VERSION = /@\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?(?=\/|$)/;

  // Vrací: 'skip' (nechat prohlížeč), 'shell' (index.html: nejdřív síť), 'static' (vlastní soubor: nejdřív cache),
  // 'cdn' (pevná verze z jsDelivr: nejdřív cache).
  function classify(urlString, scopeString, method) {
    if (method && String(method).toUpperCase() !== 'GET') return 'skip';
    var url; var scope;
    try { url = new URL(urlString); scope = new URL(scopeString); } catch (e) { return 'skip'; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return 'skip';
    if (BLOCKED_HOSTS.test(url.hostname)) return 'skip';
    if (url.origin === scope.origin) {
      if (url.pathname.indexOf(scope.pathname) !== 0) return 'skip';
      var rel = url.pathname.slice(scope.pathname.length);
      if (rel === '' || rel === 'index.html') return 'shell';
      if (rel === 'sw.js' || rel.indexOf('content/') === 0) return 'skip';
      return 'static';
    }
    if (url.hostname === PINNED_CDN && EXACT_VERSION.test(url.pathname)) return 'cdn';
    return 'skip';
  }

  root.SWRules = { classify: classify };
})(typeof self !== 'undefined' ? self : globalThis);
