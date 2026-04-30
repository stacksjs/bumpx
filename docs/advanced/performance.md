# Performance

Bumpx is designed for fast execution with zero dependencies. This guide covers performance characteristics and optimization strategies.

## Performance Characteristics

### Zero Dependencies

Bumpx is built with minimal dependencies for fast startup:

```bash
# Fast startup time
time bumpx --version
# real    0.05s

# Compare with typical npm tools
time npx standard-version --version
# real    1.2s
```

### Compiled Binary

Pre-compiled binaries eliminate Node.js startup overhead:

```bash
# Direct binary execution
./bumpx patch --dry-run

# No npm/bun resolution needed
```

## Benchmarks

### Version Bump Performance

Typical operation times:

| Operation | Time |
|-----------|------|
| Version bump (single file) | ~50ms |
| Version bump (10 files) | ~100ms |
| With git commit | ~150ms |
| With git commit + tag | ~200ms |
| With git commit + tag + push | ~500ms+ |

### Monorepo Performance

Performance with multiple packages:

```bash
# 10 packages
bumpx patch --recursive
# Time: ~200ms

# 50 packages
bumpx patch --recursive
# Time: ~500ms

# 100 packages
bumpx patch --recursive
# Time: ~1s
```

## Optimization Strategies

### Skip Unnecessary Operations

```bash
# Skip confirmation (faster in scripts)
bumpx patch --yes

# Quiet mode (less I/O)
bumpx patch --quiet

# CI mode (combines --yes and --quiet)
bumpx patch --ci
```

### Optimize Git Operations

```bash
# Skip git status check
bumpx patch --no-git-check

# Skip hooks
bumpx patch --commit --no-verify

# Don't push (push separately/manually)
bumpx patch --commit --tag  # no --push
```

### Reduce File Operations

```bash
# Target specific files instead of recursive
bumpx patch --files package.json

# Use explicit file list for large monorepos
bumpx patch --files "packages/core/package.json,packages/cli/package.json"
```

## Parallel Processing

### Concurrent File Updates

Bumpx processes files efficiently:

```ts
// Internal optimization
async function updateFiles(files: string[], version: string) {
  // Files are read/written concurrently where safe
  await Promise.all(
    files.map(file => updateVersion(file, version))
  )
}
```

### Monorepo Optimization

For large monorepos, consider:

```bash
# Specify files explicitly (avoids glob scanning)
bumpx patch --files $(find packages -name package.json -type f | tr '\n' ',')

# Or use workspace-aware approach
bumpx patch --recursive --current-version $(jq -r .version package.json)
```

## Memory Usage

### Efficient Memory Footprint

```bash
# Monitor memory usage
/usr/bin/time -v bumpx patch --dry-run

# Typical: ~30MB peak memory
```

### Large File Handling

For very large files:

```ts
// Files are read as text, not loaded into memory as objects
// Version replacement uses string operations, not JSON parsing
```

## CI/CD Performance

### GitHub Actions Caching

Cache bumpx for faster CI runs:

```yaml

- name: Cache bumpx

  uses: actions/cache@v3
  with:
    path: ~/.bun/bin/bumpx
    key: bumpx-${{ runner.os }}

- name: Install bumpx

  run: |
    if [ ! -f ~/.bun/bin/bumpx ]; then
      bun add -g @stacksjs/bumpx
    fi
```

### Optimized CI Configuration

```yaml

- name: Fast version bump

  run: |
    bumpx ${{ inputs.version }} \
      --ci \
      --no-git-check \
      --commit \
      --tag \
      --push
```

### Parallel CI Jobs

Split operations for faster pipelines:

```yaml
jobs:
  bump:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.bump.outputs.version }}
    steps:

      - name: Bump version

        id: bump
        run: |
          bumpx patch --commit --tag
          echo "version=$(jq -r .version package.json)" >> $GITHUB_OUTPUT

  build:
    needs: bump
    runs-on: ubuntu-latest
    steps:

      - name: Build with new version

        run: bun run build

  test:
    needs: bump
    runs-on: ubuntu-latest
    steps:

      - name: Run tests

        run: bun test
```

## Profiling

### Measure Execution Time

```bash
# Built-in timing
time bumpx patch --dry-run

# Detailed profiling
bumpx patch --dry-run --verbose

# With shell profiling
set -x
bumpx patch
set +x
```

### Debug Mode

```bash
# Enable debug output
DEBUG=bumpx bumpx patch

# Verbose mode shows each step
bumpx patch --verbose --dry-run
```

## Performance Tips

### For Single Packages

```bash
# Fastest: skip all optional features
bumpx patch --yes --quiet --no-git-check

# Standard: with git but no push
bumpx patch --commit --tag --yes
```

### For Monorepos

```bash
# Pre-compute file list
FILES=$(find packages -name package.json | head -50 | tr '\n' ',')
bumpx patch --files "$FILES" --yes

# Use current-version to skip detection
bumpx patch --recursive --current-version 1.0.0 --yes
```

### For CI/CD

```bash
# CI-optimized flags
bumpx patch \
  --ci \
  --no-git-check \
  --commit \
  --tag \
  --push
```

## Comparison with Alternatives

### vs npm version

```bash
# bumpx (compiled)
time bumpx patch
# ~100ms

# npm version (Node.js)
time npm version patch
# ~800ms
```

### vs bumpp

```bash
# bumpx
time bumpx patch --commit --tag
# ~200ms

# bumpp
time npx bumpp patch
# ~1.5s
```

### vs standard-version

```bash
# bumpx with changelog
time bumpx patch --execute "npx conventional-changelog -p angular -i CHANGELOG.md -s"
# ~2s

# standard-version
time npx standard-version
# ~3s
```

## Best Practices

1. **Use CI Mode**: Always use `--ci` in automated environments
2. **Skip Unnecessary Checks**: Use `--no-git-check` when appropriate
3. **Explicit File Lists**: Specify files directly for large projects
4. **Cache Binary**: Cache bumpx installation in CI
5. **Parallel Operations**: Split CI jobs for faster pipelines
6. **Profile First**: Measure before optimizing
7. **Quiet Mode**: Use `--quiet` for scripts that don't need output
8. **Avoid Push**: Handle push separately if not always needed
