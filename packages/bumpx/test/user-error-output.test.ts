import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

/**
 * A mistyped or missing release type is a one-line mistake, and its output
 * should be one line. These tests pin that down end to end, because the way it
 * went wrong was not in the message: the message was right, and then the
 * runtime printed six lines of context around the throw that produced it —
 * which, from a minified bundle, is tens of kilobytes of JavaScript on one
 * line each, enough to scroll the message off the screen.
 *
 * Locally these run against bin/cli.ts; in CI, against the built dist, where a
 * regression in either the validation path or the bundle's readability shows up
 * as a code frame in the assertions below.
 */
describe('user-input error output', () => {
  let tempDir: string

  const cliSource = resolve(import.meta.dir, '../bin/cli.ts')
  const cliBuilt = resolve(import.meta.dir, '../dist/bin/cli.js')
  const cli = process.env.CI ? cliBuilt : cliSource

  const stripAnsi = (text: string) => text.replace(/\u001B\[[0-9;]*m/g, '')

  // Keep the child's environment free of NODE_ENV=test: the prompt paths
  // short-circuit under it, and these cases are about what a user sees.
  const runCLI = async (args: string[], timeoutMs = 20_000) => {
    const child = Bun.spawn([process.execPath, cli, ...args], {
      cwd: tempDir,
      // Not a TTY, exactly as in a CI job or any piped invocation.
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        HOME: process.env.HOME!,
        PATH: process.env.PATH!,
        TMPDIR: tempDir,
        GIT_TERMINAL_PROMPT: '0',
      },
    })

    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, timeoutMs)

    try {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return {
        exitCode,
        stdout: stripAnsi(stdout),
        stderr: stripAnsi(stderr),
        output: stripAnsi(stdout + stderr),
        timedOut,
      }
    }
    finally {
      clearTimeout(timer)
    }
  }

  // Bun prints a throw as numbered source lines plus an `at` stack. Neither
  // belongs in the output for a bad argument.
  const expectNoCodeFrame = (output: string) => {
    expect(output).not.toMatch(/^\s*\d+\s\|/m)
    expect(output).not.toMatch(/^\s+at\s/m)
    expect(output).not.toContain('Unhandled Rejection')
    expect(output).not.toContain('Uncaught Exception')
  }

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'bumpx-user-error-'))
    writeFileSync(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'fixture', version: '1.0.0' }, null, 2),
    )
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('reports a mistyped release type in one line, with no code frame', async () => {
    const result = await runCLI(['not-a-release', '--no-git-check'])

    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid release type or version: not-a-release')
    expectNoCodeFrame(result.output)
  })

  it('offers the valid release types alongside the complaint', async () => {
    const result = await runCLI(['not-a-release', '--no-git-check'])

    expect(result.stderr).toContain('patch')
    expect(result.stderr).toContain('bumpx 1.2.3')
    expect(result.stderr).toContain('bumpx --help')
  })

  it('asks for a release type instead of hanging on the prompt without a TTY', async () => {
    const result = await runCLI(['--no-git-check'])

    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Release type or version must be specified')
    expect(result.stderr).toContain('not a TTY')
    expectNoCodeFrame(result.output)
  })

  it('refuses before synchronizing or reading manifests', async () => {
    const result = await runCLI(['', 'package.json'])

    expect(result.timedOut).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.output).toContain('Release type or version must be specified')
    // The complaint used to arrive underneath a screen of release progress,
    // after a pull that a missing release type invalidates anyway.
    expect(result.output).not.toContain('Synchronizing with remote')
    expect(result.output).not.toContain('Reading package.json')
    expectNoCodeFrame(result.output)
  })

  it('states the problem exactly once', async () => {
    const result = await runCLI(['', 'package.json'])

    const occurrences = result.output.split('Release type or version must be specified').length - 1
    expect(occurrences).toBe(1)
  })
})
