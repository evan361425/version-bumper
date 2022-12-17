import { expect } from 'chai';
import { Config } from '../lib/config.js';
import { mockFile } from '../lib/helper.js';
import { resetEnv, setEnv, setupEnv } from './warm-up.js';

describe('Config', function () {
  beforeEach(function () {
    resetEnv();
  });

  afterEach(function () {
    setupEnv();
  });

  it('env must overwrite config', function () {
    Object.entries({
      config: 'config',
      debug: 'debug',
      ignored: 'ignored',
      output_file: 'output_file',
      append_only: 'append_only',
      use_exact: 'use_exact',
      latest_deps: 'latest_deps',
      pre_commands: 'pre_commands',
      post_commands: 'post_commands',
      one_by_one: 'one_by_one',
      dev_pre_commands: 'dev_pre_commands',
      dev_post_commands: 'dev_post_commands',
      stage: 'stage',
      repo_link: 'repo_link',
      pr_only: 'pr_only',
      release_only: 'release_only',
      no_push: 'no_push',
      changelog_disable: 'changelog_disable',
      changelog_template: 'changelog_template',
      changelog_file: 'changelog_file',
      changelog_header: 'changelog_header',
      changelog_commit_message: 'changelog_commit_message',
      auto_link_keys: 'auto_link_keys',
      auto_link_values: 'auto_link_values',
      tag_names: 'tag_names',
      tag_patterns: 'tag_patterns',
      tag_changelogs: 'tag_changelog',
      pr_repo: 'pr_repo',
      pr_title: 'pr_title',
      pr_template: 'pr_template',
      pr_template_file: 'pr_template_file',
      branch_names: 'branch_names',
      branch_bases: 'branch_bases',
      branch_heads: 'branch_heads',
      branch_reviewers: 'branch_reviewers',
      branch_labels: 'branch_labels',
      latest_file: 'latest_file',
      latest_version: 'latest_version',
      latest_ticket: 'latest_ticket',
      latest_content: 'latest_content',
      release_pre: 'release_pre',
      release_draft: 'release_draft',
    }).forEach(([k, v]) => setEnv(k, v));

    const config = new Config({
      repoLink: 'shouldNotShow',
      prOnly: false,
      releaseOnly: false,
      noPush: false,
      changelog: {
        disable: false,
        template: 'shouldNotShow',
        header: 'shouldNotShow',
        commitMessage: 'shouldNotShow',
      },
      tags: {
        shouldNotShow: {
          pattern: 'shouldNotShow',
          changelog: false,
        },
      },
      pr: {
        repo: 'shouldNotShow',
        title: 'shouldNotShow',
        template: 'shouldNotShow',
        branches: {
          shouldNotShow: {
            head: 'shouldNotShow',
            base: 'shouldNotShow',
          },
        },
      },
      latestInfo: {
        version: 'shouldNotShow',
        ticket: 'shouldNotShow',
        content: 'shouldNotShow',
        file: 'shouldNotShow',
      },
      autoLinks: {
        autoLinkKeys: 'shouldNotShow',
      },
      deps: {
        ignored: ['shouldNotShow'],
        outputFile: 'shouldNotShow',
        appendOnly: false,
        saveExact: false,
        latestDeps: ['shouldNotShow'],
        allLatest: false,
        preCommands: ['shouldNotShow'],
        postCommands: ['shouldNotShow'],
        devInfo: {
          oneByOne: false,
          preCommands: ['shouldNotShow'],
          postCommands: ['shouldNotShow'],
        },
      },
    } as unknown as Record<string, never>);

    expect(JSON.parse(JSON.stringify(config))).to.eql({
      repoLink: 'repo_link',
      prOnly: true,
      releaseOnly: true,
      noPush: true,
      releaseInfo: {
        draft: true,
        preRelease: true,
      },
      changelogInfo: {
        disable: true,
        template: 'changelog_template',
        file: 'changelog_file',
        header: 'changelog_header',
        commitMessage: 'changelog_commit_message',
      },
      tagsInfo: {
        tag_names: {
          pattern: 'tag_patterns',
          changelog: true,
        },
      },
      prInfo: {
        repo: 'pr_repo',
        template: 'pr_template',
        title: 'pr_title',
        branches: {
          branch_names: {
            head: 'branch_heads',
            base: 'branch_bases',
            reviewers: ['branch_reviewers'],
            labels: ['branch_labels'],
            name: 'branch_names',
            siblings: {},
          },
        },
      },
      latestInfo: {
        file: 'latest_file',
        version: 'latest_version',
        ticket: 'latest_ticket',
        content: 'latest_content',
      },
      autoLinks: {
        auto_link_keys: 'auto_link_values',
      },
      deps: {
        ignored: ['ignored'],
        outputFile: 'output_file',
        appendOnly: true,
        saveExact: true,
        latestDeps: ['latest_deps'],
        allLatest: false,
        preCommands: ['pre_commands'],
        postCommands: ['post_commands'],
        devInfo: {
          oneByOne: true,
          preCommands: ['pre_commands'],
          postCommands: ['post_commands'],
        },
      },
    });
  });

  it('should response file in PR template', function () {
    setEnv('pr_template', 'some pr message');

    mockFile('pr template from file');

    const config = new Config({
      pr: {
        templateFile: 'my-file',
      },
    } as unknown as Record<string, never>);

    expect(config.prInfo.template).to.be.eq('some pr message');
  });
});
