# Version Bumper

Yet, another helper for bumping version.

Features:

- Collect commits and build Changelog
- Hooking: before, after commit scripts
- Autolink for tickets (e.g. Jira)
- GitHub PR, allow update files and create branch
- GitHub release
- Highly flexible by configuration and power template on variables
- Tiny without any dependencies

## Usage

Install it globally or in specific project.

```bash
# Globally
npm i -g @evan361425/version-bumper
# In project
npm i -D @evan361425/version-bumper
```

This package require GitHub command tools `gh`,
see [installation document](https://github.com/cli/cli?tab=readme-ov-file#installation).

<details>
<summary>Help message</summary>

```bash
$ bumper help
Usage: (npx) bumper <command|$tag> [args]
Commands
        version Show latest version of this package
        help    Show this message
        $tag    Specific version to bump

Args:
        --help,-h    Show available arguments
        --version,-V Show versio
```

</details>

Bump [semantic version](https://semver.org/) is extremely easy:

```bash
$ bumper
Enter new semantic version (last version is v1.1.4) with pattern: v[0-9]+\.[0-9]+\.[0-9]+
```

Or release candidate format:

```bash
# or bumper --rc-tag -T release-candidate
$ bumper --rc-tag --no-semantic-tag
Enter new release-candidate version (last version is v1.1.4-rc.1) with pattern: v[0-9]+\.[0-9]+\.[0-9]+-rc\.[0-9]+
```

Other patterns tag can easily setup by configuration file or command arguments.

### Config File

Read specific config by setting `--config,-c` (default is `bumper.json`).

> [!Note]
>
> The JSON file is follow the [./schema.json](schema.json)'s schema.
>
> You can see the schema prettier in [JSON Schema Viewer](https://json-schema.app/view/%23/%23%2Fproperties%2Fdeps?url=https%3A%2F%2Fraw.githubusercontent.com%2Fevan361425%2Fversion-bumper%2Fmaster%2Fschema.json)

Here is an example of setting calendar version:

```json
{
  "tags": [
    {
      "name": "calendar",
      "pattern": "\\d\\d\\.(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\\.\\d+",
      "sort": {
        "separator": ".",
        "fields": [
          "1,1",
          "2,2M",
          "3,3"
        ],
      }
    }
  ]
}
```

### Args

Add `-h/--help` to get information on command:

```bash
$ bumper tag -h | less
Usage: (npx) bumper <$tag> [args]
If no version given in first arg, it will ask for it
Args:
...
```

### Priority

Arguments can be sent in command and file.

The highest priority will be arguments,
and the lowest priority will be the default settings in code.

```txt
Command > Configuration file > Default
```

## Use Cases

### Change files in other repo and create PR

Create PR by creating new branch `temp-{name}` from `master`
and changing files `file1.txt`, `file2.txt` to base branch `master`.

```bash
bumper \
  --pr-only
  --tag[]name=semantic \
  --tag[]pr[]repo=evan361425/version-bumper-deploy \
  --tag[]pr[]head=temp-{name} \
  --tag[]pr[]head-from=master \
  --tag[]pr[]base=master \
  --tag[]pr[]repl[]pattern='version: v\d+\.\d+\.\d+$' \
  --tag[]pr[]repl[]paths[]='file1.txt' \
  --tag[]pr[]repl[]paths[]='file2.txt' \
  --tag[]pr[]repl[]repl-v='version: {version}'
```

### Create PR only (usually re-create)

```bash
bumper \
  --pr-only
  --tag[]name=semantic \
  --tag[]pr[]repo=evan361425/version-bumper-deploy \
  --tag[]pr[]head=master \
  --tag[]pr[]base=deploy \
  --tag[]pr[]labels[]=label-1 \
  --tag[]pr[]reviewers[]=user-1
```

## Changelog

Changelog default using [keep a changelog](https://keepachangelog.com/en/1.0.0/) format
and commit follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format.

Here are some example commits.

```text
fix(ABC-123): should update auto link
fix(test)!: breaking  change with pr #123
add(scope): some scope and auto link ABC-123
feat: simple feature
no any match should be ignored
fix: specific ignoring CHORE
```

and if we bump from v1.2.3 to v2.0.0, it will (default, and configurable) render as:

```bash
$ bumper \
  v2.0.0 \
  --autolink[]link 'https://jira-domain.com/{value}' \
  --autolink[]match[]='ABC-{num}' \
  --diff-ignored[]=CHORE \
  --diff-scope[]=scope=ScopeName \
  --ask-to-verify-content
====== Content is in below:
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

See git diff

## [v2.0.0] - 2024-01-01

### Fixed

- ([hash1ha](https://github.com/evan361425/version-bumper/commit/hash1hash1hash1hash1)|[ABC-123](https://jira-domain.com/ABC-123)) should update auto link - @wu0dj2k7ao3
- ([hash2ha](https://github.com/evan361425/version-bumper/commit/hash2hash2hash2hash2)) test: breaking change with pr - @wu0dj2k7ao3

### Added

- ([hash3ha](https://github.com/evan361425/version-bumper/commit/hash3hash3hash3hash3)|[ABC-123](https://jira-domain.com/ABC-123)) ScopeName: some scope and auto link - @wu0dj2k7ao3
- ([hash4ha](https://github.com/evan361425/version-bumper/commit/hash4hash4hash4hash4)) simple feature - @wu0dj2k7ao3

## [v1.2.3] - 2023-12-31

...

[unreleased]: https://github.com/olivierlacan/keep-a-changelog/compare/v2.0.0...HEAD
[v2.0.0]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.2.3...v2.0.0
[v1.2.3]: https://github.com/olivierlacan/keep-a-changelog/compare/v1.2.2...v1.2.3
...
[0.0.1]: https://github.com/olivierlacan/keep-a-changelog/releases/tag/v0.0.1
====== Is this OK? [Y/n]
```
