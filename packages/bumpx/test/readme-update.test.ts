import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { updateVersionInFile } from '../src/utils'

describe('README.md Version Updates', () => {
  let tempDir: string

  beforeEach(() => {
    // Create unique temp directory to avoid race conditions
    tempDir = join(process.cwd(), 'test', `temp-readme-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    // Clean up temp directory
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('should update npm install lines in README.md', () => {
    // Create a test README.md with npm install line
    const readmePath = join(tempDir, 'README.md')
    writeFileSync(readmePath, `# Test Package
    
Version: 1.2.3

## Installation

Install version 1.2.3 of this package:

\`\`\`bash
npm install test-package@1.2.3
\`\`\`

## Changelog

### v1.2.3
- Initial release
`)

    // Update version in README.md
    updateVersionInFile(readmePath, '1.2.3', '1.3.0')

    // Read updated README.md
    const updatedReadme = readFileSync(readmePath, 'utf-8')

    // Verify npm install line was updated
    expect(updatedReadme).toContain('npm install test-package@1.3.0')

    // Verify version was updated
    expect(updatedReadme).toContain('Version: 1.3.0')

    // Verify changelog entry was not updated
    expect(updatedReadme).toContain('### v1.2.3')
  })
})
