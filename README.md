# Version Bumper

Yet, another version bumper for npm.

Features:

-   Changelog
-   Update package.json
-   Autolink for tickets (e.g. Jira)
-   GitHub PR
-   GitHub release
-   Highly flexible by configuration
-   Tiny without any dependencies

## Usage

Install it globally or in specific project.

```bash
# Globally
npm i -g @evan361425/version-bumper
# In project
npm i -D @evan361425/version-bumper
```

You can see command's details by:

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

Usually, you will need to `init` for a new project:

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
>
> You can see the schema prettier in [JSON Schema Viewer](https://json-schema.app/view/%23/%23%2Fproperties%2Fdeps?url=https%3A%2F%2Fraw.githubusercontent.com%2Fevan361425%2Fversion-bumper%2Fmaster%2Fschema.json)

You can start by `bumper init` or write it yourself, for example:

```jsonc
{
  // Please go to https://json-schema.app/view/%23/%23%2Fproperties%2Fdeps?url=https%3A%2F%2Fraw.githubusercontent.com%2Fevan361425%2Fversion-bumper%2Fmaster%2Fschema.json
  // for better description!
  "$schema": "node_modules/@evan361425/version-bumper/schema.json",
  "repoLink": "https://github.com/example/example", // default using currenct repo
  "changelog": {
    "header": "# Changelog\n\nThis is my awesome changelog.",
    "template": "ticket: {ticket}\n\n{content}",
    "commitMessage": "chore: bump to {version}\n\nticket: {ticket}\nstage: {stage}"
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
      "changelog": true, // Edit changelog and commit/push it
      "release": {
        "enable": true // GitHub Release
      }
    }
  },
  "pr": {
    "repo": "example/other-repo",
    "template": "This PR is auto-generated from bumper\n\n- ticket: {ticket}\n- stage: {stage}\n- version: {version}\n- [diff]({diff})\n\n{content}",
    "branches": {
      "develop": {
        "base": "deploy/develop",
        "head": "master"
      },
      "staging": {
        "base": "deploy/staging",
        "head": "deploy/develop",
        "labels": ["staging"],
        "reviewers": ["some-guy"]
      },
      "production": {
        "base": "deploy/production",
        "head": "deploy/staging",
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

Arguments can be sent in environment/command/file (see details in `bumper <command> -h`).

The highest priority will be the environment variables,
and the lowest priority will be the settings in configuration file.

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
