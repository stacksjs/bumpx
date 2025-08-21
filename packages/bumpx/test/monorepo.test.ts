import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ProgressEvent } from '../src/types'
import { findPackageJsonFiles } from '../src/utils'
import { versionBump } from '../src/version-bump'

describe('Monorepo Integration Tests', () => {
  let tempDir: string
  let progressEvents: any[]
  let originalCwd: string

  beforeEach(() => {
    originalCwd = process.cwd()
    tempDir = join(tmpdir(), `bumpx-monorepo-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`)
    mkdirSync(tempDir, { recursive: true })
    progressEvents = []
    process.chdir(tempDir)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  const createProgressCallback = () => (progress: any) => {
    progressEvents.push(progress)
  }

  describe('Workspace Discovery', () => {
    it('should discover packages in a typical monorepo structure', async () => {
      // Create root package.json
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'my-monorepo',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*', 'apps/*'],
      }, null, 2))

      // Create packages
      const packagesDir = join(tempDir, 'packages')
      mkdirSync(packagesDir, { recursive: true })

      const packages = ['core', 'utils', 'ui', 'cli']
      packages.forEach((pkg) => {
        const pkgDir = join(packagesDir, pkg)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg}`,
          version: '1.0.0',
          main: 'index.js',
        }, null, 2))
      })

      // Create apps
      const appsDir = join(tempDir, 'apps')
      mkdirSync(appsDir, { recursive: true })

      const apps = ['web', 'api', 'docs']
      apps.forEach((app) => {
        const appDir = join(appsDir, app)
        mkdirSync(appDir, { recursive: true })
        writeFileSync(join(appDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${app}`,
          version: '1.0.0',
          private: true,
        }, null, 2))
      })

      const files = await findPackageJsonFiles(tempDir, true)

      // Should find root + 4 packages + 3 apps = 8 total
      expect(files.length).toBe(8)
      expect(files.some(f => f.endsWith('package.json') && !f.includes('packages') && !f.includes('apps'))).toBe(true) // root
      expect(files.filter(f => f.includes('packages')).length).toBe(4)
      expect(files.filter(f => f.includes('apps')).length).toBe(3)
    })

    it('should ignore node_modules and other excluded directories', async () => {
      // Create root
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2))

      // Create packages
      const packagesDir = join(tempDir, 'packages', 'core')
      mkdirSync(packagesDir, { recursive: true })
      writeFileSync(join(packagesDir, 'package.json'), JSON.stringify({ name: 'core', version: '1.0.0' }, null, 2))

      // Create node_modules (should be ignored)
      const nodeModulesDir = join(tempDir, 'node_modules', 'some-dep')
      mkdirSync(nodeModulesDir, { recursive: true })
      writeFileSync(join(nodeModulesDir, 'package.json'), JSON.stringify({ name: 'dep', version: '2.0.0' }, null, 2))

      // Create .git directory (should be ignored)
      const gitDir = join(tempDir, '.git')
      mkdirSync(gitDir, { recursive: true })
      writeFileSync(join(gitDir, 'package.json'), JSON.stringify({ name: 'git', version: '1.0.0' }, null, 2))

      // Create dist/build directories (should be ignored)
      const distDir = join(tempDir, 'packages', 'core', 'dist')
      mkdirSync(distDir, { recursive: true })
      writeFileSync(join(distDir, 'package.json'), JSON.stringify({ name: 'dist', version: '1.0.0' }, null, 2))

      const files = await findPackageJsonFiles(tempDir, true)

      expect(files.length).toBe(2) // Only root and packages/core
      expect(files.some(f => f.includes('node_modules'))).toBe(false)
      expect(files.some(f => f.includes('.git'))).toBe(false)
      expect(files.some(f => f.includes('dist'))).toBe(false)
    })

    it('should handle deeply nested package structures', async () => {
      // Create complex nested structure
      const structure = [
        'package.json',
        'packages/frontend/web/package.json',
        'packages/frontend/mobile/package.json',
        'packages/backend/api/package.json',
        'packages/backend/auth/package.json',
        'packages/shared/utils/package.json',
        'packages/shared/types/package.json',
        'tools/build/package.json',
        'tools/lint/package.json',
      ]

      structure.forEach((path) => {
        const fullPath = join(tempDir, path)
        mkdirSync(dirname(fullPath), { recursive: true })
        const name = path.replace('/package.json', '').replace('package.json', 'root')
        writeFileSync(fullPath, JSON.stringify({ name, version: '1.0.0' }, null, 2))
      })

      const files = await findPackageJsonFiles(tempDir, true)
      expect(files.length).toBe(structure.length)
    })
  })

  describe('Independent Versioning', () => {
    it('should bump each package independently from its current version', async () => {
      // Create packages with different versions
      const packages = [
        { name: 'core', version: '1.2.3', path: 'packages/core' },
        { name: 'utils', version: '0.5.0', path: 'packages/utils' },
        { name: 'ui', version: '2.1.0', path: 'packages/ui' },
        { name: 'cli', version: '1.0.0-beta.1', path: 'packages/cli' },
      ]

      packages.forEach((pkg) => {
        const pkgDir = join(tempDir, pkg.path)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg.name}`,
          version: pkg.version,
        }, null, 2))
      })

      // Bump all packages with patch
      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // Verify each package was bumped independently
      const coreContent = JSON.parse(readFileSync(join(tempDir, 'packages/core/package.json'), 'utf-8'))
      expect(coreContent.version).toBe('1.2.4')

      const utilsContent = JSON.parse(readFileSync(join(tempDir, 'packages/utils/package.json'), 'utf-8'))
      expect(utilsContent.version).toBe('0.5.1')

      const uiContent = JSON.parse(readFileSync(join(tempDir, 'packages/ui/package.json'), 'utf-8'))
      expect(uiContent.version).toBe('2.1.1')

      const cliContent = JSON.parse(readFileSync(join(tempDir, 'packages/cli/package.json'), 'utf-8'))
      expect(cliContent.version).toBe('1.0.1')

      // Verify progress events
      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(4)
    })

    it('should handle mixed release types across packages', async () => {
      const packages = [
        { name: 'stable', version: '1.0.0', path: 'packages/stable' },
        { name: 'beta', version: '2.0.0-beta.1', path: 'packages/beta' },
        { name: 'alpha', version: '3.0.0-alpha.0', path: 'packages/alpha' },
      ]

      packages.forEach((pkg) => {
        const pkgDir = join(tempDir, pkg.path)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg.name}`,
          version: pkg.version,
        }, null, 2))
      })

      // Bump with minor
      await versionBump({
        release: 'minor',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const stableContent = JSON.parse(readFileSync(join(tempDir, 'packages/stable/package.json'), 'utf-8'))
      expect(stableContent.version).toBe('1.1.0')

      const betaContent = JSON.parse(readFileSync(join(tempDir, 'packages/beta/package.json'), 'utf-8'))
      expect(betaContent.version).toBe('2.1.0')

      const alphaContent = JSON.parse(readFileSync(join(tempDir, 'packages/alpha/package.json'), 'utf-8'))
      expect(alphaContent.version).toBe('3.1.0')
    })
  })

  describe('Synchronized Versioning', () => {
    it('should set all packages to the same version', async () => {
      // Create packages all with the same starting version for synchronized versioning
      const packages = [
        { name: 'core', version: '3.0.0', path: 'packages/core' },
        { name: 'utils', version: '3.0.0', path: 'packages/utils' },
        { name: 'ui', version: '3.0.0', path: 'packages/ui' },
      ]

      packages.forEach((pkg) => {
        const pkgDir = join(tempDir, pkg.path)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg.name}`,
          version: pkg.version,
        }, null, 2))
      })

      // Synchronize all to version 3.0.0
      await versionBump({
        release: 'patch',
        currentVersion: '3.0.0', // This will set all packages to 3.0.1
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // Verify all packages have the same version
      packages.forEach((pkg) => {
        const content = JSON.parse(readFileSync(join(tempDir, pkg.path, 'package.json'), 'utf-8'))
        expect(content.version).toBe('3.0.1')
      })

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(3)
    })

    it('should skip packages that do not match the target version', async () => {
      const packages = [
        { name: 'match1', version: '1.0.0', path: 'packages/match1' },
        { name: 'match2', version: '1.0.0', path: 'packages/match2' },
        { name: 'different', version: '2.0.0', path: 'packages/different' },
      ]

      packages.forEach((pkg) => {
        const pkgDir = join(tempDir, pkg.path)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/${pkg.name}`,
          version: pkg.version,
        }, null, 2))
      })

      await versionBump({
        release: 'patch',
        currentVersion: '1.0.0', // Only packages with this version will be updated
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // Verify matching packages were updated
      const match1Content = JSON.parse(readFileSync(join(tempDir, 'packages/match1/package.json'), 'utf-8'))
      expect(match1Content.version).toBe('1.0.1')

      const match2Content = JSON.parse(readFileSync(join(tempDir, 'packages/match2/package.json'), 'utf-8'))
      expect(match2Content.version).toBe('1.0.1')

      // Verify different package was skipped
      const differentContent = JSON.parse(readFileSync(join(tempDir, 'packages/different/package.json'), 'utf-8'))
      expect(differentContent.version).toBe('2.0.0')

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      const fileSkippedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileSkipped)
      expect(fileUpdatedEvents.length).toBe(2)
      expect(fileSkippedEvents.length).toBe(1)
    })
  })

  describe('Real-world Monorepo Scenarios', () => {
    it('should handle a complete Lerna-style monorepo', async () => {
      // Create root package.json
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: 'my-monorepo',
        version: '1.0.0',
        private: true,
        workspaces: ['packages/*'],
        devDependencies: {
          lerna: '^6.0.0',
        },
      }, null, 2))

      // Create lerna.json
      writeFileSync(join(tempDir, 'lerna.json'), JSON.stringify({
        version: '1.0.0',
        packages: ['packages/*'],
        npmClient: 'npm',
        command: {
          publish: {
            conventionalCommits: true,
          },
        },
      }, null, 2))

      // Create packages
      const packages = [
        { name: '@myorg/core', version: '1.0.0', private: false },
        { name: '@myorg/utils', version: '1.0.0', private: false },
        { name: '@myorg/ui', version: '1.0.0', private: false },
        { name: '@myorg/docs', version: '1.0.0', private: true },
      ]

      packages.forEach((pkg, index) => {
        const pkgDir = join(tempDir, 'packages', pkg.name.split('/')[1])
        mkdirSync(pkgDir, { recursive: true })

        const packageJson: any = {
          name: pkg.name,
          version: pkg.version,
          main: 'index.js',
          dependencies: {},
        }

        if (pkg.private) {
          packageJson.private = true
        }

        // Add internal dependencies
        if (index > 0) {
          packageJson.dependencies[packages[0].name] = `^${packages[0].version}`
        }

        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify(packageJson, null, 2))
      })

      // Test synchronized versioning
      await versionBump({
        release: 'minor',
        currentVersion: '1.0.0',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify all packages were updated
      packages.forEach((pkg) => {
        const pkgName = pkg.name.split('/')[1]
        const content = JSON.parse(readFileSync(join(tempDir, 'packages', pkgName, 'package.json'), 'utf-8'))
        expect(content.version).toBe('1.1.0')
      })

      // Also verify root was updated
      const rootContent = JSON.parse(readFileSync(join(tempDir, 'package.json'), 'utf-8'))
      expect(rootContent.version).toBe('1.1.0')
    })

    it('should handle a Rush-style monorepo', async () => {
      // Create rush.json configuration
      writeFileSync(join(tempDir, 'rush.json'), JSON.stringify({
        rushVersion: '5.82.0',
        pnpmVersion: '7.14.0',
        nodeSupportedVersionRange: '>=14.15.0 <19.0.0',
        projects: [
          { packageName: '@company/app1', projectFolder: 'apps/app1' },
          { packageName: '@company/app2', projectFolder: 'apps/app2' },
          { packageName: '@company/shared', projectFolder: 'packages/shared' },
          { packageName: '@company/utils', projectFolder: 'packages/utils' },
        ],
      }, null, 2))

      // Create projects based on rush.json
      const projects = [
        { name: '@company/app1', path: 'apps/app1', version: '1.0.0' },
        { name: '@company/app2', path: 'apps/app2', version: '1.0.0' },
        { name: '@company/shared', path: 'packages/shared', version: '1.0.0' },
        { name: '@company/utils', path: 'packages/utils', version: '1.0.0' },
      ]

      projects.forEach((project) => {
        const projectDir = join(tempDir, project.path)
        mkdirSync(projectDir, { recursive: true })
        writeFileSync(join(projectDir, 'package.json'), JSON.stringify({
          name: project.name,
          version: project.version,
          main: 'index.js',
        }, null, 2))
      })

      // Test independent versioning
      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify all projects were updated
      projects.forEach((project) => {
        const content = JSON.parse(readFileSync(join(tempDir, project.path, 'package.json'), 'utf-8'))
        expect(content.version).toBe('1.0.1')
      })
    })

    it('should handle Nx-style monorepo with mixed applications and libraries', async () => {
      // Create nx.json
      writeFileSync(join(tempDir, 'nx.json'), JSON.stringify({
        npmScope: 'mycompany',
        projects: {
          'web-app': 'apps/web-app',
          'mobile-app': 'apps/mobile-app',
          'api': 'apps/api',
          'shared-ui': 'libs/shared/ui',
          'shared-data': 'libs/shared/data',
          'feature-auth': 'libs/feature/auth',
        },
      }, null, 2))

      // Create workspace.json
      writeFileSync(join(tempDir, 'workspace.json'), JSON.stringify({
        version: 2,
        projects: {
          'web-app': 'apps/web-app',
          'mobile-app': 'apps/mobile-app',
          'api': 'apps/api',
          'shared-ui': 'libs/shared/ui',
          'shared-data': 'libs/shared/data',
          'feature-auth': 'libs/feature/auth',
        },
      }, null, 2))

      // Create root package.json
      writeFileSync(join(tempDir, 'package.json'), JSON.stringify({
        name: '@mycompany/source',
        version: '0.0.0',
        private: true,
        workspaces: ['apps/*', 'libs/*/*'],
      }, null, 2))

      // Create apps
      const apps = ['web-app', 'mobile-app', 'api']
      apps.forEach((app) => {
        const appDir = join(tempDir, 'apps', app)
        mkdirSync(appDir, { recursive: true })
        writeFileSync(join(appDir, 'package.json'), JSON.stringify({
          name: `@mycompany/${app}`,
          version: '1.0.0',
          private: true,
        }, null, 2))
      })

      // Create libs
      const libs = [
        { name: 'shared-ui', path: 'libs/shared/ui' },
        { name: 'shared-data', path: 'libs/shared/data' },
        { name: 'feature-auth', path: 'libs/feature/auth' },
      ]

      libs.forEach((lib) => {
        const libDir = join(tempDir, lib.path)
        mkdirSync(libDir, { recursive: true })
        writeFileSync(join(libDir, 'package.json'), JSON.stringify({
          name: `@mycompany/${lib.name}`,
          version: '1.0.0',
        }, null, 2))
      })

      // Test versioning - collect all package.json files
      const allFiles = [
        join(tempDir, 'package.json'),
        ...apps.map(app => join(tempDir, 'apps', app, 'package.json')),
        ...libs.map(lib => join(tempDir, lib.path, 'package.json')),
      ]

      await versionBump({
        release: 'minor',
        files: allFiles,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      // Verify apps were updated
      apps.forEach((app) => {
        const content = JSON.parse(readFileSync(join(tempDir, 'apps', app, 'package.json'), 'utf-8'))
        expect(content.version).toBe('1.1.0')
      })

      // Verify libs were updated
      libs.forEach((lib) => {
        const content = JSON.parse(readFileSync(join(tempDir, lib.path, 'package.json'), 'utf-8'))
        expect(content.version).toBe('1.1.0')
      })
    })
  })

  describe('Performance with Large Monorepos', () => {
    it('should handle large numbers of packages efficiently', async () => {
      const packageCount = 100
      const startTime = Date.now()

      // Create many packages
      for (let i = 0; i < packageCount; i++) {
        const pkgDir = join(tempDir, 'packages', `package-${i}`)
        mkdirSync(pkgDir, { recursive: true })
        writeFileSync(join(pkgDir, 'package.json'), JSON.stringify({
          name: `@monorepo/package-${i}`,
          version: '1.0.0',
        }, null, 2))
      }

      // Test discovery performance
      const files = await findPackageJsonFiles(tempDir, true)
      expect(files.length).toBe(packageCount)

      // Test update performance
      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
      })

      const endTime = Date.now()
      const duration = endTime - startTime

      // Should complete within reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(10000) // 10 seconds

      // Verify random samples were updated
      for (let i = 0; i < 5; i++) {
        const randomIndex = Math.floor(Math.random() * packageCount)
        const content = JSON.parse(readFileSync(join(tempDir, 'packages', `package-${randomIndex}`, 'package.json'), 'utf-8'))
        expect(content.version).toBe('1.0.1')
      }
    })
  })

  describe('Error Handling in Monorepos', () => {
    it('should handle some packages failing while others succeed', async () => {
      // Create valid packages
      const validPkgDir = join(tempDir, 'packages', 'valid')
      mkdirSync(validPkgDir, { recursive: true })
      writeFileSync(join(validPkgDir, 'package.json'), JSON.stringify({
        name: '@monorepo/valid',
        version: '1.0.0',
      }, null, 2))

      // Create package with missing version
      const noVersionDir = join(tempDir, 'packages', 'no-version')
      mkdirSync(noVersionDir, { recursive: true })
      writeFileSync(join(noVersionDir, 'package.json'), JSON.stringify({
        name: '@monorepo/no-version',
      }, null, 2))

      // Create another valid package
      const validPkg2Dir = join(tempDir, 'packages', 'valid2')
      mkdirSync(validPkg2Dir, { recursive: true })
      writeFileSync(join(validPkg2Dir, 'package.json'), JSON.stringify({
        name: '@monorepo/valid2',
        version: '1.0.0',
      }, null, 2))

      // Should not throw error but should handle mixed results
      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // Valid packages should be updated
      const validContent = JSON.parse(readFileSync(join(validPkgDir, 'package.json'), 'utf-8'))
      expect(validContent.version).toBe('1.0.1')

      const valid2Content = JSON.parse(readFileSync(join(validPkg2Dir, 'package.json'), 'utf-8'))
      expect(valid2Content.version).toBe('1.0.1')

      // Invalid package should remain unchanged
      const noVersionContent = JSON.parse(readFileSync(join(noVersionDir, 'package.json'), 'utf-8'))
      expect(noVersionContent.version).toBeUndefined()

      // Should have both success and skip events
      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(2)
    })

    it('should handle malformed package.json files gracefully', async () => {
      // Create valid package
      const validPkgDir = join(tempDir, 'packages', 'valid')
      mkdirSync(validPkgDir, { recursive: true })
      writeFileSync(join(validPkgDir, 'package.json'), JSON.stringify({
        name: '@monorepo/valid',
        version: '1.0.0',
      }, null, 2))

      // Create malformed package.json
      const malformedDir = join(tempDir, 'packages', 'malformed')
      mkdirSync(malformedDir, { recursive: true })
      writeFileSync(join(malformedDir, 'package.json'), '{ invalid json }')

      // Should handle the error and continue with valid packages
      await versionBump({
        release: 'patch',
        recursive: true,
        commit: false,
        tag: false,
        push: false,
        quiet: true,
        noGitCheck: true,
        progress: createProgressCallback(),
      })

      // Valid package should still be updated
      const validContent = JSON.parse(readFileSync(join(validPkgDir, 'package.json'), 'utf-8'))
      expect(validContent.version).toBe('1.0.1')

      const fileUpdatedEvents = progressEvents.filter(e => e.event === ProgressEvent.FileUpdated)
      expect(fileUpdatedEvents.length).toBe(1)
    })
  })
})

// Helper function to get directory name from path
function dirname(path: string): string {
  const parts = path.split('/')
  return parts.slice(0, -1).join('/')
}
