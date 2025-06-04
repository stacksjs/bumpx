# Automation & CI/CD

This guide covers automating bumpx in continuous integration and deployment workflows, including GitHub Actions, GitLab CI, and other CI/CD platforms.

## GitHub Actions Integration

### Basic Release Workflow

Automate version bumping and releases with GitHub Actions:

```yaml
# .github/workflows/release.yml
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
        options:
          - patch
          - minor
          - major

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Bump version
        run: |
          RELEASE_TYPE="${{ github.event.inputs.release_type || 'patch' }}"
          bumpx $RELEASE_TYPE --commit --tag --push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build
        run: npm run build

      - name: Create GitHub Release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ steps.bump.outputs.new_version }}
          release_name: Release v${{ steps.bump.outputs.new_version }}
          generate_release_notes: true
```

### Advanced GitHub Actions

Comprehensive workflow with multiple jobs:

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - run: npm ci
      - run: npm run lint
      - run: npm test
      - run: npm run build

  release:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    outputs:
      released: ${{ steps.release.outputs.released }}
      version: ${{ steps.release.outputs.version }}

    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.PAT_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - run: npm ci

      - name: Configure git
        run: |
          git config user.name "Release Bot"
          git config user.email "release-bot@yourcompany.com"

      - name: Determine release type
        id: release-type
        run: |
          # Check commit messages for conventional commit patterns
          if git log --format=%B -n 1 | grep -q "BREAKING CHANGE:"; then
            echo "type=major" >> $GITHUB_OUTPUT
          elif git log --format=%B -n 1 | grep -q "^feat"; then
            echo "type=minor" >> $GITHUB_OUTPUT
          else
            echo "type=patch" >> $GITHUB_OUTPUT
          fi

      - name: Release
        id: release
        run: |
          TYPE="${{ steps.release-type.outputs.type }}"
          VERSION=$(bumpx $TYPE --commit --tag --push --dry-run | grep "→" | awk '{print $3}')
          bumpx $TYPE --commit --tag --push
          echo "released=true" >> $GITHUB_OUTPUT
          echo "version=$VERSION" >> $GITHUB_OUTPUT

  publish:
    needs: release
    if: needs.release.outputs.released == 'true'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
        with:
          ref: main

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          registry-url: 'https://registry.npmjs.org'

      - run: npm ci
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  docker:
    needs: release
    if: needs.release.outputs.released == 'true'
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4
      - name: Build and push Docker image
        run: |
          docker build -t myapp:${{ needs.release.outputs.version }} .
          docker push myapp:${{ needs.release.outputs.version }}
```

### Using bumpx in GitHub Actions

Integrate bumpx directly in your GitHub Actions workflows:

```yaml
# .github/workflows/release.yml
name: Version Management

on:
  push:
    branches: [main]

jobs:
  bump:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install bumpx
        run: npm install -g bumpx

      - name: Configure git
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Bump version
        run: bumpx patch --commit --tag --push
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## GitLab CI Integration

### Basic GitLab Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - test
  - release
  - deploy

variables:
  NODE_VERSION: '20'

test:
  stage: test
  image: node:$NODE_VERSION
  script:
    - npm ci
    - npm run lint
    - npm test
    - npm run build
  artifacts:
    reports:
      junit: test-results.xml
    paths:
      - dist/

release:
  stage: release
  image: node:$NODE_VERSION
  only:
    - main
  before_script:
    - npm ci
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
  script:
    - npm test
    - bumpx patch --commit --tag --push
    - npm run build
  after_script:
    - git push origin --tags
  artifacts:
    paths:
      - dist/

deploy:
  stage: deploy
  script:
    - npm publish
  only:
    - tags
  environment:
    name: production
```

### Advanced GitLab Configuration

```yaml
# .gitlab-ci.yml
include:
  - template: Security/SAST.gitlab-ci.yml
  - template: Security/Dependency-Scanning.gitlab-ci.yml

stages:
  - validate
  - test
  - security
  - release
  - deploy

variables:
  FF_USE_FASTZIP: 'true'
  CACHE_COMPRESSION_LEVEL: fastest

.node_template: &node_template
  image: node:20-alpine
  cache:
    key: $CI_COMMIT_REF_SLUG
    paths:
      - node_modules/
      - .npm/
  before_script:
    - npm ci --cache .npm --prefer-offline

validate:
  <<: *node_template
  stage: validate
  script:
    - npm run lint
    - npm run type-check
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

test:unit:
  <<: *node_template
  stage: test
  script:
    - npm run test:unit
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml
      junit: junit.xml

test:integration:
  <<: *node_template
  stage: test
  script:
    - npm run test:integration
  services:
    - postgres:13
    - redis:6

release:
  <<: *node_template
  stage: release
  only:
    - main
  script:
    - git config user.name "GitLab CI"
    - git config user.email "ci@gitlab.com"
    - |
      # Determine release type from commit messages
      if git log --format=%B -n 20 | grep -q "BREAKING CHANGE:"; then
        RELEASE_TYPE="major"
      elif git log --format=%B -n 5 | grep -q "^feat:"; then
        RELEASE_TYPE="minor"
      else
        RELEASE_TYPE="patch"
      fi
    - bumpx $RELEASE_TYPE --commit --tag --push
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy:production:
  stage: deploy
  script:
    - npm publish --registry $NPM_REGISTRY
  only:
    - tags
  environment:
    name: production
    url: https://www.npmjs.com/package/your-package
```

## Other CI/CD Platforms

### Azure DevOps

```yaml
# azure-pipelines.yml
trigger:
  - main

pool:
  vmImage: ubuntu-latest

variables:
  nodeVersion: 20.x

stages:
  - stage: Test
    jobs:
      - job: TestJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
          - script: npm ci
          - script: npm test
          - script: npm run build

  - stage: Release
    condition: and(succeeded(), eq(variables['Build.SourceBranch'], 'refs/heads/main'))
    jobs:
      - job: ReleaseJob
        steps:
          - task: NodeTool@0
            inputs:
              versionSpec: $(nodeVersion)
          - script: npm ci
          - script: |
              git config user.name "Azure DevOps"
              git config user.email "devops@company.com"
              bumpx patch --commit --tag --push
          - script: npm run build
          - script: npm publish
            env:
              NPM_TOKEN: $(NPM_TOKEN)
```

### Jenkins

```groovy
// Jenkinsfile
pipeline {
    agent any

    environment {
        NODE_VERSION = '20'
        NPM_TOKEN = credentials('npm-token')
    }

    stages {
        stage('Setup') {
            steps {
                sh "nvm use ${NODE_VERSION}"
                sh 'npm ci'
            }
        }

        stage('Test') {
            steps {
                sh 'npm run lint'
                sh 'npm test'
                sh 'npm run build'
            }
            post {
                always {
                    publishTestResults testResultsPattern: 'test-results.xml'
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: 'Coverage Report'
                    ])
                }
            }
        }

        stage('Release') {
            when {
                branch 'main'
            }
            steps {
                script {
                    sh '''
                        git config user.name "Jenkins"
                        git config user.email "jenkins@company.com"
                        bumpx patch --commit --tag --push
                        npm run build
                    '''
                }
            }
        }

        stage('Publish') {
            when {
                tag pattern: "v\\d+\\.\\d+\\.\\d+", comparator: "REGEXP"
            }
            steps {
                sh 'npm publish'
            }
        }
    }
}
```

### CircleCI

```yaml
# .circleci/config.yml
version: 2.1

orbs:
  node: circleci/node@5.1.0

workflows:
  test-and-release:
    jobs:
      - test
      - release:
          requires:
            - test
          filters:
            branches:
              only: main

jobs:
  test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Run tests
          command: |
            npm run lint
            npm test
            npm run build

  release:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - node/install-packages
      - run:
          name: Configure git
          command: |
            git config user.name "CircleCI"
            git config user.email "ci@circleci.com"
      - run:
          name: Release
          command: |
            bumpx patch --commit --tag --push
            npm run build
      - run:
          name: Publish
          command: npm publish
```

## Advanced Automation Patterns

### Conditional Releases

Release only when specific conditions are met:

```bash
#!/bin/bash
# scripts/conditional-release.sh

set -e

# Check if this is a release branch or main
if [[ "$GITHUB_REF" != "refs/heads/main" && "$GITHUB_REF" != "refs/heads/release/"* ]]; then
    echo "Not a release branch, skipping release"
    exit 0
fi

# Check if there are actual changes
if git diff --quiet HEAD~1 HEAD; then
    echo "No changes detected, skipping release"
    exit 0
fi

# Check if tests pass
if ! npm test; then
    echo "Tests failed, aborting release"
    exit 1
fi

# Check for breaking changes
if git log --format=%B -n 1 | grep -q "BREAKING CHANGE:"; then
    RELEASE_TYPE="major"
elif git log --format=%B -n 1 | grep -qE "^feat(\(.+\))?: "; then
    RELEASE_TYPE="minor"
else
    RELEASE_TYPE="patch"
fi

echo "Releasing with type: $RELEASE_TYPE"
bumpx $RELEASE_TYPE --commit --tag --push
```

### Semantic Release Integration

Integrate with conventional commits:

```bash
#!/bin/bash
# scripts/semantic-release.sh

# Parse conventional commits to determine release type
COMMIT_MSG=$(git log -1 --pretty=%B)
RELEASE_TYPE="patch"

# Check for breaking changes
if echo "$COMMIT_MSG" | grep -q "BREAKING CHANGE:"; then
    RELEASE_TYPE="major"
# Check for features
elif echo "$COMMIT_MSG" | grep -qE "^feat(\(.+\))?: "; then
    RELEASE_TYPE="minor"
# Check for fixes
elif echo "$COMMIT_MSG" | grep -qE "^fix(\(.+\))?: "; then
    RELEASE_TYPE="patch"
# Skip release for other commit types
elif echo "$COMMIT_MSG" | grep -qE "^(docs|style|refactor|test|chore)(\(.+\))?: "; then
    echo "Skipping release for commit type"
    exit 0
fi

echo "Determined release type: $RELEASE_TYPE"
bumpx $RELEASE_TYPE --commit --tag --push
```

### Multi-Environment Deployments

Deploy to different environments based on version:

```yaml
# .github/workflows/multi-env.yml
name: Multi-Environment Deploy

on:
  push:
    tags: ['v*']

jobs:
  parse-version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      is-prerelease: ${{ steps.version.outputs.is-prerelease }}
      environment: ${{ steps.version.outputs.environment }}
    steps:
      - name: Parse version
        id: version
        run: |
          VERSION=${GITHUB_REF#refs/tags/v}
          echo "version=$VERSION" >> $GITHUB_OUTPUT

          if [[ $VERSION == *"-"* ]]; then
            echo "is-prerelease=true" >> $GITHUB_OUTPUT
            echo "environment=staging" >> $GITHUB_OUTPUT
          else
            echo "is-prerelease=false" >> $GITHUB_OUTPUT
            echo "environment=production" >> $GITHUB_OUTPUT
          fi

  deploy-staging:
    needs: parse-version
    if: needs.parse-version.outputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - name: Deploy to staging
        run: echo "Deploying ${{ needs.parse-version.outputs.version }} to staging"

  deploy-production:
    needs: parse-version
    if: needs.parse-version.outputs.environment == 'production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - name: Deploy to production
        run: echo "Deploying ${{ needs.parse-version.outputs.version }} to production"
```

## Security Considerations

### Secure Token Handling

Best practices for handling authentication tokens:

```yaml
# Secure GitHub Actions setup
env:
  # Use fine-grained personal access tokens
  GITHUB_TOKEN: ${{ secrets.FINE_GRAINED_PAT }}
  NPM_TOKEN: ${{ secrets.NPM_PUBLISH_TOKEN }}

steps:
  # Configure git with token
  - name: Configure git authentication
    run: |
      git remote set-url origin https://x-access-token:${{ secrets.GITHUB_TOKEN }}@github.com/${{ github.repository }}
      git config user.name "github-actions[bot]"
      git config user.email "github-actions[bot]@users.noreply.github.com"
```

### Signed Releases

Ensure release integrity with signed commits and tags:

```bash
#!/bin/bash
# scripts/secure-release.sh

# Import GPG key for signing
echo "$GPG_PRIVATE_KEY" | gpg --batch --import
export GPG_TTY=$(tty)

# Configure git for signing
git config user.signingkey "$GPG_KEY_ID"
git config commit.gpgsign true
git config tag.gpgsign true

# Create signed release
bumpx patch --commit --tag --sign --push

# Verify signatures
git verify-commit HEAD
git verify-tag $(git describe --tags --abbrev=0)
```

### Environment Isolation

Isolate environments and permissions:

```yaml
# Use environment protection rules
deploy-production:
  environment:
    name: production
    protection_rules:
      - required_reviewers: 2
      - prevent_self_review: true
      - dismiss_stale_reviews: true
```

## Monitoring and Notifications

### Slack Notifications

Send release notifications to Slack:

```yaml
- name: Notify Slack
  uses: 8398a7/action-slack@v3
  with:
    status: success
    custom_payload: |
      {
        "text": "🚀 Released version ${{ steps.bump.outputs.new_version }}",
        "attachments": [{
          "color": "good",
          "fields": [{
            "title": "Repository",
            "value": "${{ github.repository }}",
            "short": true
          }, {
            "title": "Version",
            "value": "${{ steps.bump.outputs.new_version }}",
            "short": true
          }]
        }]
      }
  env:
    SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### Discord Notifications

```yaml
- name: Notify Discord
  uses: sarisia/actions-status-discord@v1
  with:
    webhook: ${{ secrets.DISCORD_WEBHOOK }}
    title: New Release
    description: 'Version ${{ steps.bump.outputs.new_version }} has been released!'
    color: 0x00ff00
```

### Email Notifications

```yaml
- name: Send email notification
  uses: dawidd6/action-send-mail@v3
  with:
    server_address: smtp.gmail.com
    server_port: 465
    username: ${{ secrets.EMAIL_USERNAME }}
    password: ${{ secrets.EMAIL_PASSWORD }}
    subject: 'New release: ${{ steps.bump.outputs.new_version }}'
    body: |
      A new version has been released:

      Version: ${{ steps.bump.outputs.new_version }}
      Repository: ${{ github.repository }}
      Commit: ${{ github.sha }}
    to: team@yourcompany.com
    from: releases@yourcompany.com
```

## Best Practices

### Automation Principles

1. **Fail Fast:** Validate early and fail quickly if issues are detected
2. **Idempotent Operations:** Ensure scripts can be run multiple times safely
3. **Comprehensive Testing:** Test thoroughly before releasing
4. **Rollback Strategy:** Have a plan for rolling back failed releases
5. **Monitoring:** Monitor the health of your automation pipelines

### Configuration Management

Keep your automation configuration maintainable:

```yaml
# Use reusable workflows
.github/workflows/reusable-release.yml:
  workflow_call:
    inputs:
      release-type:
        required: true
        type: string
      environment:
        required: true
        type: string
    secrets:
      NPM_TOKEN:
        required: true
```

### Error Handling

Robust error handling in automation scripts:

```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Trap errors and cleanup
trap 'echo "Error on line $LINENO"; cleanup' ERR

cleanup() {
    # Cleanup operations
    git reset --hard HEAD
    exit 1
}

# Your release logic here
```
