import mocha from 'mocha';

mocha.before(function () {
  setupEnv();
});

export function setEnv(key: string, value: string) {
  process.env['BUMPER_' + key.toUpperCase()] = value;
}

export function resetEnv() {
  Object.keys(process.env)
    .filter((k) => k.startsWith('BUMPER'))
    .forEach((k) => {
      delete process.env[k];
    });
}

export function setupEnv() {
  resetEnv();
  setEnv('repo_link', 'https://github.com/example/example');
  setEnv('latest_version', '1.1.1');
  setEnv('auto_link_keys', 'EVAN-');
  setEnv('auto_link_values', 'https://example/QQ-{num}');
  setEnv('debug', 'false');
}
