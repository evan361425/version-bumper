# Changelog

所有本專案的版本紀錄將於此說明之。

文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 內所描述的格式撰寫，版本號碼依照 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

Please check git diff.

## [v0.9.2] - 2023-02-10

-   ([0112292](https://github.com/evan361425/version-bumper/commit/0112292dd9ac9239a09f0e407a5fe5b8f150acbb)) fix: throw error if execute script failed - Shueh Chou Lu
-   ([04e515d](https://github.com/evan361425/version-bumper/commit/04e515dc6d81e893bff61fea7e2b0d3c8ee22bfd)) ci: test on PR - Shueh Chou Lu

## [v0.9.1] - 2023-01-31

-   ([20fc285](https://github.com/evan361425/version-bumper/commit/20fc285740b561fedac542ead43726d602936c9c)) fix: show error msg when execute scripts - Shueh Chou Lu

## [v0.9.0] - 2023-01-31

-   ([73ede1f](https://github.com/evan361425/version-bumper/commit/73ede1f92a164229152a9cb0f80310add6904b66)) fix: reject command when return non-zero code - Shueh Chou Lu
-   ([ee0f0ee](https://github.com/evan361425/version-bumper/commit/ee0f0ee8e9f289547c7130d237e8a3ce94f92b83)) fix: default using false on packageJson - Shueh Chou Lu
-   ([0b002e4](https://github.com/evan361425/version-bumper/commit/0b002e456e81753e3ffe4ce234077396e58c916a)) fix: log tag info when bumping - Shueh Chou Lu

## [v0.8.1] - 2023-01-31

-   ([feb50b1](https://github.com/evan361425/version-bumper/commit/feb50b1866c15758decd15ad5deea700b99ad31f)) feat: add tag and content var for script - Shueh Chou Lu

## [v0.8.0] - 2023-01-31

-   ([6843b1c](https://github.com/evan361425/version-bumper/commit/6843b1c0b96c5823cd5d2d3b35a2273156897442)) feat: add before scripts for bumping - Shueh Chou Lu
-   ([e9c789a](https://github.com/evan361425/version-bumper/commit/e9c789a19c746142749afd135e476d28182201b5)) feat: add alias on verbose and debug - Shueh Chou Lu

## [v0.7.1] - 2023-01-09

-   ([59a6446](https://github.com/evan361425/version-bumper/commit/59a6446d880c115da5eed0f9048c233dc0786f40)) feat: allow disable package.json bumping - Shueh Chou Lu

## [v0.7.0] - 2023-01-09

-   ([2bc2888](https://github.com/evan361425/version-bumper/commit/2bc2888ca7f64d2c20e0ae0c739aac3bebd15ac0)) fix: release config in tag - Shueh Chou Lu

## [v0.6.0] - 2022-12-27

-   ([9952134](https://github.com/evan361425/version-bumper/commit/995213488a9c47288753cbad59346505f6269160)) feat: allow disable github release - Shueh Chou Lu
-   ([09174db](https://github.com/evan361425/version-bumper/commit/09174dbf51fa0b89677833afa45b261c228be17a)) feat: show latest version - Shueh Chou Lu

## [v0.5.3] - 2022-12-27

-   ([2dbbb3f](https://github.com/evan361425/version-bumper/commit/2dbbb3f78a0c4ea287ecf2f95d6f704e2a54ba6e)) fix: add autolink in template ticket - Shueh Chou Lu

## [v0.5.2] - 2022-12-21

-   ([01a9498](https://github.com/evan361425/version-bumper/commit/01a9498740ea922d406971f69fa0e12179a80712)) fix: correct default commit message - Shueh Chou Lu

## [v0.5.1] - 2022-12-20

-   ([4ecfc37](https://github.com/evan361425/version-bumper/commit/4ecfc37ef8fb556bf4315b85dd3098455336e9c4)) fix: wrong diff link - Shueh Chou Lu
-   ([570a8cb](https://github.com/evan361425/version-bumper/commit/570a8cb9abbfc18fedfce116d2b796a17291c630)) fix: add hash link - Shueh Chou Lu
-   ([f7e1b59](https://github.com/evan361425/version-bumper/commit/f7e1b59d5167b5e51b384bf774103a67e238f4d9)) fix: respect commit message in changelog - Shueh Chou Lu
-   ([400ba0f](https://github.com/evan361425/version-bumper/commit/400ba0fd9dc4a6b5e3b76597823fb0e83739aeaa)) feat: allow using diff for latest info - Shueh Chou Lu

## [v0.5.0] - 2022-12-19

-   ([400ba0f](https://github.com/evan361425/version-bumper/commit/400ba0fd9dc4a6b5e3b76597823fb0e83739aeaa)) feat: allow using diff for latest info - Shueh Chou Lu
-   ([f7e1b59](https://github.com/evan361425/version-bumper/commit/f7e1b59d5167b5e51b384bf774103a67e238f4d9)) fix: respect commit message in changelog - Shueh Chou Lu

## [v0.4.5] - 2022-12-18

-   fix: add auto-links on PR body

## [v0.4.4] - 2022-12-17

-   fix: schema.json missing cli name
-   Fix: make pr template higher procedure in args

## [v0.4.3] - 2022-12-16

-   fix: auto-links using `{num}` instead of `<num>`

## [v0.4.2] - 2022-12-15

-   feat: add PR title in configuration

## [v0.4.1] - 2022-12-15

-   fix: config should respect pr template from file

## [v0.4.0] - 2022-12-15

-   refactor: rename api's name
-   fix: schema title on PR base/head is wrong

## [v0.3.0] - 2022-12-14

-   Changing configuration format for more intuitive structure.

## [v0.2.5] - 2022-12-14

-   feat: add `--verbose` to get noisy output with actual process.
-   feat: `deps` now send data to stdout if no `deps.output` setup.

## [v0.2.4] - 2022-12-13

-   fix: use relative path for getting version

## [v0.2.3] - 2022-12-13

-   fix: correct version command

## [v0.2.2] - 2022-12-13

-   fit: add links on deps

## [v0.2.1] - 2022-12-13

-   feat: allow setting draft

## [v0.2.0] - 2022-12-13

-   feat: allow bump dependencies

## [v0.1.0] - 2022-12-12

Initialize Release

[unreleased]: https://github.com/evan361425/version-bumper/compare/v0.9.2...HEAD
[v0.9.2]: https://github.com/evan361425/version-bumper/compare/v0.9.1...v0.9.2
[v0.9.1]: https://github.com/evan361425/version-bumper/compare/v0.9.0...v0.9.1
[v0.9.0]: https://github.com/evan361425/version-bumper/compare/v0.8.1...v0.9.0
[v0.8.1]: https://github.com/evan361425/version-bumper/compare/v0.8.0...v0.8.1
[v0.8.0]: https://github.com/evan361425/version-bumper/compare/v0.7.1...v0.8.0
[v0.7.1]: https://github.com/evan361425/version-bumper/compare/v0.7.0...v0.7.1
[v0.7.0]: https://github.com/evan361425/version-bumper/compare/v0.6.0...v0.7.0
[v0.6.0]: https://github.com/evan361425/version-bumper/compare/v0.5.3...v0.6.0
[v0.5.3]: https://github.com/evan361425/version-bumper/compare/v0.5.2...v0.5.3
[v0.5.2]: https://github.com/evan361425/version-bumper/compare/v0.5.1...v0.5.2
[v0.5.1]: https://github.com/evan361425/version-bumper/compare/v0.5.0...v0.5.1
[v0.5.0]: https://github.com/evan361425/version-bumper/compare/v0.4.5...v0.5.0
[v0.4.5]: https://github.com/evan361425/version-bumper/compare/v0.4.4...v0.4.5
[v0.4.4]: https://github.com/evan361425/version-bumper/compare/v0.4.3...v0.4.4
[v0.4.3]: https://github.com/evan361425/version-bumper/compare/v0.4.2...v0.4.3
[v0.4.2]: https://github.com/evan361425/version-bumper/compare/v0.4.1...v0.4.2
[v0.4.1]: https://github.com/evan361425/version-bumper/compare/v0.4.0...v0.4.1
[v0.4.0]: https://github.com/evan361425/version-bumper/compare/v0.3.0...v0.4.0
[v0.3.0]: https://github.com/evan361425/version-bumper/compare/v0.2.5...v0.3.0
[v0.2.5]: https://github.com/evan361425/version-bumper/compare/v0.2.4...v0.2.5
[v0.2.4]: https://github.com/evan361425/version-bumper/compare/v0.2.3...v0.2.4
[v0.2.3]: https://github.com/evan361425/version-bumper/compare/v0.2.2...v0.2.3
[v0.2.2]: https://github.com/evan361425/version-bumper/compare/v0.2.1...v0.2.2
[v0.2.1]: https://github.com/evan361425/version-bumper/compare/v0.2.0...v0.2.1
[v0.2.0]: https://github.com/evan361425/version-bumper/compare/v0.1.0...v0.2.0
[v0.1.0]: https://github.com/evan361425/version-bumper/commits/v0.1.0
