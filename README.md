# Version Bumper

Yet, another version bumper for npm.

Features:

-   Changelog
-   Autolink for tickets (e.g. Jira)
-   GitHub PR
-   GitHub release
-   Configuration
-   Small without any dependencies

## Usage

Install it globally or in specific project.

```bash
# Globally
npm i -g @evan361425/version-bumper
# In project
npm i -D @evan361425/version-bumper
```

You can see how to play with bumper by:

```bash
$ bumper help
Usage: (npx) bumper <command> [args]
Commands
        version Update the version of NPM project
        deps    Update dependencies with hooking
        help    Show this message
        init    Setup configuration files

Args:
        -h, --help Show command's arguments
        -v, --version version info
```

Usually you will use `init` for a new project:

```bash
$ bumper init
File bumper.json for configuration creating!
File docs/LATEST_VERSION.md for latest version info creating!
File CHANGELOG.md for changelog creating!
```

### Args

Add `-h/--help` to get information on command:

```bash
$ bumper deps -h | less
Usage: (npx) bumper deps [args]
Args:
...
```

## Configuration

You should add `./bumper.json` on the project root folder, else set it by the arguments.

> The JSON file is follow the [./schema.json](schema.json)'s schema.
> After `bumper init`, you should automatically bind to the schema.

You can start by `bumper init` or write it yourself, for example:

```json
{
  "$schema": "node_modules/@evan361425/version-bumper/schema.json",
  "repoLink": "https://github.com/example/example",
  "changelog": {
    "header": "# Changelog\nThis is my awesome changelog.",
    "template": "ticket: {ticket}\n\n{content}",
    "commitMessage": "chore: bump to {version}\nticket: {ticket}\nstage: {stage}"
  },
  "tags": {
    "develop": {
      "pattern": "beta\\d+"
    },
    "staging": {
      "pattern": "v[0-9]+.[0-9]+.[0-9]+-rc\\d+"
    },
    "production": {
      "pattern": "v[0-9]+.[0-9]+.[0-9]+",
      "changelog": true
    }
  },
  "pr": {
    "repo": "example/other-repo",
    "template": "This PR is auto-generated from bumper\n- ticket: {ticket}\n- stage: {stage}\n- version: {version}\n- [diff]({diff})\n\n{content}",
    "branches": {
      "develop": {
        "base": "main",
        "head": "deploy/develop"
      },
      "staging": {
        "base": "deploy/develop",
        "head": "deploy/staging",
        "labels": ["staging"]
      },
      "production": {
        "base": "deploy/staging",
        "head": "deploy/production",
        "labels": ["production"],
        "siblings": {
          "dr": {
            "head": "deploy/dr",
            "labels": ["dr"]
          }
        }
      }
    }
  },
  "deps": {
    "latestDeps": ["*"],
    "postCommands": [
      "npm run test",
      "git add package.json package-lock.json",
      ["git", "commit", "-m", "chore: bump {name} to {target}\n\nOrigin: {current}"]
    ],
    "ignored": ["some-package", "dev-package"],
    "appendOnly": true,
    "useExact": true,
    "output": "docs/LATEST_UPGRADE.md",
    "dev": {
      "postCommands": [
        "npm run test",
        "git add package.json package-lock.json",
        ["git", "commit", "-m", "chore(dev): bump dev-deps"]
      ]
    }
  }
}
```

### Priority

Arguments can be sent in environment/command/file (detail in `bumper <command> -h`),
and the highest priority will be the environment variables.

The lowest priority will be argument in config file.

```txt
Env > Command > Configuration file
```

## Changelog

Changelog using bellow format:

```text
{changelog.header}

- [Unreleased]

Please check git diff.

- [{tag1}] - {date1}

{template}

- [{tag2}] - {date2}

{template}

[unreleased]: {diff}
[{tag1}]: {diff1}
[{tag2}]: {diff2}
```

Set the format by `--changelogTemplate` or `changelog.template` in configuration, for example:

```text
- ticket: {ticket}
- version: {version}
- stage: {stage}
- [diff]({diff})

{content}
```
