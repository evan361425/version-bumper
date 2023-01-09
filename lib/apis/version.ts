import { Changelog } from '../changelog.js';
import { BaseBranchInfo, Config, ReleaseInfo } from '../config.js';
import { gh, git, npm, writeFile } from '../helper.js';
import { error, notice } from '../logger.js';
import { Tag } from '../tag.js';

export default async function () {
  await Config.instance.init('version');

  const changelog = new Changelog(Config.instance.changelog);
  const info = Config.instance.latestInfo;
  const tag = new Tag(info.version, info.content, { ticket: info.ticket });

  let tagExist;
  try {
    changelog.addTag(tag);
  } catch (error) {
    tagExist = error;
  }

  if (Config.instance.prOnly) {
    await createPRs(tag);
    return;
  }

  if (Config.instance.releaseOnly) {
    if (Config.instance.tag) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      await doRelease(tag, Config.instance.tag!.release);
    }
    return;
  }

  if (tagExist) {
    throw tagExist;
  }

  // 如有必要，更新 Changelog
  await bump(changelog);

  // 根據 latestVersion 打 tag
  await git('tag', tag.key, '-m', tag.body);

  // 把變動（含 tag）推上去
  if (!Config.instance.noPush) {
    notice('[bump] Pushing commit and tag');
    await git('push', '--no-verify');
    await git('push', '--tag', '--no-verify');
  }

  // 建立 PR
  const success = await createPRs(tag);

  // 建立 Release
  const tagInfo = Config.instance.tag;
  if (tagInfo && tagInfo.release.enable) {
    if (!success) {
      notice('[bump] Create PR(s) failed! Stop creating GitHub release');
    } else {
      await doRelease(tag, tagInfo.release);
    }
  }
}

async function bump(changelog: Changelog) {
  const tag = changelog.latestTag;
  const stage = Config.instance.stage;
  const tagInfo = Config.instance.tag;
  if (!tag || !stage || !tagInfo) return;
  notice('[bump] Requirements checked');

  const msg = Config.instance.changelogInfo.commitMessage
    .replace(/{version}/g, tag.key ?? '')
    .replace(/{stage}/g, stage)
    .replace(/{ticket}/g, tag.ticket ?? '');

  const polluted = await git('update-index', '--refresh');
  if (polluted) await gitCommit(msg);

  if (tagInfo.changelog) {
    await npm('version', '--no-commit-hooks', '--no-git-tag-version', tag.key);

    if (!Config.instance.changelogInfo.disable) {
      notice('[bump] Start updating changelog');
      writeFile(Config.instance.changelogInfo.file, changelog.toString());
    }

    // commit both npm version and changelog
    await gitCommit(msg);

    // combine all commits
    if (polluted) {
      await git('reset', '--soft', 'HEAD~2');
      await gitCommit(msg);
    }
  }

  function gitCommit(message: string) {
    return git('commit', '.', '-m', message, '--no-verify');
  }
}

async function createPRs(tag: Tag) {
  const stage = Config.instance.stage;
  const branch = Config.instance.branch;
  if (!stage || !branch) return true;

  let success = await createPR(tag, branch);
  for await (const sibling of Object.values(branch.siblings)) {
    const s2 = await createPR(tag, sibling);
    success = s2 ? success : false;
  }

  return success;
}

async function createPR(tag: Tag, b: BaseBranchInfo) {
  const repo = Config.instance.prInfo.repo;
  const temp = Config.instance.prInfo.template;
  const title = Config.instance.prInfo.title
    .replace(/{version}/g, tag.key)
    .replace(/{ticket}/g, tag.ticket ?? '')
    .replace(/{stage}/g, b.name);
  const body = Changelog.fitAutoLinks(
    temp
      .replace(/{stage}/g, b.name)
      .replace(/{ticket}/g, tag.ticket ?? '')
      .replace(/{version}/g, tag.key)
      .replace(/{content}/g, tag.toString())
      .replace(/{diff}/g, tag.link ?? '')
      .concat(`\n\n${tag.toLink()}`),
    Config.instance.autoLinks,
  );

  notice(`[pr] Creating branch ${b.name} in ${repo} (${b.head} -> ${b.base})`);

  // https://cli.github.com/manual/gh_pr_create
  try {
    await gh(
      'pr',
      'create',
      '--title',
      title,
      '--body',
      body,
      '--assignee',
      '@me',
      '--base',
      b.base,
      '--head',
      b.head,
      '--repo',
      Config.instance.prInfo.repo,
      ...b.reviewers.map((reviewer) => ['--reviewer', reviewer]).flat(),
      ...(b.labels.map((label) => ['--label', label]).flat() ?? []),
    );
    return true;
  } catch (e) {
    error(`${e}`);
    return false;
  }
}

function doRelease(tag: Tag, config: ReleaseInfo) {
  const args = [
    'create',
    tag.key,
    '--title',
    config.title ?? tag.key,
    `--prerelease=${config.preRelease}`,
    `--draft=${config.draft}`,
    '--notes',
    tag.bodyWithAutoLinks,
  ];

  notice(`[bump] Creating GitHub release ${config.title ?? tag.key}`);

  // https://cli.github.com/manual/gh_release_create
  return gh('release', ...args);
}
