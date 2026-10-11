export function emulatorToken(uid) {
  const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
  const now = Math.floor(Date.now() / 1000);
  // Unsigned token accepted only by Firebase Admin's explicit Auth emulator mode.
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    aud: 'demo-fattal-acceptance', iss: 'https://securetoken.google.com/demo-fattal-acceptance',
    sub: uid, user_id: uid, iat: now, exp: now + 3600, auth_time: now,
    firebase: { sign_in_provider: 'custom', identities: {} },
  })}.`;
}
