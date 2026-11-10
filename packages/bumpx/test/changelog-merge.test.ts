import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractReleaseNotes, mergeChangelog } from '../src/version-bump'

const older = `[Compare changes](https://github.com/acme/app/compare/v1.0.0...v1.1.0)

## 🐛 Bug Fixes

- keep the door closed ([abc1234](https://github.com/acme/app/commit/abc1234))
`
const newer = `[Compare changes](https://github.com/acme/app/compare/v1.1.0...v1.2.0)

## ✨ Features

- open the window ([def5678](https://github.com/acme/app/commit/def5678))
`

describe('mergeChangelog', () => {
  it('keeps what the generator wrote when it already holds the history', () => {
    for (const title of ['# Changelog', '# Stacks Changelog', '# Acme release notes']) {
      const existing = `${title}\n\n${older}`
      const generated = `${title}\n\n${newer}\n${older}`
      expect(mergeChangelog(existing, generated)).toBe(generated)
    }
  })

  it('does not double a changelog whose title is not "# Changelog"', () => {
    const existing = `# Stacks Changelog\n\n${older}`
    const merged = mergeChangelog(`${existing}\n\n`, `# Stacks Changelog\n\n${newer}\n${older}`)
    expect(merged.match(/keep the door closed/g)).toHaveLength(1)
    expect(merged.match(/^# /gm)).toHaveLength(1)
  })

  it('puts the history back, newest first, under a generator that overwrote the file', () => {
    const merged = mergeChangelog(`# Changelog\n\n${older}`, `# Changelog\n\n${newer}`)
    expect(merged.indexOf('open the window')).toBeLessThan(merged.indexOf('keep the door closed'))
    expect(merged.match(/^# /gm)).toHaveLength(1)
    expect(merged.endsWith('\n')).toBe(true)
  })

  it('returns the generated changelog when there was none', () => {
    expect(mergeChangelog('', `# Changelog\n\n${newer}`)).toBe(`# Changelog\n\n${newer}`)
    expect(mergeChangelog('# Changelog\n', newer)).toBe(newer)
  })
})

describe('extractReleaseNotes', () => {
  const changelog = `# Stacks Changelog\n\n${newer}\n${older}`

  it('cuts one release out of a logsmith changelog, from its compare line to the next', () => {
    const notes = extractReleaseNotes(changelog, '1.2.0')
    expect(notes.startsWith('[Compare changes](https://github.com/acme/app/compare/v1.1.0...v1.2.0)')).toBe(true)
    expect(notes).toContain('open the window')
    expect(notes).not.toContain('keep the door closed')
    expect(extractReleaseNotes(changelog, '1.1.0')).toContain('keep the door closed')
    expect(extractReleaseNotes(changelog, 'v1.1.0')).not.toContain('open the window')
  })

  it('never answers with another release', () => {
    expect(extractReleaseNotes(changelog, '1.3.0')).toBe('')
    // 1.2.0 is not 1.2.01 or 11.2.0, and the release a range starts from is not the release it describes.
    expect(extractReleaseNotes(changelog, '1.2')).toBe('')
    expect(extractReleaseNotes(changelog, '1.0.0')).toBe('')
  })

  it('follows a custom tag such as a mobile build tag', () => {
    const builds = `# App\n\n[Compare changes](https://github.com/acme/app/compare/v1.0.0-build.19...v1.0.0-build.20)\n\n## ✨ Features\n\n- twenty\n\n[Compare changes](https://github.com/acme/app/compare/v1.0.0-build.2...v1.0.0-build.19)\n\n## ✨ Features\n\n- nineteen\n`
    expect(extractReleaseNotes(builds, '1.0.0-build.20', 'v1.0.0-build.20')).toContain('twenty')
    expect(extractReleaseNotes(builds, '1.0.0-build.20', 'v1.0.0-build.20')).not.toContain('nineteen')
    expect(extractReleaseNotes(builds, '1.0.0-build.2', 'v1.0.0-build.2')).toBe('')
    expect(extractReleaseNotes(builds, '20', 'app-build-20')).toBe('')
  })

  it('reads a changelog that titles each release', () => {
    const titled = '# Changelog\n\n## [1.2.0] - 2026-11-10\n\n### Added\n\n- open the window\n\n## v1.1.0\n\n- keep the door closed\n'
    expect(extractReleaseNotes(titled, '1.2.0')).toBe('## [1.2.0] - 2026-11-10\n\n### Added\n\n- open the window')
    expect(extractReleaseNotes(titled, '1.1.0')).toBe('## v1.1.0\n\n- keep the door closed')
    expect(extractReleaseNotes(titled, '1.2')).toBe('')
  })
})

describe('a release in a repository whose changelog has its own title', () => {
  it('adds one section, keeps the history once, and tags the release with its own notes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'bumpx-titled-changelog-'))
    const run = (args: string[]) => spawnSync(args[0]!, args.slice(1), { cwd: dir, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production', BUN_ENV: 'production' }, timeout: 60_000 })
    try {
      run(['git', 'init', '-b', 'main'])
      run(['git', 'config', 'user.name', 'Fixture'])
      run(['git', 'config', 'user.email', 'fixture@example.com'])
      run(['git', 'remote', 'add', 'origin', 'https://github.com/acme/app.git'])
      writeFileSync(join(dir, 'package.json'), `${JSON.stringify({ name: 'app', version: '1.0.0-build.19' }, null, 2)}\n`)
      writeFileSync(join(dir, 'CHANGELOG.md'), `# Stacks Changelog\n\n${older}`)
      run(['git', 'add', '.'])
      run(['git', 'commit', '-m', 'feat: first'])
      run(['git', 'tag', 'v1.0.0-build.19'])
      writeFileSync(join(dir, 'note.txt'), 'x')
      run(['git', 'add', '.'])
      run(['git', 'commit', '-m', 'feat: open the hatch'])
      const released = run([process.execPath, fileURLToPath(new URL('../bin/cli.ts', import.meta.url)), '1.0.0-build.20', '--commit', '--commit-message', 'chore(release): v%s', '--tag', '--tag-name', 'v%s', '--yes', '--no-push'])
      expect(released.status).toBe(0)
      const changelog = readFileSync(join(dir, 'CHANGELOG.md'), 'utf8')
      expect(changelog.match(/^# /gm)).toHaveLength(1)
      expect(changelog.match(/keep the door closed/g)).toHaveLength(1)
      expect(changelog.indexOf('open the hatch')).toBeGreaterThan(-1)
      expect(changelog.indexOf('open the hatch')).toBeLessThan(changelog.indexOf('keep the door closed'))
      expect(run(['git', 'log', '-1', '--format=%s']).stdout.trim()).toBe('chore(release): v1.0.0-build.20')
      expect(run(['git', 'show', '--name-only', '--format=', 'HEAD']).stdout).toContain('CHANGELOG.md')
      const message = run(['git', 'tag', '-l', '--format=%(contents)', 'v1.0.0-build.20']).stdout
      expect(message).toContain('open the hatch')
      expect(message).not.toContain('keep the door closed')
      // git drops lines starting with # from a tag message unless told otherwise.
      expect(message).toMatch(/^## .*Features/m)
    }
    finally { rmSync(dir, { recursive: true, force: true }) }
  })
})
