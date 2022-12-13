import { expect } from 'chai';
import { Config } from '../lib/config.js';
import { resetEnv, setEnv, setupEnv } from './warm-up.js';

describe('Config', function () {
  it('env must overwrite config', function () {
    resetEnv();
    Object.entries({
      config: 'config',
      debug: 'debug',
      ignored: 'ignored',
      output: 'output',
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
      commit_message: 'commit_message',
      commit_no_push: 'commit_no_push',
      changelog_disable: 'changelog_disable',
      changelog_ticket_prefix: 'changelog_ticket_prefix',
      changelog_header: 'changelog_header',
      file_changelog: 'file_changelog',
      file_latest_version: 'file_latest_version',
      file_pr_template: 'file_pr_template',
      auto_link_keys: 'auto_link_keys',
      auto_link_values: 'auto_link_values',
      tag_names: 'tag_names',
      tag_patterns: 'tag_patterns',
      tag_changelogs: 'tag_changelog',
      pr_repo: 'pr_repo',
      branch_names: 'branch_names',
      branch_bases: 'branch_bases',
      branch_heads: 'branch_heads',
      branch_reviewers: 'branch_reviewers',
      branch_labels: 'branch_labels',
      latest_version: 'latest_version',
      latest_ticket: 'latest_ticket',
      latest_content: 'latest_content',
    }).forEach(([k, v]) => setEnv(k, v));

    const config = new Config({
      repoLink: 'shouldNotShow',
      prOnly: false,
      releaseOnly: false,
      commit: {
        noPush: false,
        message: 'shouldNotShow',
      },
      changelog: {
        disable: false,
        ticketPrefix: 'shouldNotShow',
        header: 'shouldNotShow',
      },
      files: {
        changelog: 'shouldNotShow',
        latestVersion: 'shouldNotShow',
        prTemplate: 'shouldNotShow',
      },
      tags: {
        shouldNotShow: {
          pattern: 'shouldNotShow',
          changelog: false,
        },
      },
      pr: {
        repo: 'shouldNotShow',
        branches: {
          shouldNotShow: {
            head: 'shouldNotShow',
            base: 'shouldNotShow',
          },
        },
      },
      latestVersion: 'shouldNotShow',
      latestTicket: 'shouldNotShow',
      latestBody: 'shouldNotShow',
      autoLinks: {
        autoLinkKeys: 'shouldNotShow',
      },
      deps: {
        ignored: ['shouldNotShow'],
        output: 'shouldNotShow',
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
      commitInfo: {
        noPush: true,
        message: 'commit_message',
      },
      changelogInfo: {
        disable: true,
        ticketPrefix: 'changelog_ticket_prefix',
        header: 'changelog_header',
      },
      files: {
        changelog: 'file_changelog',
        latestVersion: 'file_latest_version',
        prTemplate: 'file_pr_template',
      },
      tagsInfo: {
        tag_names: {
          pattern: 'tag_patterns',
          changelog: true,
        },
      },
      prInfo: {
        repo: 'pr_repo',
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
        version: 'latest_version',
        ticket: 'latest_ticket',
        body: 'latest_content',
      },
      autoLinks: {
        auto_link_keys: 'auto_link_values',
      },
      deps: {
        ignored: ['ignored'],
        output: 'output',
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

    setupEnv();
  });
});
