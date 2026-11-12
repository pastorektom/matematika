// Čisté pomocníky pro start aplikace (bez DOM a sítě, aby šly testovat).

// Supabase při neplatném odkazu z e-mailu přidá do adresy např.
// #error=access_denied&error_code=otp_expired&error_description=... ; vrátí českou hlášku, nebo null.
export function authErrorFromHash(hash) {
  const raw = String(hash ?? '').replace(/^#\/?/, '');
  if (!raw.includes('error')) return null;
  let p;
  try { p = new URLSearchParams(raw); } catch { return null; }
  if (!p.has('error') && !p.has('error_code')) return null;
  const text = `${p.get('error_code') ?? ''} ${p.get('error_description') ?? ''}`;
  if (/otp_expired|expired|invalid/i.test(text)) return 'Odkaz vypršel nebo už byl použit. Požádej o nový e-mail.';
  return 'Přihlášení se nepovedlo. Zkus to prosím znovu nebo si pošli nový e-mail.';
}

// Bez Supabase (prázdná konfigurace) se rovnou startuje jako host; s ním se vždy přihlašuje.
export function initialScreen(configured) {
  return configured ? 'login' : 'guest';
}

// Po změně hesla: nejdřív uživatel a vstup do aplikace (setProgressUser), teprve potom odeslání fronty.
export async function finishPasswordChange({ setHash, getUser, enterApp, flush }) {
  setHash();
  const user = await getUser();
  enterApp(user);
  await flush();
}
