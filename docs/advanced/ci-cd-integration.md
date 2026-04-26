# CI/CD Integration

Bumpx is designed to work seamlessly in CI/CD environments. This guide covers integration patterns for GitHub Actions, GitLab CI, and other CI/CD platforms.

## CI Mode

### Automatic CI Detection

Bumpx automatically detects CI environments:

```bash
# CI mode is enabled when CI=true
export CI=true
bumpx patch  # Automatically uses --yes --quiet

# Explicit CI mode
bumpx patch --ci
```

### CI Mode Behavior

When `--ci` is enabled:
- Confirmation prompts are skipped (`--yes`)
- Output is minimized (`--quiet`)
- Interactive features are disabled

## GitHub Actions

### Basic Release Workflow

```yaml
name: Release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version bump type'
        required: true
        default: 'patch'
        type: choice
        options:
          - patch
          - minor
          - major
          - prepatch
          - preminor
          - premajor

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Install bumpx
        run: bun add -g @stacksjs/bumpx

      - name: Version bump
        run: bumpx ${{ inputs.version }} --commit --tag --push --ci
```

### Automated Release on Merge

```yaml
name: Auto Release

on:
  push:
    branches: [main]
    paths-ignore:
      - '*.md'
      - 'docs/**'

jobs:
  check-release:
    runs-on: ubuntu-latest
    outputs:
      should_release: ${{ steps.check.outputs.should_release }}
      release_type: ${{ steps.check.outputs.release_type }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Check for release trigger
        id: check
        run: |
          COMMIT_MSG=$(git log -1 --pretty=%B)
          if [[ "$COMMIT_MSG" == *"[release:"* ]]; then
            TYPE=$(echo "$COMMIT_MSG" | grep -oP '\[release:\s*\K[^\]]+')
            echo "should_release=true" >> $GITHUB_OUTPUT
            echo "release_type=$TYPE" >> $GITHUB_OUTPUT
          else
            echo "should_release=false" >> $GITHUB_OUTPUT
          fi

  release:
    needs: check-release
    if: needs.check-release.outputs.should_release == 'true'
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: oven-sh/setup-bun@v1

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Release
        run: |
          bun add -g @stacksjs/bumpx
          bumpx ${{ needs.check-release.outputs.release_type }} \
            --commit --tag --push --ci
```

### Release with Build and Publish

```yaml
name: Release and Publish

on:
  workflow_dispatch:
    inputs:
      version:
        type: choice
        options: [patch, minor, major]

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Install dependencies
        run: bun install

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Version bump and build
        run: |
          bun add -g @stacksjs/bumpx
          bumpx ${{ inputs.version }} \
            --execute "bun run build" \
            --commit \
            --tag \
            --push \
            --ci

      - name: Publish to npm
        run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Create GitHub Release
        run: |
          VERSION=$(jq -r .version package.json)
          gh release create "v$VERSION" \
            --title "v$VERSION" \
            --generate-notes
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Monorepo Release

```yaml
name: Monorepo Release

on:
  workflow_dispatch:
    inputs:
      version:
        type: choice
        options: [patch, minor, major]
      package:
        description: 'Package to release (all for all packages)'
        default: 'all'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Configure Git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Release all packages
        if: inputs.package == 'all'
        run: |
          bun add -g @stacksjs/bumpx
          bumpx ${{ inputs.version }} \
            --recursive \
            --commit \
            --tag \
            --push \
            --ci

      - name: Release single package
        if: inputs.package != 'all'
        run: |
          bun add -g @stacksjs/bumpx
          cd packages/${{ inputs.package }}
          bumpx ${{ inputs.version }} \
            --commit \
            --tag \
            --push \
            --ci
```

## GitLab CI

### Basic Release Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - release

release:
  stage: release
  image: oven/bun:latest
  only:
    - triggers
  variables:
    VERSION_TYPE: patch
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
    - bun add -g @stacksjs/bumpx
    - bumpx $VERSION_TYPE --commit --tag --ci
    - git push origin HEAD:$CI_COMMIT_REF_NAME --tags
```

### Scheduled Release

```yaml
release:scheduled:
  stage: release
  only:
    - schedules
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
    - bun add -g @stacksjs/bumpx
    - |
      # Check for changes since last tag
      LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
      if [ -n "$LAST_TAG" ]; then
        CHANGES=$(git log $LAST_TAG..HEAD --oneline | wc -l)
        if [ "$CHANGES" -gt 0 ]; then
          bumpx patch --commit --tag --push --ci
        fi
      fi
```

## Other CI Platforms

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

jobs:
  release:
    docker:
      - image: oven/bun:latest
    steps:
      - checkout
      - run:
          name: Configure Git
          command: |
            git config user.name "CircleCI"
            git config user.email "ci@circleci.com"
      - run:
          name: Release
          command: |
            bun add -g @stacksjs/bumpx
            bumpx patch --commit --tag --push --ci

workflows:
  release:
    jobs:
      - release:
          filters:
            branches:
              only: main
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent {
        docker {
            image 'oven/bun:latest'
        }
    }

    parameters {
        choice(name: 'VERSION_TYPE', choices: ['patch', 'minor', 'major'])
    }

    stages {
        stage('Release') {
            steps {
                sh '''
                    git config user.name "Jenkins"
                    git config user.email "ci@jenkins.io"
                    bun add -g @stacksjs/bumpx
                    bumpx ${VERSION_TYPE} --commit --tag --push --ci
                '''
            }
        }
    }
}
```

### Azure Pipelines

```yaml
# azure-pipelines.yml
trigger: none

parameters:
  - name: versionType
    type: string
    default: patch
    values:
      - patch
      - minor
      - major

pool:
  vmImage: ubuntu-latest

steps:
  - task: UseNode@1
    inputs:
      version: '20.x'

  - script: |
      npm install -g bun
      bun add -g @stacksjs/bumpx
    displayName: Install tools

  - script: |
      git config user.name "Azure Pipelines"
      git config user.email "ci@azure.com"
      bumpx ${{ parameters.versionType }} --commit --tag --push --ci
    displayName: Release
```

## Environment Variables

### Common CI Variables

```bash
# Bumpx respects these environment variables
CI=true              # Enable CI mode
NO_COLOR=1           # Disable colored output
GITHUB_TOKEN=xxx     # For GitHub operations
```

### Custom Variables

```yaml
# GitHub Actions example
env:
  BUMPX_COMMIT: true
  BUMPX_TAG: true
  BUMPX_PUSH: true
```

## Security Considerations

### Token Permissions

```yaml
# GitHub Actions - minimum required permissions
permissions:
  contents: write  # For push and tags
```

### Protected Branches

```yaml
# Use a PAT or GitHub App for protected branches
- uses: actions/checkout@v4
  with:
    token: ${{ secrets.RELEASE_TOKEN }}  # PAT with push access
```

### Signed Commits

```yaml
# GPG signing in CI
- name: Import GPG key
  run: |
    echo "${{ secrets.GPG_PRIVATE_KEY }}" | gpg --import
    git config user.signingkey ${{ secrets.GPG_KEY_ID }}
    git config commit.gpgsign true

- name: Release with signing
  run: bumpx patch --commit --tag --push --sign --ci
```

## Best Practices

1. **Use CI Mode**: Always use `--ci` flag in automated environments
2. **Configure Git Identity**: Set git user.name and user.email
3. **Fetch Full History**: Use `fetch-depth: 0` for proper tag operations
4. **Handle Protected Branches**: Use appropriate tokens for protected branches
5. **Idempotent Operations**: Design pipelines to be safely re-runnable
6. **Version Control Config**: Keep CI config in version control
7. **Minimal Permissions**: Use least-privilege for CI tokens
8. **Test Pipeline Changes**: Test in non-production branches first
