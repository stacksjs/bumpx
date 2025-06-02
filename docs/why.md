# Why bumpx?

Learn why bumpx is the ideal choice for modern version management and release workflows.

## The Problem with Traditional Tools

Version management in modern development often involves:

- **Manual version updates** across multiple files
- **Inconsistent versioning** between team members
- **Complex release workflows** that are error-prone
- **Poor monorepo support** in existing tools
- **Platform compatibility issues** across different operating systems
- **Limited automation capabilities** for CI/CD pipelines

## What Makes bumpx Different

### 🎯 **Semantic Versioning by Design**

bumpx follows semantic versioning (semver) principles strictly, ensuring your versions are meaningful and predictable:

```bash
# Clear, semantic version bumps
bumpx patch    # Bug fixes: 1.0.0 → 1.0.1
bumpx minor    # New features: 1.0.0 → 1.1.0
bumpx major    # Breaking changes: 1.0.0 → 2.0.0
```

### 🚀 **Multi-File Version Management**

Unlike tools that only handle `package.json`, bumpx can update versions across your entire project:

```bash
# Update multiple files simultaneously
bumpx patch --files "package.json,VERSION.txt,src/version.ts,README.md"

# Smart pattern matching finds versions everywhere
bumpx minor --recursive
```

### 🔄 **Integrated Git Workflow**

Complete Git integration eliminates manual steps and reduces errors:

```bash
# Complete release workflow in one command
bumpx minor --commit --tag --push

# Signed releases for security
bumpx patch --commit --tag --sign

# Custom commit messages and hooks
bumpx major --commit --message "feat: release v%s" --execute "npm run build"
```

### 🏗️ **First-Class Monorepo Support**

Built from the ground up to handle complex monorepo scenarios:

```bash
# Independent versioning for each package
bumpx patch --recursive

# Synchronized versioning across packages
bumpx minor --recursive --current-version 1.0.0

# Selective package updates
bumpx patch --files "packages/core/package.json,packages/cli/package.json"
```

## Comparison with Other Tools

### vs. `npm version`

| Feature | npm version | bumpx |
|---------|-------------|-------|
| Multi-file support | ❌ | ✅ |
| Monorepo support | ❌ | ✅ |
| Custom commit messages | ❌ | ✅ |
| Dry run mode | ❌ | ✅ |
| Cross-platform | ⚠️ | ✅ |
| Interactive prompts | ❌ | ✅ |
| Progress tracking | ❌ | ✅ |

**npm version limitations:**
- Only updates `package.json` and `package-lock.json`
- No support for monorepos
- Limited customization options
- No dry run capabilities

**bumpx advantages:**
```bash
# npm version (limited)
npm version patch

# bumpx (comprehensive)
bumpx patch --files "package.json,VERSION.txt" --commit --tag --execute "npm run build"
```

### vs. `bumpp`

| Feature | bumpp | bumpx |
|---------|-------|-------|
| TypeScript support | ✅ | ✅ |
| Git integration | ✅ | ✅ |
| Monorepo support | ⚠️ | ✅ |
| Progress tracking | ❌ | ✅ |
| Platform support | ⚠️ | ✅ |
| API documentation | ⚠️ | ✅ |

**bumpx improvements:**
- Better monorepo detection and management
- Enhanced cross-platform compatibility
- Comprehensive progress tracking
- Extensive configuration options

### vs. `semantic-release`

| Feature | semantic-release | bumpx |
|---------|------------------|-------|
| Automatic versioning | ✅ | ⚠️ |
| Git integration | ✅ | ✅ |
| Plugin ecosystem | ✅ | ⚠️ |
| Simplicity | ❌ | ✅ |
| Configuration | ❌ | ✅ |
| Learning curve | ❌ | ✅ |

**When to choose bumpx:**
- You want control over version bumps
- Simpler configuration is preferred
- Cross-platform consistency is important
- Manual approval of releases is required

**When to choose semantic-release:**
- Fully automated releases are desired
- Complex plugin workflows are needed
- Conventional commits are strictly followed

### vs. `lerna version`

| Feature | lerna version | bumpx |
|---------|---------------|-------|
| Monorepo focus | ✅ | ✅ |
| Independent versioning | ✅ | ✅ |
| Dependency updates | ✅ | ⚠️ |
| Modern tools | ❌ | ✅ |
| Performance | ❌ | ✅ |
| Maintenance | ❌ | ✅ |

**bumpx advantages:**
- Active development and maintenance
- Better performance and reliability
- Modern JavaScript/TypeScript support
- Simpler configuration

## Real-World Benefits

### 🛡️ **Reduced Human Error**

Automation eliminates common mistakes:

```bash
# Before: Manual process prone to errors
# 1. Update package.json
# 2. Update VERSION file
# 3. Update documentation
# 4. Create git commit
# 5. Create git tag
# 6. Push changes
# 7. Remember to build/test

# After: Single command handles everything
bumpx patch --recursive --commit --tag --push --execute "npm run build && npm test"
```

### ⚡ **Faster Release Cycles**

Streamlined workflows enable rapid iterations:

```bash
# Quick patch release
bumpx patch --commit --tag --push

# Feature release with testing
bumpx minor --commit --tag --execute "npm run build && npm test" --push

# Interactive major release
bumpx prompt --commits --commit --tag --sign --push
```

### 🎯 **Consistent Team Workflows**

Standardized configuration ensures consistency:

```json
{
  "commit": true,
  "tag": true,
  "push": false,
  "message": "chore: release v%s",
  "execute": "npm run build && npm test"
}
```

### 📊 **Better Release Tracking**

Comprehensive logging and progress tracking:

```bash
# Verbose output shows every step
bumpx patch --verbose --commits

# Progress callbacks for custom integrations
bumpx.versionBump({
  release: 'minor',
  progress: (event) => {
    console.log(`Step: ${event.event}, Version: ${event.newVersion}`)
  }
})
```

## Use Cases Where bumpx Excels

### 🏢 **Enterprise Development**

- **Security**: Signed commits and tags for compliance
- **Audit trails**: Detailed logging of all operations
- **Cross-platform**: Consistent behavior across dev environments
- **Integration**: Works with existing CI/CD pipelines

### 🚀 **Startup Agility**

- **Rapid iterations**: Quick, reliable releases
- **Simple setup**: Minimal configuration required
- **Flexible workflows**: Adapts to changing needs
- **Cost effective**: No additional infrastructure required

### 🔧 **Open Source Projects**

- **Contributor friendly**: Clear, predictable release process
- **Documentation**: Comprehensive guides and examples
- **Community**: Active support and development
- **Transparency**: Open source with clear roadmap

### 🏗️ **Monorepo Management**

- **Scale**: Handles dozens of packages efficiently
- **Flexibility**: Independent or synchronized versioning
- **Automation**: Bulk operations across packages
- **Coordination**: Manages complex dependency relationships

## Getting Started Benefits

### ⚡ **Quick Setup**

Get running in minutes:

```bash
# Install
npm install -g bumpx

# First release
bumpx patch --commit --tag --push

# That's it!
```

### 📚 **Gentle Learning Curve**

Start simple, add complexity as needed:

```bash
# Week 1: Basic usage
bumpx patch

# Week 2: Add git integration
bumpx minor --commit --tag

# Week 3: Full automation
bumpx major --commit --tag --push --execute "npm run build"
```

### 🔧 **Incremental Adoption**

Integrate gradually into existing workflows:

```bash
# Keep existing process, add bumpx for version updates
bumpx patch --dry-run  # Preview changes first

# Replace manual steps one at a time
bumpx patch --commit   # Replace manual git commits

# Eventually automate everything
bumpx patch --commit --tag --push --execute "npm run deploy"
```

## Future-Proof Choice

### 🔄 **Active Development**

- Regular updates and improvements
- Community-driven feature development
- Responsive issue resolution
- Modern tooling and dependencies

### 🌐 **Growing Ecosystem**

- GitHub Actions integration
- CI/CD platform support
- Plugin architecture (coming soon)
- Third-party integrations

### 📈 **Scalable Architecture**

- Handles projects from single packages to large monorepos
- Performance optimizations for large codebases
- Memory-efficient file processing
- Parallel operations support

## Making the Switch

### 🔄 **Migration Strategies**

**From npm version:**
```bash
# Replace this
npm version patch && git push --tags

# With this
bumpx patch --commit --tag --push
```

**From manual versioning:**
```bash
# Instead of manually editing files
# Use bumpx to handle everything
bumpx patch --files "package.json,VERSION.txt,docs/version.md"
```

**From other tools:**
```bash
# Most tools can be replaced with equivalent bumpx commands
# Check our migration guide for specific examples
```

### 📖 **Learning Resources**

- **Comprehensive documentation** with real-world examples
- **Interactive tutorials** for hands-on learning
- **Video guides** for visual learners
- **Community support** for questions and best practices

### 🛠️ **Support Options**

- **GitHub Discussions** for community help
- **Issue tracking** for bug reports and feature requests
- **Documentation feedback** for continuous improvement
- **Professional support** options available

## Conclusion

bumpx represents the next generation of version management tools, designed for modern development workflows. Whether you're managing a single package or a complex monorepo, working solo or with a large team, bumpx provides the reliability, flexibility, and power you need to streamline your release process.

**Ready to get started?** Check out our [Installation Guide](./install.md) and see the difference bumpx can make in your development workflow.

**Have questions?** Join our community on [Discord](https://discord.gg/stacksjs) or start a [discussion on GitHub](https://github.com/stacksjs/bumpx/discussions).
