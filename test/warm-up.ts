import mocha from 'mocha';

mocha.before(() => setupEnv());

function setEnv(key: string, value: string) {
  process.env['BUMPER_' + key.toUpperCase()] = value;
}
function delEnv(key: string) {
  delete process.env['BUMPER_' + key.toUpperCase()];
}

export function resetEnv() {
  delEnv('repo_link');
  delEnv('latest_version');
  delEnv('auto_link_keys');
  delEnv('auto_link_values');
  delEnv('debug');
}

export function setupEnv() {
  setEnv('repo_link', 'https://github.com/example/example');
  setEnv('latest_version', '1.1.1');
  setEnv('auto_link_keys', 'EVAN-');
  setEnv('auto_link_values', 'https://example/QQ-{num}');
  setEnv('debug', 'false');
}
