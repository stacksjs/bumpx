import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const cli = resolve(import.meta.dir, '../bin/cli.ts')
let repo: string

function git(...args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim()
}

function prepare(...args: string[]): void {
  const result = Bun.spawnSync([process.execPath, cli, 'patch', '--yes', '--no-push', ...args], {
    cwd: repo,
    env: { ...process.env, NODE_ENV: 'production', BUN_ENV: 'production' },
  })
  expect(`${result.stdout}${result.stderr}`).not.toContain('Failed to generate changelog')
  expect(result.exitCode).toBe(0)
  expect(JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version).toBe('1.0.1')
  expect(readFileSync(join(repo, 'CHANGELOG.md'), 'utf8')).toContain('keep prepared releases uncommitted')
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'bumpx-no-commit-'))
  git('init', '-q', '-b', 'main')
  git('config', 'user.name', 'Release Test')
  git('config', 'user.email', 'release@example.com')
  writeFileSync(join(repo, 'package.json'), `${JSON.stringify({ name: 'fixture', version: '1.0.0' })}\n`)
  git('add', 'package.json')
  git('commit', '-qm', 'chore: initial release')
  git('tag', 'v1.0.0')
  writeFileSync(join(repo, 'README.md'), '# Release fixture\n')
  git('add', 'README.md')
  git('commit', '-qm', 'fix: keep prepared releases uncommitted')
})

afterEach(() => rmSync(repo, { recursive: true, force: true }))

describe('changelog commit ownership', () => {
  it('keeps HEAD, existing tags and the index intact with all Git writes disabled', () => {
    writeFileSync(join(repo, 'notes.txt'), 'unrelated staged work\n')
    git('add', 'notes.txt')
    const head = git('rev-parse', 'HEAD')
    const index = git('write-tree')
    const tags = git('show-ref', '--tags')

    prepare('--no-commit', '--no-tag', '--no-git-check')

    expect(git('rev-parse', 'HEAD')).toBe(head)
    expect(git('write-tree')).toBe(index)
    expect(git('show-ref', '--tags')).toBe(tags)
    expect(git('status', '--porcelain')).toContain('?? CHANGELOG.md')
  }, 20_000)

  it('does not commit or amend when a tag is requested without a commit', () => {
    const head = git('rev-parse', 'HEAD')
    const index = git('write-tree')

    prepare('--no-commit')

    expect(git('rev-parse', 'HEAD')).toBe(head)
    expect(git('rev-parse', 'v1.0.1^{}')).toBe(head)
    expect(git('write-tree')).toBe(index)
    expect(git('status', '--porcelain')).toContain('?? CHANGELOG.md')
  }, 20_000)

  it('amends only the release commit created by the current invocation', () => {
    const head = git('rev-parse', 'HEAD')
    prepare('--no-tag')

    expect(git('rev-parse', 'HEAD^')).toBe(head)
    expect(git('show', 'HEAD:package.json')).toContain('1.0.1')
    expect(git('show', 'HEAD:CHANGELOG.md')).toContain('keep prepared releases uncommitted')
    expect(git('status', '--porcelain')).toBe('')
    expect(git('tag', '--list')).toBe('v1.0.0')
  }, 20_000)
})
