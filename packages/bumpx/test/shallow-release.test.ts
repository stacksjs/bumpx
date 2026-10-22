import { afterEach, expect, it } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const cli = resolve(import.meta.dir, '../bin/cli.ts')
const owned: string[] = []
afterEach(() => {
  for (const root of owned.splice(0)) rmSync(root, { recursive: true, force: true })
})
function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
}

it('rejects an incomplete changelog history before changing release files or refs', () => {
  const root = mkdtempSync(join(tmpdir(), 'bumpx-shallow-release-'))
  owned.push(root)
  const writer = join(root, 'writer')
  const publisher = join(root, 'publisher')
  const origin = join(root, 'origin.git')
  execFileSync('git', ['init', '-q', '-b', 'main', writer])
  git(writer, 'config', 'user.name', 'Release Fixture')
  git(writer, 'config', 'user.email', 'fixture@example.invalid')
  writeFileSync(join(writer, 'package.json'), JSON.stringify({ name: 'history-fixture', version: '1.0.0' }) + '\n')
  writeFileSync(join(writer, 'CHANGELOG.md'), '# Changelog\n')
  git(writer, 'add', '.')
  git(writer, 'commit', '-qm', 'feat: initial release')
  git(writer, 'tag', 'v1.0.0')
  writeFileSync(join(writer, 'feature.txt'), 'changed after the published tag\n')
  git(writer, 'add', '.')
  git(writer, 'commit', '-qm', 'fix: corrected behavior')
  execFileSync('git', ['clone', '-q', '--bare', writer, origin])
  execFileSync('git', ['clone', '-q', '--depth', '1', pathToFileURL(origin).href, publisher])
  git(publisher, 'config', 'user.name', 'Release Fixture')
  git(publisher, 'config', 'user.email', 'fixture@example.invalid')
  expect(git(publisher, 'rev-parse', '--is-shallow-repository')).toBe('true')
  const before = git(publisher, 'rev-parse', 'HEAD')
  const manifest = readFileSync(join(publisher, 'package.json'), 'utf8')
  const changelog = readFileSync(join(publisher, 'CHANGELOG.md'), 'utf8')
  const child = Bun.spawnSync([process.execPath, cli, 'patch', '--commit', '--tag', '--yes', '--no-recursive', '--no-git-check'], {
    cwd: publisher, stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
  })
  const output = child.stdout.toString() + child.stderr.toString()
  expect(output).toContain('complete Git history')
  expect(child.exitCode).not.toBe(0)
  expect(readFileSync(join(publisher, 'package.json'), 'utf8')).toBe(manifest)
  expect(readFileSync(join(publisher, 'CHANGELOG.md'), 'utf8')).toBe(changelog)
  expect(git(publisher, 'rev-parse', 'HEAD')).toBe(before)
  expect(git(publisher, 'tag', '--list')).toBe('')
  expect(git(publisher, 'status', '--porcelain')).toBe('')
  expect(git(origin, 'rev-parse', 'HEAD')).toBe(before)
  expect(git(origin, 'tag', '--list')).toBe('v1.0.0')
  git(publisher, 'fetch', '--unshallow', '--tags', 'origin')
  expect(git(publisher, 'rev-parse', '--is-shallow-repository')).toBe('false')
  const complete = Bun.spawnSync([process.execPath, cli, 'patch', '--commit', '--tag', '--yes', '--no-recursive', '--no-git-check'], {
    cwd: publisher, stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
  })
  expect(complete.exitCode).toBe(0)
  expect(JSON.parse(readFileSync(join(publisher, 'package.json'), 'utf8')).version).toBe('1.0.1')
  expect(readFileSync(join(publisher, 'CHANGELOG.md'), 'utf8')).toMatch(/corrected behavior/i)
  expect(git(origin, 'rev-parse', 'v1.0.1^{commit}')).toBe(git(publisher, 'rev-parse', 'HEAD'))
}, 40_000)
