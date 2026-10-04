import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const passwords = new PasswordService();

  it('verifica la contraseña correcta y rechaza las demás', async () => {
    const hash = await passwords.hash('demo-parrilla-2026');

    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await passwords.verify(hash, 'demo-parrilla-2026')).toBe(true);
    expect(await passwords.verify(hash, 'otra')).toBe(false);
  });

  it('un hash dañado es "contraseña incorrecta", no un error', async () => {
    expect(await passwords.verify('no-es-un-hash', 'x')).toBe(false);
  });
});
