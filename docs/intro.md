<p align="center"><img src="https://github.com/stacksjs/bumpx/blob/main/.github/art/cover.jpg?raw=true" alt="Social Card of bumpx"></p>

# Introduction

> A powerful, modern version bumping tool with comprehensive Git integration and monorepo support.

## What is bumpx?

bumpx is a version management tool that simplifies the process of bumping versions across your projects. It focuses on:

- **Semantic versioning** with full semver compliance
- **Git workflow automation** with commits, tags, and pushing
- **Multi-file version management** across different file types
- **Monorepo support** with flexible versioning strategies
- **Cross-platform compatibility** on macOS, Linux, and Windows

Whether you're managing a single package or a complex monorepo, bumpx provides the tools you need to automate your release process with confidence and consistency.

## Key Features

- 🔢 **Semantic Versioning** — Full support for patch, minor, major, and prerelease versions
- 🔄 **Git Integration** — Automated commits, tags, signing, and push operations
- 📦 **Multi-File Support** — Update versions across package.json, VERSION files, and source code
- 🏗️ **Monorepo Ready** — Independent or synchronized versioning for multiple packages
- 🌐 **Cross-Platform** — Consistent behavior on macOS, Linux, and Windows
- 🚀 **CI/CD Integration** — Built-in support for GitHub Actions and other CI platforms
- 🎯 **Interactive Mode** — Guided version selection with commit history context
- 🔍 **Dry Run Mode** — Preview changes before applying them
- ⚡ **Fast & Reliable** — Efficient file processing with comprehensive error handling

## How It Works

bumpx automates your entire version bumping workflow:

1. **Detects current versions** across your project files
2. **Calculates new versions** based on semantic versioning rules
3. **Updates all relevant files** with intelligent pattern matching
4. **Creates Git commits and tags** with customizable messages
5. **Pushes changes** to your remote repository
6. **Runs post-bump scripts** for builds, tests, or deployments

All of this happens in a single command, with full transparency and control over each step.

## Quick Example

Here's how simple version bumping becomes with bumpx:

```bash
# Install bumpx
npm install -g bumpx

# Basic version bump
bumpx patch
# 1.0.0 → 1.0.1

# Version bump with Git workflow
bumpx minor --commit --tag --push
# 1.0.1 → 1.1.0, creates commit and tag, pushes to remote

# Interactive version selection
bumpx prompt --commits
# Shows recent commits and version options

# Monorepo version management
bumpx patch --recursive
# Updates all packages in your monorepo

# Custom files and post-bump actions
bumpx major --files "package.json,VERSION.txt,src/version.ts" \
           --commit --tag \
           --execute "bun run build && bun test"

# Prerelease versions
bumpx prerelease --preid beta --commit --tag
# 1.1.0 → 1.1.1-beta.0

# Dry run to preview changes
bumpx minor --dry-run --verbose
# Shows what would be changed without making changes
```

## Configuration

Configure bumpx to match your workflow:

```typescript
// bumpx.config.ts
export default {
  commit: true,
  tag: true,
  push: false,
  message: 'chore: release v%s',
  tagMessage: 'Release v%s',
  execute: 'bun run build && bun test'
}
```

Or in package.json:

```json
{
  "bumpx": {
    "commit": true,
    "tag": true,
    "message": "chore: release v%s"
  }
}
```

## Why Choose bumpx?

bumpx offers significant advantages over manual version management and other tools:

- **Comprehensive**: Handles files, Git operations, and post-bump actions
- **Reliable**: Extensive validation and error handling prevent mistakes
- **Flexible**: Works with any project structure or workflow
- **Fast**: Efficient processing even for large monorepos
- **Modern**: Built with TypeScript and modern Node.js features
- **Well-documented**: Extensive guides and examples

## Real-World Scenarios

### Single Package Release
```bash
bumpx patch --commit --tag --push
```

### Feature Release with Testing
```bash
bumpx minor --commit --tag --execute "bun run build && bun test" --push
```

### Monorepo Synchronized Release
```bash
bumpx major --recursive --current-version 1.0.0 --commit --tag
```

### CI/CD Automation
```bash
bumpx patch --commit --tag --push --no-verify --execute "bun run deploy"
```

## Next Steps

Ready to streamline your version management? Check out these guides:

- [Installation Guide](./install.md) — Install bumpx on your system
- [Basic Usage](./usage.md) — Learn the essential commands
- [Configuration](./config.md) — Customize bumpx for your workflow
- [Git Integration](./features/git-integration.md) — Automate your Git workflows
- [Monorepo Support](./features/monorepo-support.md) — Manage multiple packages

## Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/bumpx/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## Postcardware

"Software that is free, but hopes for a postcard." We love receiving postcards from around the world showing where Stacks is being used! We showcase them on our website too.

Our address: Stacks.js, 12665 Village Ln #2306, Playa Vista, CA 90094

## Sponsors

We would like to extend our thanks to the following sponsors for funding Stacks development. If you are interested in becoming a sponsor, please reach out to us.

- [JetBrains](https://www.jetbrains.com/)
- [The Solana Foundation](https://solana.com/)

## Credits

- [`version-bump-prompt`](https://github.com/JS-DevTools/version-bump-prompt) - for the initial inspiration
- [Antony Fu](https://github.com/antfu) - for creating [bumpp](https://github.com/antfu-collective/bumpp)
- [Chris Breuer](https://github.com/chrisbbreuer)
- [All Contributors](https://github.com/stacksjs/bumpx/graphs/contributors)

## License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/bumpx/tree/main/LICENSE.md) for more information.

Made with 💙

<!-- Badges -->

<!-- [codecov-src]: https://img.shields.io/codecov/c/gh/stacksjs/rpx/main?style=flat-square
[codecov-href]: https://codecov.io/gh/stacksjs/rpx -->
