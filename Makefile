SHELL := /usr/bin/env bash -o errexit -o pipefail -o nounset

OWNER=evan361425
PACKAGE?=version-bumper

revision?=$(shell git rev-parse HEAD)
version?=$(shell git describe --tags --abbrev=0)
now?=$(shell date -u '+%Y-%m-%dT%H:%M:%SZ')
repo?=$(OWNER)/$(PACKAGE)
token=$(shell cat ~/.npmrc | grep 'npm.pkg.github.com/:_authToken' | cut -d= -f2)

.PHONY: help
help: ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_0-9-]+:.*?##/ { printf "  \033[36m%-23s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build
.PHONY: build-ts
build-ts: clean ## Build js files to dist
	@npx tsc --project tsconfig.production.json
	@cp bin/api/help-args.txt dist/bin/api/help-args.txt

.PHONY: build-assets
build-assets: ## Build assets
	@printf '# Makefile possible commands\n\n```shell\n$$ make help\n' > docs/commands.md
	@make help | sed -r "s/\x1B\[(36|0|1)m//g" >> docs/commands.md
	@printf '```\n' >> docs/commands.md
	@node --import tsx bin/schema.ts > schema.json
	@node --import tsx bin/help.ts > bin/api/help-args.txt
	@node --import tsx bin/default.ts > config.default.json

.PHONY: bump
bump: ## Bump the version
	@bumper \
		--hook-after-verified[] 'npm version --no-commit-hooks --no-git-tag-version {versionNoPrefix}' \
		--hook-after-verified[] 'make build-assets' \
		--clog-commit-add-all

##@ Dev

.PHONY: install
install: ## Install all dependencies
	npm install --ignore-scripts

.PHONY: install-prod
install-prod: install ## Install production dependencies only
	npm prune --omit=dev --ignore-scripts

.PHONY: format
format: ## Format by prettier
	npx prettier --write 'lib/**/*.ts' 'test/*.ts'

.PHONY: lint
lint: ## Lint by eslint
	npx eslint
	npx prettier --check 'lib/**/*.ts' 'test/*.ts'

.PHONY: lint-image
lint-image: ## Lint image by trivy
	docker run --rm -i \
		-v /var/.trivy:/root/.cache/trivy \
		-v /var/run/docker.sock:/var/run/docker.sock \
		aquasec/trivy image \
			--image-config-scanners misconfig \
			--image-config-scanners secret \
			--skip-dirs node_modules \
			--exit-code 1 \
			--severity HIGH,CRITICAL \
			--ignore-unfixed \
			--no-progress \
			$(PACKAGE):$(version)

.PHONY: test
test: lint ## Run tests by Node.js test runner
	node --import tsx --test --test-timeout 60000 test/*.spec.ts

.PHONY: test-unit
test-unit: ## Run tests without lint
	node --import tsx --test --test-timeout 60000 test/*.spec.ts

.PHONY: test-only
test-only: ## Run tests with only statement
	node --import tsx --test-only --test --test-timeout 60000 test/*.spec.ts

.PHONY: test-coverage
test-coverage: clean ## Run tests with coverage and re-run without coverage if failed (to show error message)
	mkdir -p coverage
	npx tsc # compile files
	if ! node --test --experimental-test-coverage --test-timeout 60000 \
		--test-reporter=lcov --test-reporter-destination=coverage/lcov.info \
		dist/test/*.spec.js; then \
		node --test dist/test/*.spec.js; \
	fi
	lcov --remove coverage/lcov.info -o coverage/lcov.filtered.info \
		'test/*' | grep -v 'Excluding dist'
	genhtml coverage/lcov.filtered.info -o coverage/html > /dev/null
	open coverage/html/index.html

.PHONY: clean
clean: ## Clean all build files
	rm -rf dist coverage

.PHONY: clean-mock
clean-mock: ## Clean mock servers
	docker stop mock-redis || true
