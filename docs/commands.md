# Makefile possible commands

```shell
$ make help

Usage:
  make <target>
  help                     Display this help

Build
  build-ts                 Build js files to dist
  build-assets             Build assets
  bump                     Bump the version

Dev
  install                  Install all dependencies
  install-prod             Install production dependencies only
  format                   Format by prettier
  lint                     Lint by eslint
  lint-image               Lint image by trivy
  test                     Run tests by Node.js test runner
  test-only                Run tests with only statement
  test-ci                  Run tests for CI
  test-coverage            Run tests with coverage and re-run without coverage if failed (to show error message)
  clean                    Clean all build files
  clean-mock               Clean mock servers
```
