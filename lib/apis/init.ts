import path from 'node:path';
import fs from 'node:fs';
import { Config } from '../config.js';
import { isDebug } from '../helper.js';
import { Changelog } from '../changelog.js';

export default async function () {
  const config = new Config({});
  Config.instance = config;
  const files = {
    config: path.resolve('bumper.json'),
    changelog: path.resolve(config.files.changelog),
    prTemplate: path.resolve(config.files.prTemplate),
    latestVersion: path.resolve(config.files.latestVersion),
  };
  Object.values(files).forEach(prepareFolder);

  await config.init();
  const changelog = new Changelog(Config.instance.changelog);

  if (allowed(files.config, 'configuration')) {
    const currFile = import.meta.url.replace(/^file:/, '');
    const schema = path.relative(
      path.resolve(),
      path.join(currFile, '..', '..', '..', 'schema.json')
    );

    writeTo(
      files.config,
      JSON.stringify(
        {
          $schema: schema,
          repoLink: config.repoLink,
          commit: { message: config.commitInfo.message },
          tags: {
            release: { pattern: 'v[0-9]+.[0-9]+.[0-9]+', changelog: true },
          },
          pr: { repo: config.prInfo.repo },
        },
        undefined,
        2
      )
    );
  }

  if (allowed(files.latestVersion, 'latest version info file')) {
    writeTo(
      files.latestVersion,
      `---
version: ${changelog.latestTag?.key ?? ''} 
ticket:
---
${changelog.latestTag?.body ?? ''}
`
    );
  }

  if (allowed(files.changelog, 'changelog')) {
    writeTo(files.changelog, changelog.toString());
  }

  if (allowed(files.prTemplate, 'PR template')) {
    writeTo(files.prTemplate, config.prTemplate);
  }
}

function prepareFolder(file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function allowed(file: string, key: string): boolean {
  const name = file.substring(path.resolve().length + 1);
  if (isDebug()) {
    console.log(`Debug always allowed write to ${name}`);
    return true;
  }
  if (fs.existsSync(file)) {
    console.log(`File ${name} for ${key} exist, ignore!`);
    return false;
  }
  return true;
}

function writeTo(file: string, data: string) {
  if (isDebug()) {
    console.log(data);
    return;
  }
  fs.writeFileSync(file, data);
}
