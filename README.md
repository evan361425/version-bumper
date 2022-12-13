# Version Bumper

Yet, another version bumper for npm.

Features:

-   Changelog
-   Autolink for tickets (e.g. Jira)
-   GitHub PR
-   GitHub release
-   Small without any dependencies

## Usage

Install it globally.

```bash
npm i -g @evan361425/version-bumper
```

You can see how to play with bumper by:

```bash
$ bumper help
Usage: (npx) bumper <command> [args]
Commands
        version 更新版本
        deps    更新套件
        help    顯示此訊息
        init    初始化專案

Args:
        -h, --help 顯示相關 Command 的 Args
```

Usually you should start it by `init` it!

```bash
$ bumper init
File bumper.json for configuration creating!
File docs/LATEST_VERSION.md for latest version info creating!
File CHANGELOG.md for changelog creating!
File docs/PR_TEMPLATE.md for PR template creating!
```

### Args

Add `-h/--help` to get information on command:

```bash
$ bumper deps --help
Usage: (npx) bumper deps [args]
Args:
...
```

## Configuration

You should use `./bumper.json` on the project root folder, else set in the command arguments.

> The JSON file is follow the [./schema.json](schema.json)'s schema.
