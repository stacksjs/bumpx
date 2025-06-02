import type {
  BumpxConfig,
  FileInfo,
  PackageJson,
  ParsedArgs,
  ReleaseType,
  VersionBumpOptions,
  VersionBumpProgress,
} from '../src/types'
import { describe, expect, it } from 'bun:test'
import {
  ExitCode,
  ProgressEvent,

} from '../src/types'

describe('Types and Enums', () => {
  describe('ProgressEvent enum', () => {
    it('should have all expected progress events', () => {
      // Test that enum values exist and are consistent
      expect(ProgressEvent.FileUpdated).toBeDefined()
      expect(ProgressEvent.FileSkipped).toBeDefined()
      expect(ProgressEvent.GitCommit).toBeDefined()
      expect(ProgressEvent.GitTag).toBeDefined()
      expect(ProgressEvent.GitPush).toBeDefined()
      expect(ProgressEvent.NpmScript).toBeDefined()
      expect(ProgressEvent.Execute).toBeDefined()

      // Verify the string values without type issues
      expect(String(ProgressEvent.FileUpdated)).toBe('fileUpdated')
      expect(String(ProgressEvent.FileSkipped)).toBe('fileSkipped')
      expect(String(ProgressEvent.GitCommit)).toBe('gitCommit')
      expect(String(ProgressEvent.GitTag)).toBe('gitTag')
      expect(String(ProgressEvent.GitPush)).toBe('gitPush')
      expect(String(ProgressEvent.NpmScript)).toBe('npmScript')
      expect(String(ProgressEvent.Execute)).toBe('execute')
    })

    it('should have string values for all events', () => {
      const events = Object.values(ProgressEvent)
      events.forEach((event) => {
        expect(typeof event).toBe('string')
      })
    })
  })

  describe('ExitCode enum', () => {
    it('should have expected exit codes', () => {
      expect(ExitCode.Success).toBe(0)
      expect(ExitCode.InvalidArgument).toBe(1)
      expect(ExitCode.FatalError).toBe(2)
    })

    it('should have numeric values', () => {
      const codes = Object.values(ExitCode).filter(value => typeof value === 'number')
      codes.forEach((code) => {
        expect(typeof code).toBe('number')
      })
      expect(codes.length).toBeGreaterThan(0)
    })
  })

  describe('Type validations', () => {
    it('should validate VersionBumpOptions interface', () => {
      const validOptions: VersionBumpOptions = {
        release: 'patch',
        preid: 'beta',
        currentVersion: '1.0.0',
        files: ['package.json'],
        commit: true,
        tag: 'v1.0.1',
        push: true,
        sign: false,
        noGitCheck: false,
        noVerify: false,
        install: false,
        ignoreScripts: false,
        execute: ['npm run build'],
        confirm: true,
        quiet: false,
        ci: false,
        all: false,
        recursive: false,
        printCommits: false,
      }

      // Should compile without errors
      expect(validOptions.release).toBe('patch')
      expect(validOptions.files).toEqual(['package.json'])
      expect(validOptions.execute).toEqual(['npm run build'])
    })

    it('should validate BumpxConfig interface', () => {
      const validConfig: BumpxConfig = {
        commit: true,
        tag: true,
        push: true,
        sign: false,
        noGitCheck: false,
        noVerify: false,
        install: false,
        ignoreScripts: false,
        confirm: true,
        quiet: false,
        ci: false,
        all: false,
        recursive: false,
        printCommits: false,
      }

      // Should compile without errors
      expect(validConfig.commit).toBe(true)
      expect(validConfig.push).toBe(true)
    })

    it('should validate VersionBumpProgress interface', () => {
      const validProgress: VersionBumpProgress = {
        event: ProgressEvent.FileUpdated,
        script: 'npm run build',
        updatedFiles: ['package.json'],
        skippedFiles: [],
        newVersion: '1.0.1',
        oldVersion: '1.0.0',
      }

      expect(validProgress.event).toBe(ProgressEvent.FileUpdated)
      expect(validProgress.updatedFiles).toEqual(['package.json'])
      expect(validProgress.newVersion).toBe('1.0.1')
    })

    it('should validate ParsedArgs interface', () => {
      const validArgs: ParsedArgs = {
        help: false,
        version: false,
        quiet: false,
        options: {
          release: 'patch',
          commit: true,
          tag: true,
          push: true,
        },
      }

      expect(validArgs.help).toBe(false)
      expect(validArgs.options.release).toBe('patch')
    })

    it('should validate PackageJson interface', () => {
      const validPackageJson: PackageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          lodash: '^4.17.21',
        },
        devDependencies: {
          typescript: '^5.0.0',
        },
        peerDependencies: {
          react: '>=16.0.0',
        },
        optionalDependencies: {
          fsevents: '^2.3.0',
        },
        scripts: {
          build: 'tsc',
          test: 'jest',
        },
        description: 'A test package',
        author: 'Test Author',
      }

      expect(validPackageJson.name).toBe('test-package')
      expect(validPackageJson.version).toBe('1.0.0')
      expect(validPackageJson.dependencies?.lodash).toBe('^4.17.21')
    })

    it('should validate FileInfo interface', () => {
      const validFileInfo: FileInfo = {
        path: '/path/to/package.json',
        content: '{"name": "test", "version": "1.0.0"}',
        updated: true,
        oldVersion: '1.0.0',
        newVersion: '1.0.1',
      }

      expect(validFileInfo.path).toBe('/path/to/package.json')
      expect(validFileInfo.updated).toBe(true)
      expect(validFileInfo.oldVersion).toBe('1.0.0')
      expect(validFileInfo.newVersion).toBe('1.0.1')
    })
  })

  describe('Release types', () => {
    it('should accept valid release types', () => {
      const validReleaseTypes: ReleaseType[] = [
        'major',
        'minor',
        'patch',
        'premajor',
        'preminor',
        'prepatch',
        'prerelease',
      ]

      validReleaseTypes.forEach((type) => {
        const options: VersionBumpOptions = { release: type }
        expect(options.release).toBe(type)
      })
    })
  })

  describe('Optional properties', () => {
    it('should work with minimal VersionBumpOptions', () => {
      const minimalOptions: VersionBumpOptions = {}
      expect(minimalOptions).toBeDefined()
    })

    it('should work with minimal PackageJson', () => {
      const minimalPackage: PackageJson = {
        version: '1.0.0',
      }
      expect(minimalPackage.version).toBe('1.0.0')
    })

    it('should work with minimal FileInfo', () => {
      const minimalFileInfo: FileInfo = {
        path: '/test/path',
        content: 'test content',
        updated: false,
      }
      expect(minimalFileInfo.updated).toBe(false)
    })
  })

  describe('Union types', () => {
    it('should accept string or boolean for commit option', () => {
      const optionsWithStringCommit: VersionBumpOptions = {
        commit: 'Custom commit message',
      }
      const optionsWithBooleanCommit: VersionBumpOptions = {
        commit: true,
      }

      expect(optionsWithStringCommit.commit).toBe('Custom commit message')
      expect(optionsWithBooleanCommit.commit).toBe(true)
    })

    it('should accept string or boolean for tag option', () => {
      const optionsWithStringTag: VersionBumpOptions = {
        tag: 'v1.0.0',
      }
      const optionsWithBooleanTag: VersionBumpOptions = {
        tag: true,
      }

      expect(optionsWithStringTag.tag).toBe('v1.0.0')
      expect(optionsWithBooleanTag.tag).toBe(true)
    })

    it('should accept string or string array for execute option', () => {
      const optionsWithStringExecute: VersionBumpOptions = {
        execute: 'npm run build',
      }
      const optionsWithArrayExecute: VersionBumpOptions = {
        execute: ['npm run build', 'npm run test'],
      }

      expect(optionsWithStringExecute.execute).toBe('npm run build')
      expect(optionsWithArrayExecute.execute).toEqual(['npm run build', 'npm run test'])
    })
  })

  describe('Progress callback type', () => {
    it('should accept valid progress callback', () => {
      const progressCallback = (progress: VersionBumpProgress) => {
        expect(progress.event).toBeDefined()
        expect(progress.updatedFiles).toBeDefined()
        expect(progress.skippedFiles).toBeDefined()
        expect(progress.newVersion).toBeDefined()
      }

      const options: VersionBumpOptions = {
        progress: progressCallback,
      }

      expect(typeof options.progress).toBe('function')
    })
  })
})
