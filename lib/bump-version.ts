import { Changelog } from './changelog.js';
import { Config } from './config.js';
import { gh, git, npm, writeFile } from './helper.js';
import { info } from './logger.js';
import { Tag } from './tag.js';

export default async function () {
  await Config.instance.init();

  const changelog = new Changelog(Config.instance.changelog);
  const info = Config.instance.latestInfo;
  const tag = new Tag(info.version, info.body, { ticket: info.ticket });
  changelog.addTag(tag);

  if (Config.instance.prOnly) {
    return await createPRs(tag);
  }

  // TODO: verify tag version

  await bump(changelog);

  await git('tag', tag.key, '-m', tag.parsedBody);

  const changed = await git(
    'log',
    '-q',
    `origin/${Config.instance.baseBranch}..HEAD`
  );
  changed && (await git('push', '--no-verify'));

  await git('push', '--tag', '--no-verify');

  await createPRs(tag);
}

async function bump(changelog: Changelog) {
  const tag = changelog.latestTag;
  if (!tag) return;

  const msg = Config.instance.commitMessage
    .replace(/<version>/g, tag.key ?? '')
    .replace(/<stage>/g, Config.instance.stage)
    .replace(/<ticket>/g, tag.ticket ?? '');

  const polluted = await git('update-index', '--refresh');
  if (polluted) {
    await gitCommit(
      Config.instance.isProduction ? `internal(${tag.key}): prepared` : msg
    );
  }

  if (Config.instance.isNotProduction) {
    return;
  }

  info('[prod] Start updating packages');
  await npm('version', '--no-commit-hooks', '--no-git-tag-version', tag.key);

  if (!Config.instance.changelogInfo.disable) {
    info('[prod] Start updating changelog');
    writeFile(Config.instance.files.changelog, changelog.toString());
  }

  // commit
  await gitCommit(`internal(${tag.key}): edit changelog`);

  // rebase changelog and package commit
  await git('reset', '--soft', polluted ? 'HEAD~2' : 'HEAD~1');

  await gitCommit(msg);

  function gitCommit(message: string) {
    return git('commit', '.', '-m', message, '--no-verify');
  }
}

async function createPRs(tag: Tag) {
  await createPR(tag, Config.instance.stage);
  if (Config.instance.isProduction && Config.instance.prodOtherPr) {
    await createPR(tag, Config.instance.prodOtherPr);
  }
}

async function createPR(tag: Tag, stage: string) {
  const temp = Config.instance.prTemplate;
  const body = temp
    .replace(/<ticket>/g, tag.ticket ?? '')
    .replace(/<stage>/g, stage)
    .replace(/<version>/g, tag.key)
    .replace(/<content>/g, tag.toString())
    .replace(/<diff>/g, tag.link ?? '')
    .concat(`\n\n${tag.toLink()}`);
  info(`[pr] body: ${body}`);

  const branch = Config.instance.branchBy(stage);

  info(
    `[pr] Creating in ${Config.instance.prRepo}(${stage}) ${branch.base} -> ${branch.head}`
  );

  // https://cli.github.com/manual/gh_pr_create
  return gh(
    'pr',
    'create',
    '--title',
    tag.prTitle,
    '--body',
    body,
    '--assignee',
    '@me',
    '--base',
    branch.base,
    '--head',
    branch.head,
    '--repo',
    Config.instance.prRepo,
    ...branch.reviewers.map((reviewer) => ['--reviewer', reviewer]).flat(),
    ...(branch.labels.map((label) => ['--label', label]).flat() ?? [])
  );
}
