#!/bin/bash

# Run tests with a hard timeout to prevent CI hangs
# This is a workaround for Bun test runner not exiting properly in CI

set -e

# Start tests in background
bun test --verbose &
TEST_PID=$!

# Wait for tests with timeout
TIMEOUT=300  # 5 minutes
ELAPSED=0
INTERVAL=1

while kill -0 $TEST_PID 2>/dev/null; do
  sleep $INTERVAL
  ELAPSED=$((ELAPSED + INTERVAL))

  if [ $ELAPSED -ge $TIMEOUT ]; then
    echo "Tests exceeded ${TIMEOUT}s timeout, killing process..."
    kill -9 $TEST_PID 2>/dev/null || true
    exit 124  # Standard timeout exit code
  fi
done

# Get exit code
wait $TEST_PID
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo "Tests failed with exit code $EXIT_CODE"
  exit $EXIT_CODE
fi

echo "Tests completed successfully"
exit 0
