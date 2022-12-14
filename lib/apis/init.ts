import path from 'node:path';
import fs from 'node:fs';
import { Config } from '../config.js';
import { getSchemaFile, isDebug, writeFile } from '../helper.js';
import { Changelog } from '../changelog.js';
import { info } from '../logger.js';

export default async function () {
  const config = new Config({ latestVersion: 'unknown' as never });
  Config.instance = config;
  const files = {
    config: path.resolve('bumper.json'),
    changelog: path.resolve(config.changelogInfo.file),
    latestInfo: path.resolve(config.latestInfo.file),
  };
  Object.values(files).forEach(prepareFolder);

  await config.init('version');
  const changelog = new Changelog(Config.instance.changelog);

  if (allowed(files.config, 'configuration')) {
    const schema = path.relative(path.resolve(), getSchemaFile());

    writeFile(
      files.config,
      JSON.stringify(
        {
          $schema: schema,
          repoLink: config.repoLink,
          changelog: {
            template: '單號：{ticket}\n\n{content}',
            commitMessage:
              'chore: bump to {version}\nticket: {ticket}\nstage: {stage}',
          },
          latestInfo: {
            file: 'docs/LATEST_VERSION.md',
          },
          tags: {
            release: { pattern: 'v[0-9]+.[0-9]+.[0-9]+', changelog: true },
          },
          pr: {
            repo: config.prInfo.repo,
            template:
              'This PR is auto-generated from bumper\n- ticket: {ticket}\n- stage: {stage}\n- version: {version}\n- [diff]({diff})\n\n{content}',
          },
        },
        undefined,
        2,
      ),
    );
  }

  if (allowed(files.latestInfo, 'latest version info')) {
    writeFile(
      files.latestInfo,
      `---
version: ${changelog.latestTag?.key ?? ''}
ticket:
---
${changelog.latestTag?.body ?? ''}
`,
    );
  }

  if (allowed(files.changelog, 'changelog')) {
    writeFile(files.changelog, changelog.toString());
  }
}

function prepareFolder(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function allowed(file: string, key: string): boolean {
  const name = file.substring(path.resolve().length + 1);
  if (isDebug()) {
    info(`Debug always allowed write to ${name}`);
    return true;
  }
  if (fs.existsSync(file)) {
    console.log(`File ${name} for ${key} exist, ignore!`);
    return false;
  }
  console.log(`File ${name} for ${key} creating!`);
  return true;
}
