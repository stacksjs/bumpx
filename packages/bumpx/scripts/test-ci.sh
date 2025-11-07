#!/bin/bash

# Run tests with a hard timeout to prevent CI hangs
# This is a workaround for Bun test runner not exiting properly in CI

set -e

# Change to package directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PACKAGE_DIR"

echo "Starting tests from: $PACKAGE_DIR"
echo "Using timeout protection (180s)..."

# Use timeout command directly - more reliable than background job monitoring
# Kill after 180 seconds (3 minutes) to give buffer before GitHub Actions timeout
if timeout --foreground 180 bun test; then
  echo "✓ Tests completed successfully"
  exit 0
else
  EXIT_CODE=$?
  if [ $EXIT_CODE -eq 124 ]; then
    echo "✗ Tests timed out after 180 seconds"
    echo "This likely indicates the Bun test runner hung after tests completed"
    exit 124
  else
    echo "✗ Tests failed with exit code $EXIT_CODE"
    exit $EXIT_CODE
  fi
fi
