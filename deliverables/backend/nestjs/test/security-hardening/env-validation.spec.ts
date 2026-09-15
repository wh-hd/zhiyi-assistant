import { validateEnvironment } from '../../src/config/env.validation';

const base = {
  NODE_ENV: 'test',
  DATABASE_URL: 'mysql://local:local@127.0.0.1:3307/zhiyi_test',
  JWT_ACCESS_SECRET: `access-${'a'.repeat(70)}`,
  JWT_REFRESH_SECRET: `refresh-${'b'.repeat(70)}`,
};

describe('environment validation', () => {
  it('parses explicit false strings as false', () => {
    const config = validateEnvironment({
      ...base,
      ALLOW_DEV_IDENTITY: 'false',
      UPLOAD_ENABLED: 'false',
    });
    expect(config.ALLOW_DEV_IDENTITY).toBe(false);
    expect(config.UPLOAD_ENABLED).toBe(false);
  });

  it('rejects identical access and refresh secrets', () => {
    expect(() => validateEnvironment({
      ...base,
      JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET,
    })).toThrow('access and refresh secrets must differ');
  });
});
