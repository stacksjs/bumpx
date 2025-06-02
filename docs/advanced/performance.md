# Performance Optimization

bumpx is designed to be efficient, but there are several ways to optimize its performance for different scenarios.

## Reducing Installation Time

### Parallel Installations

When installing multiple packages, consider splitting them into batches, _when useful_:

```bash
# Instead of installing all at once
bumpx install node@22 python@3.12 ruby@3.3 go@1.23 rust@1.82

# Split into parallel installations
bumpx install node@22 python@3.12 &
bumpx install ruby@3.3 go@1.23 rust@1.82 &
wait
```

### Installation Location

Installing to a location that doesn't require sudo can be faster:

```bash
# Use a user-specific installation location
bumpx install --path ~/.local node@22
```

### Force Reinstall Wisely

The `--force` flag bypasses existing installation checks, which can be slower:

```bash
# Only use force when needed
bumpx install --force node  # Only when you actually need to reinstall
```

## Optimizing Shim Performance

### Direct Shims

For frequently used binaries, consider using direct shims that don't require the full pkgx resolution:

```bash
# Create a custom efficient shim
cat > ~/.local/bin/node << EOF
#!/bin/sh
# Direct path to reduce overhead
exec ~/.pkgx/pkgx.sh/node/v16.14.2/bin/node "$@"
EOF
chmod +x ~/.local/bin/node
```

### Optimized PATH Order

Arrange your PATH for optimal lookup performance:

```bash
# Put frequently used directories earlier in your PATH
export PATH="~/.local/bin:$PATH"  # This will be checked first
```

## Cache Management

### Clear pkgx Cache

pkgx maintains its own cache that can sometimes become large:

```bash
# Clear pkgx cache
rm -rf ~/.pkgx/cache/*
```

### Optimize Download Cache

Preserve downloaded packages to avoid re-downloading:

```bash
# Set environment variable to preserve downloads
export PKGX_KEEP_DOWNLOADS=1
bumpx install node@22
```

## Configuration Optimization

### Disable Verbose Logging

Verbose logging adds overhead:

```bash
# In configuration
{
  "verbose": false
}

# Or on the command line
bumpx install --no-verbose node
```

### Adjust Timeout and Retries

Optimize timeout and retry settings for your network conditions:

```bash
# In configuration
{
  "timeout": 30000,  # 30 seconds instead of default 60
  "maxRetries": 2    # Only retry twice instead of default 3
}
```

## Memory Usage Optimization

### Clean Up After Large Installations

Some packages can consume significant memory during installation:

```bash
# After installing large packages, run garbage collection
bumpx pkgx  # Reinstall pkgx to clean up
```

## Auto-update Configuration

Disable auto-updates if you prefer manual control:

```bash
# Disable auto-updates
bumpx autoupdate:disable
```

## System-Specific Optimizations

### macOS

On macOS, prefer `/usr/local` for system-wide installations:

```bash
# Use /usr/local on macOS
bumpx install --path /usr/local node@22
```

### Linux

On Linux, prefer user-specific installations unless you need system-wide access:

```bash
# Use ~/.local on Linux for user-specific installations
bumpx install --path ~/.local node@22
```

### Windows

On Windows, prefer shorter paths to avoid path length limitations:

```bash
# Use a shorter path on Windows
bumpx install --path C:\pkgs node@22
```

## CI/CD Pipeline Optimization

For continuous integration environments:

```bash
# Install only what you need
bumpx install node  # Just the specific package

# Use a persistent cache directory
PKGX_CACHE_DIR=/ci-cache bumpx install node@22@22
```

## Monitoring Performance

You can time bumpx commands to identify bottlenecks:

```bash
# Time a command
time bumpx install node@22@22

# More detailed profiling
/usr/bin/time -v bumpx install node@22@22
```

## Network Performance

If you're in an environment with limited bandwidth:

```bash
# Set a longer timeout
bumpx install --timeout 120000 node@22  # 2 minutes
```

## Environment Management Performance

### Environment Cleanup

Regular environment cleanup improves performance and saves disk space:

```bash
# Clean up old environments regularly
bumpx env:clean --older-than 7 --force

# Preview cleanup to understand disk usage
bumpx env:clean --dry-run
```

### Environment Hash Optimization

The new readable hash format is more efficient than the old base64 format:

- **Faster directory lookups** - Shorter, more predictable names
- **Better filesystem performance** - Avoids special characters that can slow down some filesystems
- **Reduced memory usage** - Shorter strings use less memory in directory listings

### Monitoring Environment Disk Usage

Track environment disk usage to identify cleanup opportunities:

```bash
# List environments sorted by size (requires jq)
bumpx env:list --format json | jq -r 'sort_by(.size) | reverse | .[] | "\(.projectName): \(.size)"'

# Find large environments
bumpx env:list --verbose | grep -E '[0-9]+[0-9][0-9]M|[0-9]+G'
```

### Optimizing Environment Activation

For faster environment activation:

```bash
# Use the fast activation path when packages are already installed
# This automatically happens when you re-enter a project directory
cd my-project  # Fast activation if environment already exists
```

### Environment Storage Location

Consider the storage location for environments:

```bash
# Use faster storage for environments if available
export bumpx_ENV_BASE_DIR=/fast-ssd/bumpx/envs
```

### Batch Environment Operations

When managing multiple environments:

```bash
# Use JSON output for efficient scripting
envs=$(bumpx env:list --format json)
echo "$envs" | jq -r '.[] | select(.packages == 0) | .hash' | xargs -I {} bumpx env:remove {} --force
```
