import { validateEnvironment } from '../../src/config/env.validation';

describe('release hardening e2e configuration contract', () => {
  it('rejects identical access and refresh secrets', () => {
    const secret = 'x'.repeat(64);
    expect(() => validateEnvironment({ DATABASE_URL: 'mysql://local:local@127.0.0.1:3307/test', JWT_ACCESS_SECRET: secret, JWT_REFRESH_SECRET: secret })).toThrow(/must differ/);
  });
});
