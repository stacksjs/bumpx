import { afterEach, beforeEach, describe, expect, it, spyOn } from 'bun:test'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { versionBump } from '../src/version-bump'

describe('Progress Visual Output', () => {
  let tempDir: string
  let consoleSpy: any

  beforeEach(() => {
    tempDir = join(tmpdir(), `bumpx-progress-${Date.now()}`)
    mkdirSync(tempDir, { recursive: true })
    consoleSpy = spyOn(console, 'log')
    // basic repo indicators are mocked via utils in other tests; not needed here
    const pkg = { name: 'pkg', version: '0.4.36' }
    writeFileSync(join(tempDir, 'package.json'), JSON.stringify(pkg, null, 2))
  })

  afterEach(() => {
    if (existsSync(tempDir))
      rmSync(tempDir, { recursive: true, force: true })
    consoleSpy.mockRestore()
  })

  it('prints the new visual in dry-run (non-verbose)', async () => {
    await versionBump({
      release: 'patch',
      cwd: tempDir,
      dryRun: true,
      commit: true,
      tag: true,
      push: true,
      noGitCheck: true,
      printCommits: false,
      verbose: false,
    })

    const out = consoleSpy.mock.calls.flat().join('\n')
    expect(out).toContain('🔍 [DRY RUN] Reading package.json...')
    // In multi-version mode we don't emit current version line
    // Verify new visual format
    expect(out).toContain('🎉 [DRY RUN] Successfully released v0.4.37!')
    expect(out).toContain('✅ Updated package.json')
  })
})
