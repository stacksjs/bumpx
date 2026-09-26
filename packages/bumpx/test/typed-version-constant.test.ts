/**
 * A version constant with a TypeScript annotation is a version.
 *
 * `export const TRACKER_VERSION: string = '0.1.15'` matched none of the
 * detection patterns, so `bumpx patch package.json src/version.ts` bumped the
 * manifest, warned "Could not determine version", and skipped the constant.
 * ts-analytics' build refuses to publish when the two disagree, so its v0.1.16
 * tag never reached npm.
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { detectVersionInText } from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('detectVersionInText', () => {
  it('reads a typed constant', () => {
    expect(detectVersionInText(`export const TRACKER_VERSION: string = '0.1.15'`)).toBe('0.1.15')
    expect(detectVersionInText(`export const VERSION: Readonly<string> = "4.5.6"`)).toBe('4.5.6')
  })

  it('still reads the forms it always did', () => {
    expect(detectVersionInText(`VERSION = '1.2.3'`)).toBe('1.2.3')
    expect(detectVersionInText(`version: 2.0.0-beta.1`)).toBe('2.0.0-beta.1')
    expect(detectVersionInText('1.0.0\n')).toBe('1.0.0')
  })

  it('keeps build metadata whole', () => {
    // The class was [a-z0.9\-], a typo that stopped at the first digit past 0.
    expect(detectVersionInText(`const version = "3.4.5+build.27"`)).toBe('3.4.5+build.27')
  })

  it('answers undefined for a file that names no version', () => {
    expect(detectVersionInText('export const answer = 42')).toBeUndefined()
  })
})

describe('bumping a typed version constant', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `bumpx-typed-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(join(dir, 'src'), { recursive: true })
  })

  afterEach(() => {
    if (existsSync(dir))
      rmSync(dir, { recursive: true, force: true })
  })

  it('bumps the constant alongside package.json', async () => {
    writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'x', version: '0.1.15' }, null, 2))
    writeFileSync(join(dir, 'src/version.ts'), `// Bump this with package.json.\nexport const TRACKER_VERSION: string = '0.1.15'\n`)

    await versionBump({
      release: 'patch',
      files: [join(dir, 'package.json'), join(dir, 'src/version.ts')],
      cwd: dir,
      commit: false,
      tag: false,
      push: false,
      noGitCheck: true,
    })

    expect(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version).toBe('0.1.16')
    expect(readFileSync(join(dir, 'src/version.ts'), 'utf8')).toContain(`TRACKER_VERSION: string = '0.1.16'`)
  })
})
