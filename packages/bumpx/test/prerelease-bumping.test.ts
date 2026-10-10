import { describe, expect, test } from 'bun:test'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { nextBuildNumber, SemVer } from '../src/semver'

describe('prerelease and build versioning', () => {
  test('tests and graduates the same target release', () => {
    let version = new SemVer('1.0.0')
    version = version.inc('pre', 'beta')
    expect(version.toString()).toBe('1.0.0-beta.0')
    version = version.inc('prerelease')
    expect(version.toString()).toBe('1.0.0-beta.1')
    version = version.inc('pre', 'rc')
    expect(version.toString()).toBe('1.0.0-rc.0')
    expect(version.inc('release').toString()).toBe('1.0.0')
    expect(() => new SemVer('1.0.0').inc('release')).toThrow('already a stable release')
  })

  test('promotes prereleases at the requested semantic boundary', () => {
    expect(new SemVer('1.0.0-beta.3').inc('major').toString()).toBe('1.0.0')
    expect(new SemVer('1.2.0-beta.3').inc('minor').toString()).toBe('1.2.0')
    expect(new SemVer('1.2.3-beta.3').inc('patch').toString()).toBe('1.2.3')
    expect(new SemVer('1.2.3').inc('prerelease', 'beta').toString()).toBe('1.2.4-beta.0')
  })

  test('calculating options never changes the original arrays or version', () => {
    const original = new SemVer('1.0.0-beta.2+build.11')
    expect(original.inc('prerelease').toString()).toBe('1.0.0-beta.3')
    expect(original.inc('pre', 'rc').toString()).toBe('1.0.0-rc.0')
    expect(original.inc('build').toString()).toBe('1.0.0-beta.2+build.12')
    expect(original.toString()).toBe('1.0.0-beta.2+build.11')
    expect(original.version).toBe('1.0.0-beta.2+build.11')
  })

  test('increments the rightmost counter exactly and validates identifiers', () => {
    expect(new SemVer('1.0.0-beta.9007199254740993.tail').inc('pre').toString()).toBe('1.0.0-beta.9007199254740994.tail')
    expect(new SemVer('1.0.0-beta.2').inc('pre', 'rc.preview').toString()).toBe('1.0.0-rc.preview.0')
    for (const id of ['', 'rc..preview', 'bad id', '01'])
      expect(() => new SemVer('1.0.0-beta.2').inc('pre', id)).toThrow()
    expect(() => new SemVer('9007199254740992.0.0')).toThrow()
    expect(() => new SemVer('1.0.9007199254740991').inc('patch')).toThrow()
  })

  test('builds retain the core version and platform counters account for allocated runs', () => {
    expect(new SemVer('1.0.0').inc('build').toString()).toBe('1.0.0+build.1')
    expect(new SemVer('1.0.0+ci.009').inc('build').toString()).toBe('1.0.0+ci.10')
    expect(nextBuildNumber(10, [11, 12, 8])).toBe(13)
    expect(nextBuildNumber(0)).toBe(1)
    for (const number of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])
      expect(() => nextBuildNumber(number)).toThrow()
    expect(() => nextBuildNumber(10, [NaN])).toThrow()
  })

  test('CLI updates prereleases, builds and stable graduation through real files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'bumpx-prerelease-'))
    const pkg = join(root, 'package.json')
    const cli = join(import.meta.dir, '../bin/cli.ts')
    try {
      await writeFile(pkg, JSON.stringify({ name: 'pre-release-app', version: '1.0.0' }))
      for (const [args, expected] of [
        [['pre', '--preid', 'beta'], '1.0.0-beta.0'],
        [['pre'], '1.0.0-beta.1'],
        [['build'], '1.0.0-beta.1+build.1'],
        [['build', '--dry-run'], '1.0.0-beta.1+build.1'],
        [['release'], '1.0.0'],
      ] as const) {
        const child = Bun.spawn([process.execPath, cli, ...args, '--no-recursive', '--no-commit', '--no-tag', '--no-push', '--no-changelog', '--yes'], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
        const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
        expect(code, `${stdout}\n${stderr}`).toBe(0)
        expect(JSON.parse(await readFile(pkg, 'utf8')).version).toBe(expected)
      }
    }
    finally { await rm(root, { recursive: true, force: true }) }
  })
})
