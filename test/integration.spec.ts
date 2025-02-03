import assert from 'node:assert';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, afterEach, describe, it } from 'node:test';
import { getFirstMockedCommand, mockCommandResponse, resetMocked } from '../lib/command.js';
import { loadConfigFromArgs } from '../lib/config-loader.js';
import { Config } from '../lib/config.js';
import { mockAskContent, startDebug, startVerbose } from '../lib/io.js';
import { bump, checkTag, createPR, createRelease, prepare } from '../lib/processes.js';

void describe('Bump', function () {
  const dir = mkdtempSync(join(tmpdir(), 'version-bump-test-'));

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });
  afterEach(() => {
    resetMocked();
  });

  void it('all process', async function () {
    const clogFile = join(dir, 'CHANGELOG.md');
    const cfg = new Config(
      {
        repo: {
          link: 'https://github.com/evan361425/version-bumper-1',
        },
        changelog: {
          destinationDebug: clogFile,
        },
        process: {
          askToVerifyContent: true,
        },
        diff: {
          scopeNames: { scope: 'Scope' },
        },
      },
      loadConfigFromArgs([
        `--diff-ignored[]=CHORE`,
        `--diff-scope[]=scope=ScopeOverride`,
        `--tag[]name=semantic`,
        `--tag[]pr[]repo=evan361425/version-bumper-2`,
        `--tag[]pr[]head=temp-{name}`,
        `--tag[]pr[]base=main`,
        `--tag[]pr[]labels[]=label-1`,
        `--tag[]pr[]labels[]=label-2`,
        `--tag[]pr[]reviewers[]=user-1`,
        `--tag[]pr[]reviewers[]=user-2`,
        `--tag[]pr[]commit-v`,
        `custom bump to {version}`,
        `--tag[]pr[]repl[]pattern=version: v[0-9]+.[0-9]+.[0-9]+$`,
        `--tag[]pr[]repl[]paths[]`,
        'package.json',
        `--tag[]pr[]repl[]paths[]=other.txt`,
        `--tag[]pr[]repl[]repl-v=version: {version}`,
        `--autolink[]link=test-link-{num}`,
        `--autolink[]match[]=ABC-{num}`,
      ]),
    );

    startDebug();
    startVerbose();

    mockAskContent('v1.2.3');
    mockCommandResponse('v1.2.2');
    await cfg.init([`-t=666`]);

    assert.strictEqual(cfg.version, 'v1.2.3');
    assert.strictEqual(cfg.ticket, '666');
    assert.strictEqual(cfg.versionLast, 'v1.2.2');
    assert.strictEqual(cfg.repo.link, 'https://github.com/evan361425/version-bumper-1');
    assert.strictEqual(cfg.diff.ignored[0], 'CHORE');
    assert.deepStrictEqual(cfg.diff.scopeNames, { scope: 'ScopeOverride' });
    assert.strictEqual(cfg.changelog.destinationDebug, clogFile);
    assert.strictEqual(cfg.process.askToVerifyContent, true);
    assert.deepStrictEqual(cfg.autoLinks[0]?.matches, ['ABC-{num}']);
    assert.deepStrictEqual(cfg.autoLinks[0]?.link, 'test-link-{num}');
    const pr = cfg.tag.prs[0]!;
    assert.strictEqual(pr.repo, 'evan361425/version-bumper-2');
    assert.strictEqual(pr.head, 'temp-semantic');
    assert.strictEqual(pr.base, 'main');
    assert.deepStrictEqual(pr.labels, ['label-1', 'label-2']);
    assert.deepStrictEqual(pr.reviewers, ['user-1', 'user-2']);
    assert.deepStrictEqual(pr.reviewers, ['user-1', 'user-2']);
    assert.strictEqual(pr.commitMessage?.value, 'custom bump to {version}');
    assert.strictEqual(pr.replacements[0]!.pattern, 'version: v[0-9]+.[0-9]+.[0-9]+$');
    assert.deepStrictEqual(pr.replacements[0]!.paths, ['package.json', 'other.txt']);
    assert.strictEqual(pr.replacements[0]!.replacement.value, 'version: {version}');

    await checkTag(cfg);
    assert.strictEqual(getFirstMockedCommand(), 'git tag --list --sort=-v:refname');
    assert.strictEqual(getFirstMockedCommand(), 'git tag -l v1.2.3');

    mockAskContent('y');
    mockCommandResponse(
      [
        'hash1hash1hash1hash1 wu0dj2k7ao3 fix(ABC-123): should update auto link',
        'hash2hash2hash2hash2 wu0dj2k7ao3 fix(test)!: breaking  change with pr #123',
        'hash3hash3hash3hash3 wu0dj2k7ao3 add(scope): some scope and auto link ABC-123',
        'hash4hash4hash4hash4 wu0dj2k7ao3 feat: simple feature (#124)',
        'hash5hash5hash5hash5 wu0dj2k7ao3 no any match should be ignored',
        'hash5hash6hash6hash6 wu0dj2k7ao3 fix: specific ignoring CHORE',
      ].join('\n'),
    );
    await prepare(cfg);
    assert.strictEqual(getFirstMockedCommand(), 'git log --pretty=%H %al %s HEAD...v1.2.2');

    const today = new Date().toISOString().split('T')[0];
    await bump(cfg);
    assert.strictEqual(getFirstMockedCommand(), 'git add .');
    assert.strictEqual(getFirstMockedCommand(), 'git commit -m chore: bump to v1.2.3');
    assert.strictEqual(
      getFirstMockedCommand(),
      `git tag v1.2.3 -m [v1.2.3] - ${today}

### Fixed

- (hash1ha|ABC-123) should update auto link - @wu0dj2k7ao3
- (123) test: breaking change with pr - @wu0dj2k7ao3

### Added

- (hash3ha|ABC-123) ScopeOverride: some scope and auto link - @wu0dj2k7ao3
- (124) simple feature - @wu0dj2k7ao3`,
    );
    assert.strictEqual(getFirstMockedCommand(), 'git push --no-verify');
    assert.strictEqual(getFirstMockedCommand(), 'git push --tags --no-verify');

    mockCommandResponse('base-sha ');
    mockCommandResponse(Buffer.from('content1\nversion: v1.2.2\nabc').toString('base64'));
    mockCommandResponse(Buffer.from('content2\nversion: v1.2.2\ndef').toString('base64'));
    mockCommandResponse('file-sha1\n');
    mockCommandResponse('\nfile-sha2\n');
    mockCommandResponse('\nnew-sha');
    await createPR(cfg);

    const content = `### Fixed

- ([hash1ha](https://github.com/evan361425/version-bumper-1/commit/hash1hash1hash1hash1)|[ABC-123](test-link-123)) should update auto link - @wu0dj2k7ao3
- ([123](https://github.com/evan361425/version-bumper-1/pull/123)) test: breaking change with pr - @wu0dj2k7ao3

### Added

- ([hash3ha](https://github.com/evan361425/version-bumper-1/commit/hash3hash3hash3hash3)|[ABC-123](test-link-123)) ScopeOverride: some scope and auto link - @wu0dj2k7ao3
- ([124](https://github.com/evan361425/version-bumper-1/pull/124)) simple feature - @wu0dj2k7ao3`;
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api repos/evan361425/version-bumper-2/git/refs/heads/temp-semantic --jq .object.sha',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api repos/evan361425/version-bumper-2/contents/package.json?ref=temp-semantic --jq .content',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api repos/evan361425/version-bumper-2/contents/other.txt?ref=temp-semantic --jq .content',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api -X POST repos/evan361425/version-bumper-2/git/blobs -f content=' +
        Buffer.from('content1\nversion: v1.2.3\nabc').toString('base64') +
        ' -f encoding=base64 --jq .sha',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api -X POST repos/evan361425/version-bumper-2/git/blobs -f content=' +
        Buffer.from('content2\nversion: v1.2.3\ndef').toString('base64') +
        ' -f encoding=base64 --jq .sha',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      'gh api -X POST repos/evan361425/version-bumper-2/git/trees -f base_tree=base-sha ' +
        '-f tree[][path]=package.json -f tree[][mode]=100644 -f tree[][type]=blob -f tree[][sha]=file-sha1 ' +
        '-f tree[][path]=other.txt -f tree[][mode]=100644 -f tree[][type]=blob -f tree[][sha]=file-sha2 --jq .sha',
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      "gh api -X POST repos/evan361425/version-bumper-2/git/commits -f message='custom bump to v1.2.3' -f tree=new-sha -f parents[]=base-sha --jq .sha",
    );
    assert.strictEqual(
      getFirstMockedCommand(),
      `gh pr create --title 666 - New semantic version v1.2.3 --body This PR is auto-generated from bumper

- ticket: 666
- name: semantic
- version: v1.2.3
- [diff link](https://github.com/evan361425/version-bumper-1/compare/v1.2.2...v1.2.3)

${content}
 --assignee @me --base main --head temp-semantic --repo evan361425/version-bumper-2 --reviewer user-1 --reviewer user-2 --label label-1 --label label-2`,
    );

    await createRelease(cfg);
    assert.strictEqual(
      getFirstMockedCommand(),
      `gh release create v1.2.3 --title v1.2.3 --prerelease=false --draft=false --notes Ticket: 666

${content}`,
    );
  });

  void it('no ticket', async function () {
    const cfg = new Config(
      {
        repo: { link: 'https://github.com/a/b' },
        process: {
          askToVerifyContent: false,
        },
        changelog: { enable: false },
      },
      loadConfigFromArgs([`--tag[]name=semantic`, `--tag[]pr[]base=deploy`]),
    );

    startDebug();
    startVerbose();

    mockAskContent('v1.2.3');
    mockCommandResponse('v1.2.2');
    await cfg.init([]);

    assert.strictEqual(cfg.ticket, '');
    assert.strictEqual(cfg.tag.prs[0]!.commitMessage?.value, 'chore: bump to {version}');

    await checkTag(cfg);
    await prepare(cfg);
    await bump(cfg);
    await createPR(cfg);

    const mockedCommand = resetMocked()[1];
    assert.deepStrictEqual(mockedCommand?.slice(0, 3), [
      'git tag --list --sort=-v:refname',
      'git tag -l v1.2.3',
      'git log --pretty=%H %al %s HEAD...v1.2.2',
    ]);
    assert.deepStrictEqual(mockedCommand?.slice(4), [
      'git push --tags --no-verify',
      'gh pr create --title New semantic version v1.2.3 --body This PR is auto-generated from bumper\n' +
        '\n' +
        '- name: semantic\n' +
        '- version: v1.2.3\n' +
        '- [diff link](https://github.com/a/b/compare/v1.2.2...v1.2.3)\n' +
        '\n' +
        'No commits found.\n' +
        ' --assignee @me --base deploy --head main --repo a/b',
    ]);
  });
});
