# CI/CD Integration Guide

This guide covers how to use bumpx in CI/CD environments like GitHub Actions, GitLab CI, Jenkins, and other automated workflows.

## Quick Start for CI

For automated version bumping in CI environments, use the `--ci` flag or `--yes` flag:

```bash
# CI mode (automatically sets --yes --quiet)
bumpx patch --ci

# Or explicit non-interactive mode
bumpx patch --yes

# With custom commands
bumpx patch --ci --execute "npm run build" --execute "npm run test"
```

## Environment Detection

bumpx automatically detects CI environments by checking the `CI` environment variable:

```bash
# This will automatically enable CI mode if CI=true
export CI=true
bumpx patch  # Automatically non-interactive
```

## GitHub Actions

### Basic Workflow

```yaml
name: Release

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      release_type:
        description: Release type
        required: true
        default: patch
        type: choice
        options: [patch, minor, major, prepatch, preminor, premajor]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build and test
        run: |
          bun run build
          bun run test

      - name: Configure git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Version bump
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            bunx bumpx ${{ github.event.inputs.release_type }} --ci
          else
            bunx bumpx patch --ci
          fi
```

### Advanced Workflow with NPM Publishing

```yaml
name: Release and Publish

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: Release type
        required: true
        default: patch
        type: choice
        options: [patch, minor, major, prepatch, preminor, premajor, prerelease]
      preid:
        description: Prerelease identifier
        required: false
        type: string

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Run tests
        run: bun test

      - name: Build
        run: bun run build

      - name: Configure git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Version bump and release
        run: |
          if [ -n "${{ github.event.inputs.preid }}" ]; then
            bunx bumpx ${{ github.event.inputs.release_type }} --preid ${{ github.event.inputs.preid }} --ci --execute "npm run build"
          else
            bunx bumpx ${{ github.event.inputs.release_type }} --ci --execute "npm run build"
          fi

      - name: Publish to NPM
        run: npm publish --provenance --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Monorepo Workflow

```yaml
name: Monorepo Release

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: Release type
        required: true
        default: patch
        type: choice
        options: [patch, minor, major]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Build all packages
        run: bun run build

      - name: Test all packages
        run: bun run test

      - name: Configure git
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"

      - name: Bump all package versions
        run: bunx bumpx ${{ github.event.inputs.release_type }} --recursive --ci

      - name: Publish packages
        run: |
          for dir in packages/*/; do
            if [ -f "$dir/package.json" ]; then
              cd "$dir"
              npm publish --access public
              cd - > /dev/null
            fi
          done
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## GitLab CI

```yaml
stages:
  - test
  - release

variables:
  CI: 'true'

test:
  stage: test
  image: oven/bun:latest
  script:
    - bun install
    - bun run build
    - bun run test

release:
  stage: release
  image: oven/bun:latest
  only:
    - main
  before_script:
    - git config --global user.name "gitlab-ci"
    - git config --global user.email "gitlab-ci@gitlab.com"
  script:
    - bun install
    - bunx bumpx patch --ci
    - npm publish --access public
  variables:
    NODE_AUTH_TOKEN: $CI_JOB_TOKEN
```

## Jenkins Pipeline

```groovy
pipeline {
    agent any

    environment {
        CI = 'true'
        NODE_AUTH_TOKEN = credentials('npm-token')
    }

    stages {
        stage('Install') {
            steps {
                sh 'bun install'
            }
        }

        stage('Test') {
            steps {
                sh 'bun run build'
                sh 'bun run test'
            }
        }

        stage('Release') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    git config --global user.name "jenkins"
                    git config --global user.email "jenkins@company.com"
                    bunx bumpx patch --ci
                    npm publish --access public
                '''
            }
        }
    }
}
```

## Azure DevOps

```yaml
trigger:
  branches:
    include:
      - main

pool:
  vmImage: ubuntu-latest

variables:
  CI: true

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: 18.x

  - script: |
      curl -fsSL https://bun.sh/install | bash
      echo 'export PATH="$HOME/.bun/bin:$PATH"' >> $BASH_ENV
    displayName: Install Bun

  - script: bun install
    displayName: Install dependencies

  - script: |
      bun run build
      bun run test
    displayName: Build and test

  - script: |
      git config --global user.name "azure-devops"
      git config --global user.email "azure-devops@company.com"
      bunx bumpx patch --ci
    displayName: Version bump
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')

  - task: Npm@1
    inputs:
      command: publish
      publishRegistry: useExternalRegistry
      publishEndpoint: npm-registry
    condition: eq(variables['Build.SourceBranch'], 'refs/heads/main')
```

## CircleCI

```yaml
version: 2.1

orbs:
  node: circleci/node@5.0.0

jobs:
  test:
    docker:
      - image: oven/bun:latest
    steps:
      - checkout
      - run: bun install
      - run: bun run build
      - run: bun run test

  release:
    docker:
      - image: oven/bun:latest
    steps:
      - checkout
      - run: bun install
      - run:
          name: Configure git
          command: |
            git config --global user.name "circleci"
            git config --global user.email "circleci@company.com"
      - run:
          name: Version bump and publish
          command: |
            bunx bumpx patch --ci
            echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc
            npm publish --access public

workflows:
  version: 2
  test-and-release:
    jobs:
      - test
      - release:
          requires:
            - test
          filters:
            branches:
              only: main
```

## Configuration for CI

### CI-Specific Config

Create a `bumpx.config.ci.ts` for CI environments:

```typescript
import { defineConfig } from '@stacksjs/bumpx'

export default defineConfig({
  // Disable interactive features
  confirm: false,
  quiet: true,

  // Always commit, tag, and push in CI
  commit: true,
  tag: true,
  push: true,

  // Run build before git operations
  execute: ['npm run build', 'npm run test'],

  // Don't sign in CI (unless you have GPG setup)
  sign: false,

  // Skip git verification for faster CI
  noVerify: true,
})
```

### Environment Variables

Set these environment variables in your CI:

```bash
# Auto-detect CI mode
CI=true

# Skip interactive prompts
BUMPX_YES=true

# Custom commit message template
BUMPX_COMMIT_MESSAGE="chore: release v{version} [skip ci]"

# Skip git hooks in CI
BUMPX_NO_VERIFY=true
```

## Best Practices for CI

### 1. Always Use Non-Interactive Mode

```bash
# Good
bumpx patch --ci

# Good
bumpx patch --yes

# Bad (will hang in CI)
bumpx patch
```

### 2. Configure Git User

```bash
git config --global user.name "ci-bot"
git config --global user.email "ci@company.com"
```

### 3. Handle Authentication

```bash
# For GitHub
git remote set-url origin https://x-access-token:${GITHUB_TOKEN}@github.com/owner/repo.git

# For GitLab
git remote set-url origin https://gitlab-ci-token:${CI_JOB_TOKEN}@gitlab.com/owner/repo.git
```

### 4. Skip CI on Release Commits

Add `[skip ci]` to commit messages to prevent infinite loops:

```bash
bumpx patch --ci --commit "chore: release v{version} [skip ci]"
```

### 5. Use Conditional Releases

Only release from specific branches:

```yaml
- name: Release
  if: github.ref == 'refs/heads/main'
  run: bunx bumpx patch --ci
```

## Troubleshooting

### Common Issues

1. **Hanging in CI**: Make sure to use `--ci` or `--yes` flag
2. **Git authentication**: Ensure proper tokens are configured
3. **No changes detected**: Check if files were actually modified
4. **Permission denied**: Verify write access to repository

### Debug Mode

Enable debug output in CI:

```bash
DEBUG=1 bumpx patch --ci
```

### Dry Run

Test your configuration without making changes:

```bash
bumpx patch --ci --dry-run  # Note: --dry-run not implemented yet, but useful for future
```

## Security Considerations

1. **Use fine-grained tokens**: Only grant necessary permissions
2. **Restrict branch access**: Only allow releases from protected branches
3. **Review automated releases**: Set up notifications for releases
4. **Use signed commits**: When possible, configure GPG signing
