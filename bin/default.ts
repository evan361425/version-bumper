import { Config } from '../lib/config.js';
import { IConfig } from '../lib/interfaces.js';

(function main(): void {
  const result = JSON.stringify(getDefault(), null, 2);
  console.log(result);
})();

function getDefault(): IConfig & { $schema: string } {
  const cfg = new Config();
  return {
    $schema: './schema.json',
    repo: cfg.repo,
    process: cfg.process,
    hook: cfg.hook,
    changelog: cfg.changelog,
    autoLinks: cfg.autoLinks,
    pr: cfg.pr,
    diff: cfg.diff,
    tags: cfg.tags,
  };
}
