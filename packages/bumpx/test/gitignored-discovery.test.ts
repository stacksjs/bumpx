import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { findAllPackageFiles } from '../src/utils'

/**
 * `--recursive` must not reach into trees git ignores.
 *
 * The package.json walk has always honoured .gitignore. The walk beside it —
 * the one that finds pantry.json, package.jsonc and build.zig.zon — did not:
 * `findAdditionalPackageFiles(dir)` was called without the flag.
 *
 * In a repo whose .gitignore hides a package cache, that meant a release
 * rewrote the version of every vendored manifest inside the cache and then
 * handed those paths to `git add`, which refuses ignored paths:
 *
 *   The following paths are ignored by one of your .gitignore files: pantry
 *
 * and the release aborted after the version bumps had already been written to
 * disk. Reproduced against pantry, whose .gitignore hides `pantry/` — 9 vendored
 * build.zig.zon files under it were picked up.
 */

let dir: string

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bumpx-ignore-'))
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'root', version: '1.0.0' }))
  fs.writeFileSync(path.join(dir, '.gitignore'), 'cache\n')

  // A vendored cache the repo ignores, carrying manifests bumpx knows how to bump.
  fs.mkdirSync(path.join(dir, 'cache', 'vendored'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'cache', 'vendored', 'build.zig.zon'), '.{ .version = "0.1.0" }\n')
  fs.writeFileSync(path.join(dir, 'cache', 'pantry.json'), JSON.stringify({ version: '0.1.0' }))
  fs.writeFileSync(path.join(dir, 'cache', 'package.json'), JSON.stringify({ name: 'vendored', version: '0.1.0' }))

  // A tracked package that must still be found.
  fs.mkdirSync(path.join(dir, 'packages', 'real'), { recursive: true })
  fs.writeFileSync(path.join(dir, 'packages', 'real', 'package.json'), JSON.stringify({ name: 'real', version: '1.0.0' }))
  fs.writeFileSync(path.join(dir, 'packages', 'real', 'build.zig.zon'), '.{ .version = "1.0.0" }\n')
})

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true })
})

describe('recursive discovery vs .gitignore', () => {
  it('skips every file under an ignored directory', async () => {
    const found = await findAllPackageFiles(dir, true, true)
    const ignored = found.filter(f => path.relative(dir, f).split(path.sep)[0] === 'cache')

    expect(ignored).toEqual([])
  })

  it('still finds tracked manifests of every supported kind', async () => {
    const found = (await findAllPackageFiles(dir, true, true)).map(f => path.relative(dir, f))

    expect(found).toContain('package.json')
    expect(found).toContain(path.join('packages', 'real', 'package.json'))
    expect(found).toContain(path.join('packages', 'real', 'build.zig.zon'))
  })

  it('honours the opt-out', async () => {
    // respectGitignore: false is still allowed to reach in — the flag exists.
    const found = (await findAllPackageFiles(dir, true, false)).map(f => path.relative(dir, f))

    expect(found.some(f => f.startsWith('cache'))).toBe(true)
  })

  it('does not confuse a matching directory name with a longer package name', async () => {
    const packageDir = path.join(dir, 'packages', 'cacheable')
    fs.mkdirSync(packageDir, { recursive: true })
    fs.writeFileSync(path.join(packageDir, 'package.json'), '{"version":"1.0.0"}\n')
    fs.writeFileSync(path.join(packageDir, 'build.zig.zon'), '.{ .version = "1.0.0" }\n')
    const found = (await findAllPackageFiles(dir, true, true)).map(file => path.relative(dir, file))
    expect(found).toContain(path.join('packages', 'cacheable', 'package.json'))
    expect(found).toContain(path.join('packages', 'cacheable', 'build.zig.zon'))
  })

  it('the ignored tree is exactly what git would refuse to add', async () => {
    // Guard the guard: assert the fixture really is ignored, so a broken
    // .gitignore fixture cannot make this suite pass vacuously.
    const { execFileSync } = await import('node:child_process')
    execFileSync('git', ['init', '-q', dir])

    const check = Bun.spawnSync(['git', '-C', dir, 'check-ignore', 'cache/pantry.json'])
    expect(check.exitCode).toBe(0)
  })
})

for (const pattern of ['/packages/zig/zig-pkg', '/packages/zig/zig-pkg/', '/packages/*/zig-pkg/']) {
  it(`keeps rooted ignore ${pattern} anchored through nested discovery`, async () => {
    fs.writeFileSync(path.join(dir, '.gitignore'), `${pattern}\n`)
    for (const parent of ['packages/zig/zig-pkg/vendor', 'examples/packages/zig/zig-pkg/real']) {
      fs.mkdirSync(path.join(dir, parent), { recursive: true })
      fs.writeFileSync(path.join(dir, parent, 'package.json'), '{"version":"0.1.0"}\n')
      fs.writeFileSync(path.join(dir, parent, 'build.zig.zon'), '.{ .version = "0.1.0" }\n')
    }
    const found = (await findAllPackageFiles(dir, true, true)).map(file => path.relative(dir, file).split(path.sep).join('/'))
    expect(found.filter(file => file.startsWith('packages/zig/zig-pkg/'))).toEqual([])
    expect(found).toContain('examples/packages/zig/zig-pkg/real/package.json')
    expect(found).toContain('examples/packages/zig/zig-pkg/real/build.zig.zon')
  })
}

it('keeps nested ignore anchors relative to their own directory', async () => {
  const local = path.join(dir, 'packages', 'real')
  fs.writeFileSync(path.join(local, '.gitignore'), '/vendor/\n')
  for (const parent of ['vendor/dependency', 'src/vendor/owned']) {
    fs.mkdirSync(path.join(local, parent), { recursive: true })
    fs.writeFileSync(path.join(local, parent, 'package.json'), '{"version":"0.1.0"}\n')
    fs.writeFileSync(path.join(local, parent, 'build.zig.zon'), '.{ .version = "0.1.0" }\n')
  }
  const found = (await findAllPackageFiles(dir, true, true)).map(file => path.relative(local, file).split(path.sep).join('/'))
  expect(found.some(file => file.startsWith('vendor/'))).toBe(false)
  expect(found).toContain('src/vendor/owned/package.json')
  expect(found).toContain('src/vendor/owned/build.zig.zon')
})

it('does not treat a file as a directory-only workspace exclusion', async () => {
  fs.writeFileSync(path.join(dir, '.gitignore'), '/packages/real/package.json/\n')
  fs.writeFileSync(path.join(dir, 'package.json'), '{"version":"1.0.0","workspaces":["packages/*"]}\n')
  const found = await findAllPackageFiles(dir, true, true)
  expect(found).toContain(path.join(dir, 'packages', 'real', 'package.json'))
})
