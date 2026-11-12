import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authErrorFromHash, initialScreen, finishPasswordChange } from '../js/boot.js';

test('chybový hash od Supabase dá českou hlášku, jiné hashe null', () => {
  const h = '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired';
  assert.equal(authErrorFromHash(h), 'Odkaz vypršel nebo už byl použit. Požádej o nový e-mail.');
  assert.equal(authErrorFromHash('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired'),
    'Odkaz vypršel nebo už byl použit. Požádej o nový e-mail.');
  assert.match(authErrorFromHash('#error=server_error&error_code=unexpected_failure'), /Přihlášení se nepovedlo/);
  assert.equal(authErrorFromHash('#/tema/limita'), null);
  assert.equal(authErrorFromHash(''), null);
  assert.equal(authErrorFromHash('#access_token=abc&type=recovery'), null);
});

test('host se pamatuje: bez konfigurace rovnou host, s konfigurací přihlášení', () => {
  assert.equal(initialScreen(false), 'guest');
  assert.equal(initialScreen(true), 'login');
});

test('po změně hesla se fronta odešle až po nastavení uživatele', async () => {
  const log = [];
  await finishPasswordChange({
    setHash: () => log.push('hash'),
    getUser: async () => { log.push('user'); return { id: 'u1' }; },
    enterApp: (u) => log.push(`enter:${u.id}`),
    flush: async () => { log.push('flush'); },
  });
  assert.deepEqual(log, ['hash', 'user', 'enter:u1', 'flush']);
});
