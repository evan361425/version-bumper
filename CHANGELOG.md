# Changelog

所有本專案的版本紀錄將於此說明之。

文件依照 [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) 內所描述的格式撰寫，版本號碼依照 [Semantic Versioning](https://semver.org/spec/v2.0.0.html)。

## [Unreleased]

Please check git diff.

## [v0.13.0] - 2023-03-20

-   ([822a221](https://github.com/evan361425/version-bumper/commit/822a221ffeaaf08188488dcd7a7b78f00ebb788b)) feat: allow ignore body in changelog - wu0dj2k7ao3

## [v0.12.2] - 2023-03-15

-   ([c69c58d](https://github.com/evan361425/version-bumper/commit/c69c58df7874be17e657ec2aad9422941891cedf)) fix(deps): get repo link separately

## [v0.12.1] - 2023-03-15

-   ([50c5d83](https://github.com/evan361425/version-bumper/commit/50c5d83eae449ce0ccac7eae2308c5eec2cf8b3b)) fix: show command when error

## [v0.12.0] - 2023-03-05

-   ([e5de06a](https://github.com/evan361425/version-bumper/commit/e5de06a30e345ad7476b37d2d90f59032f712d7b)) feat: add beforeCommit and afterScripts - wu0dj2k7ao3
-   ([e6c3397](https://github.com/evan361425/version-bumper/commit/e6c3397976b1ace068be3d1a2fb754222098ac24)) test: correct test - wu0dj2k7ao3

## [v0.11.5] - 2023-02-23

-   ([e34c100](https://github.com/evan361425/version-bumper/commit/e34c100c2366d3779580c2d9c1587069c51c4a6e)) fix: prepend pr id if exist (#1) - Shueh Chou Lu

## [v0.11.4] - 2023-02-22

-   ([4002b72](https://github.com/evan361425/version-bumper/commit/4002b72717c277e7464db1d057eca53253225aca)) fix: extract links in commit message - Shueh Chou Lu

## [v0.11.3] - 2023-02-22

-   ([0bc3871](https://github.com/evan361425/version-bumper/commit/0bc3871df01483ed4a8b4aa76affc773a2a087c1)) fix: extract links in tag message - Shueh Chou Lu

## [v0.11.2] - 2023-02-22

-   ([dda3026](https://github.com/evan361425/version-bumper/commit/dda3026dd6c9cbffcd019eb0621dc539ac65af24)) fix: add bullet before pr commit - Shueh Chou Lu

## [v0.11.1] - 2023-02-17

-   ([4156a79](https://github.com/evan361425/version-bumper/commit/4156a7983555612af7fa4aa495b2fea8bc72401b)) fix: ignore hash links if this commit from PR - Shueh Chou Lu

## [v0.11.0] - 2023-02-17

-   ([ec1ee14](https://github.com/evan361425/version-bumper/commit/ec1ee14c16877887d67c07cad90f528f10a7b1cf)) fix: print known error instead throw it - Shueh Chou Lu
-   ([fde469e](https://github.com/evan361425/version-bumper/commit/fde469eb0e86fccd7a229b743016543effcb3773)) feat: use regex to choose diff commit - Shueh Chou Lu

## [v0.10.0] - 2023-02-16

-   ([2e29c41](https://github.com/evan361425/version-bumper/commit/2e29c419c02669ee858f06efd7227bd0846e90d8)) feat: add content on commit message - Shueh Chou Lu
-   ([650d59f](https://github.com/evan361425/version-bumper/commit/650d59fb95bbcf617ded08c81ce5d1e8910cbbce)) fix: avoid ignore value start with dash - Shueh Chou Lu

## [v0.9.3] - 2023-02-13

-   ([b44b8d8](https://github.com/evan361425/version-bumper/commit/b44b8d80fe529542f9b3fc638e904523ec4386a4)) fix: output script error and exit, not throw error - Shueh Chou Lu

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

[unreleased]: https://github.com/evan361425/version-bumper/compare/v0.13.0...HEAD
[v0.13.0]: https://github.com/evan361425/version-bumper/compare/v0.12.2...v0.13.0
[v0.12.2]: https://github.com/evan361425/version-bumper/compare/v0.12.1...v0.12.2
[v0.12.1]: https://github.com/evan361425/version-bumper/compare/v0.12.0...v0.12.1
[v0.12.0]: https://github.com/evan361425/version-bumper/compare/v0.11.5...v0.12.0
[v0.11.5]: https://github.com/evan361425/version-bumper/compare/v0.11.4...v0.11.5
[v0.11.4]: https://github.com/evan361425/version-bumper/compare/v0.11.3...v0.11.4
[v0.11.3]: https://github.com/evan361425/version-bumper/compare/v0.11.2...v0.11.3
[v0.11.2]: https://github.com/evan361425/version-bumper/compare/v0.11.1...v0.11.2
[v0.11.1]: https://github.com/evan361425/version-bumper/compare/v0.11.0...v0.11.1
[v0.11.0]: https://github.com/evan361425/version-bumper/compare/v0.10.0...v0.11.0
[v0.10.0]: https://github.com/evan361425/version-bumper/compare/v0.9.3...v0.10.0
[v0.9.3]: https://github.com/evan361425/version-bumper/compare/v0.9.2...v0.9.3
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
