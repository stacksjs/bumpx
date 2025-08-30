import { describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { versionBump } from '../src/version-bump'

describe('npm install line replacement', () => {
  it('should correctly update npm install lines with package@version format', async () => {
    // Create unique temp directory to avoid race conditions
    const tempDir = join(tmpdir(), `bumpx-npm-install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tempDir, { recursive: true })

    try {
      // Create package.json
      const packagePath = join(tempDir, 'package.json')
      writeFileSync(packagePath, JSON.stringify({
        name: 'multi-file-test',
        version: '1.2.3',
      }, null, 2))

      // Create README.md with the exact format from the integration test
      const readmePath = join(tempDir, 'README.md')
      writeFileSync(readmePath, `# Multi File Test

Version: 1.2.3

## Installation

Install version 1.2.3 of this package:

\`\`\`bash
npm install multi-file-test@1.2.3
\`\`\`

## Changelog

### v1.2.3
- Initial release
`)

      // Use versionBump to update both files (same as integration tests)
      await versionBump({
        release: 'patch',
        files: [packagePath, readmePath],
        commit: false,
        tag: false,
        push: false,
        noGitCheck: true,
        quiet: true,
      })

      // Read updated README.md
      const updatedReadme = readFileSync(readmePath, 'utf-8')

      // Verify npm install line was updated
      expect(updatedReadme).toContain('npm install multi-file-test@1.2.4')

      // Verify version was updated
      expect(updatedReadme).toContain('Version: 1.2.4')

      // Verify changelog entry was not updated
      expect(updatedReadme).toContain('### v1.2.3')
    }
    finally {
      // Clean up
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
