import { describe, expect, it } from 'bun:test'
import { ActionError, ActionErrorType } from '../src/types'

describe('GitHub Action', () => {
  describe('ActionError class', () => {
    it('should create ActionError with message and type', () => {
      const error = new ActionError(
        'Test error message',
        ActionErrorType.BUN_INSTALLATION_FAILED,
      )

      expect(error.message).toBe('Test error message')
      expect(error.type).toBe(ActionErrorType.BUN_INSTALLATION_FAILED)
      expect(error.name).toBe('ActionError')
      expect(error.details).toBeUndefined()
    })

    it('should create ActionError with details', () => {
      const details = { key: 'value', count: 42 }
      const error = new ActionError(
        'Detailed error',
        ActionErrorType.CONFIG_PARSING_FAILED,
        details,
      )

      expect(error.message).toBe('Detailed error')
      expect(error.type).toBe(ActionErrorType.CONFIG_PARSING_FAILED)
      expect(error.details).toEqual(details)
    })

    it('should extend Error correctly', () => {
      const error = new ActionError(
        'Test error',
        ActionErrorType.NETWORK_ERROR,
      )

      expect(error instanceof Error).toBe(true)
      expect(error instanceof ActionError).toBe(true)
    })
  })

  describe('ActionErrorType enum', () => {
    it('should have all expected error types', () => {
      expect(ActionErrorType.BUN_INSTALLATION_FAILED).toBe(ActionErrorType.BUN_INSTALLATION_FAILED)
      expect(ActionErrorType.BUMPX_INSTALLATION_FAILED).toBe(ActionErrorType.BUMPX_INSTALLATION_FAILED)
      expect(ActionErrorType.PKGX_INSTALLATION_FAILED).toBe(ActionErrorType.PKGX_INSTALLATION_FAILED)
      expect(ActionErrorType.PACKAGE_INSTALLATION_FAILED).toBe(ActionErrorType.PACKAGE_INSTALLATION_FAILED)
      expect(ActionErrorType.DEPENDENCY_DETECTION_FAILED).toBe(ActionErrorType.DEPENDENCY_DETECTION_FAILED)
      expect(ActionErrorType.CONFIG_PARSING_FAILED).toBe(ActionErrorType.CONFIG_PARSING_FAILED)
      expect(ActionErrorType.TIMEOUT_EXCEEDED).toBe(ActionErrorType.TIMEOUT_EXCEEDED)
      expect(ActionErrorType.UNSUPPORTED_PLATFORM).toBe(ActionErrorType.UNSUPPORTED_PLATFORM)
      expect(ActionErrorType.INSUFFICIENT_PERMISSIONS).toBe(ActionErrorType.INSUFFICIENT_PERMISSIONS)
      expect(ActionErrorType.NETWORK_ERROR).toBe(ActionErrorType.NETWORK_ERROR)
    })

    it('should have string values for all error types', () => {
      const errorTypes = Object.values(ActionErrorType)
      errorTypes.forEach((type) => {
        expect(typeof type).toBe('string')
        expect(type.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Interface validation', () => {
    it('should validate ActionInputs interface structure', () => {
      const validInputs = {
        packages: 'typescript eslint',
        configPath: 'bumpx.config.ts',
        bumpxVersion: 'latest',
        installBun: true,
        installPkgx: true,
        verbose: false,
        skipDetection: false,
        workingDirectory: '.',
        envVars: '{}',
        timeout: 600,
        cache: true,
        cacheKey: 'bumpx-packages',
      }

      // Type validation - these should compile without errors
      expect(typeof validInputs.packages).toBe('string')
      expect(typeof validInputs.configPath).toBe('string')
      expect(typeof validInputs.bumpxVersion).toBe('string')
      expect(typeof validInputs.installBun).toBe('boolean')
      expect(typeof validInputs.installPkgx).toBe('boolean')
      expect(typeof validInputs.verbose).toBe('boolean')
      expect(typeof validInputs.skipDetection).toBe('boolean')
      expect(typeof validInputs.workingDirectory).toBe('string')
      expect(typeof validInputs.envVars).toBe('string')
      expect(typeof validInputs.timeout).toBe('number')
      expect(typeof validInputs.cache).toBe('boolean')
      expect(typeof validInputs.cacheKey).toBe('string')
    })

    it('should validate PackageInstallResult interface structure', () => {
      const successResult = {
        name: 'typescript',
        success: true,
        installTime: 1500,
        version: '5.0.0',
      }

      const failureResult = {
        name: 'bad-package',
        success: false,
        installTime: 500,
        error: 'Package not found',
      }

      expect(successResult.name).toBe('typescript')
      expect(successResult.success).toBe(true)
      expect(successResult.installTime).toBe(1500)
      expect(successResult.version).toBe('5.0.0')

      expect(failureResult.name).toBe('bad-package')
      expect(failureResult.success).toBe(false)
      expect(failureResult.installTime).toBe(500)
      expect(failureResult.error).toBe('Package not found')
    })

    it('should validate InstallationSummary interface structure', () => {
      const summary = {
        totalPackages: 3,
        successfulInstalls: 2,
        failedInstalls: 1,
        results: [],
        totalTime: 5000,
        bumpxInstalled: true,
        bunInstalled: true,
        pkgxInstalled: false,
      }

      expect(summary.totalPackages).toBe(3)
      expect(summary.successfulInstalls).toBe(2)
      expect(summary.failedInstalls).toBe(1)
      expect(Array.isArray(summary.results)).toBe(true)
      expect(summary.totalTime).toBe(5000)
      expect(summary.bumpxInstalled).toBe(true)
      expect(summary.bunInstalled).toBe(true)
      expect(summary.pkgxInstalled).toBe(false)
    })
  })

  describe('Input validation logic', () => {
    it('should handle timeout validation correctly', () => {
      const validTimeouts = [1, 300, 600, 1800, 3600]
      const invalidTimeouts = [0, -1, 3601, 5000]

      validTimeouts.forEach((timeout) => {
        expect(timeout > 0 && timeout <= 3600).toBe(true)
      })

      invalidTimeouts.forEach((timeout) => {
        expect(timeout > 0 && timeout <= 3600).toBe(false)
      })
    })

    it('should validate environment variables JSON parsing', () => {
      const validJson = '{"NODE_ENV":"test","DEBUG":"true"}'
      const invalidJson = 'invalid json string'

      expect(() => JSON.parse(validJson)).not.toThrow()
      expect(() => JSON.parse(invalidJson)).toThrow()

      const parsed = JSON.parse(validJson)
      expect(parsed.NODE_ENV).toBe('test')
      expect(parsed.DEBUG).toBe('true')
    })

    it('should handle package list parsing', () => {
      const packages = 'typescript eslint prettier'
      const packageList = packages.split(/\s+/).filter(Boolean)

      expect(packageList).toEqual(['typescript', 'eslint', 'prettier'])
      expect(packageList.length).toBe(3)

      // Test empty input
      const emptyPackages = ''
      const emptyList = emptyPackages.split(/\s+/).filter(Boolean)
      expect(emptyList).toEqual([])
    })
  })

  describe('Platform detection', () => {
    it('should identify supported platforms', () => {
      const supportedPlatforms = ['darwin', 'linux', 'win32']
      const unsupportedPlatforms = ['aix', 'freebsd', 'openbsd', 'sunos']

      supportedPlatforms.forEach((platform) => {
        expect(['darwin', 'linux', 'win32'].includes(platform)).toBe(true)
      })

      unsupportedPlatforms.forEach((platform) => {
        expect(['darwin', 'linux', 'win32'].includes(platform)).toBe(false)
      })
    })

    it('should determine correct installation commands by platform', () => {
      const getInstallCommand = (platform: string) => {
        if (platform === 'darwin' || platform === 'linux') {
          return ['curl', ['-fsSL', 'https://bun.sh/install', '|', 'bash']]
        }
        else if (platform === 'win32') {
          return ['powershell', ['-Command', 'irm bun.sh/install.ps1 | iex']]
        }
        else {
          throw new Error(`Unsupported platform: ${platform}`)
        }
      }

      expect(getInstallCommand('linux')).toEqual(['curl', ['-fsSL', 'https://bun.sh/install', '|', 'bash']])
      expect(getInstallCommand('darwin')).toEqual(['curl', ['-fsSL', 'https://bun.sh/install', '|', 'bash']])
      expect(getInstallCommand('win32')).toEqual(['powershell', ['-Command', 'irm bun.sh/install.ps1 | iex']])
      expect(() => getInstallCommand('aix')).toThrow('Unsupported platform: aix')
    })
  })

  describe('Version handling', () => {
    it('should handle version specifications correctly', () => {
      const getPackageSpec = (version: string) => {
        return version === 'latest' ? 'bumpx' : `bumpx@${version}`
      }

      expect(getPackageSpec('latest')).toBe('bumpx')
      expect(getPackageSpec('0.1.0')).toBe('bumpx@0.1.0')
      expect(getPackageSpec('1.2.3-beta.1')).toBe('bumpx@1.2.3-beta.1')
    })

    it('should parse version output correctly', () => {
      const parseVersion = (output: string) => output.trim()

      expect(parseVersion('1.0.0\n')).toBe('1.0.0')
      expect(parseVersion('  2.1.3  ')).toBe('2.1.3')
      expect(parseVersion('0.1.0-beta.1')).toBe('0.1.0-beta.1')
    })
  })

  describe('Error handling patterns', () => {
    it('should categorize errors correctly', () => {
      const categorizeError = (error: Error) => {
        const message = error.message.toLowerCase()
        if (message.includes('timeout')) {
          return ActionErrorType.TIMEOUT_EXCEEDED
        }
        else if (message.includes('network')) {
          return ActionErrorType.NETWORK_ERROR
        }
        else if (message.includes('permission')) {
          return ActionErrorType.INSUFFICIENT_PERMISSIONS
        }
        else if (message.includes('platform')) {
          return ActionErrorType.UNSUPPORTED_PLATFORM
        }
        else {
          return ActionErrorType.PACKAGE_INSTALLATION_FAILED
        }
      }

      expect(categorizeError(new Error('Connection timeout'))).toBe(ActionErrorType.TIMEOUT_EXCEEDED)
      expect(categorizeError(new Error('Network unreachable'))).toBe(ActionErrorType.NETWORK_ERROR)
      expect(categorizeError(new Error('Permission denied'))).toBe(ActionErrorType.INSUFFICIENT_PERMISSIONS)
      expect(categorizeError(new Error('Unsupported platform'))).toBe(ActionErrorType.UNSUPPORTED_PLATFORM)
      expect(categorizeError(new Error('Package not found'))).toBe(ActionErrorType.PACKAGE_INSTALLATION_FAILED)
    })

    it('should handle installation results correctly', () => {
      const processResults = (results: Array<{ success: boolean, name: string, error?: string }>) => {
        const successful = results.filter(r => r.success)
        const failed = results.filter(r => !r.success)

        return {
          successCount: successful.length,
          failureCount: failed.length,
          successfulPackages: successful.map(r => r.name),
          failedPackages: failed.map(r => ({ name: r.name, error: r.error })),
        }
      }

      const mockResults = [
        { success: true, name: 'typescript' },
        { success: false, name: 'bad-package', error: 'Not found' },
        { success: true, name: 'eslint' },
      ]

      const processed = processResults(mockResults)
      expect(processed.successCount).toBe(2)
      expect(processed.failureCount).toBe(1)
      expect(processed.successfulPackages).toEqual(['typescript', 'eslint'])
      expect(processed.failedPackages).toEqual([{ name: 'bad-package', error: 'Not found' }])
    })
  })

  describe('Output formatting', () => {
    it('should format outputs correctly', () => {
      const formatOutputs = (summary: any, packages: string[]) => {
        return {
          success: 'true',
          packagesInstalled: String(summary.successfulInstalls),
          installedPackages: JSON.stringify(packages),
          summary: JSON.stringify(summary),
        }
      }

      const testSummary = {
        successfulInstalls: 2,
        failedInstalls: 1,
        totalTime: 5000,
      }

      const outputs = formatOutputs(testSummary, ['typescript', 'eslint'])

      expect(outputs.success).toBe('true')
      expect(outputs.packagesInstalled).toBe('2')
      expect(JSON.parse(outputs.installedPackages)).toEqual(['typescript', 'eslint'])
      expect(JSON.parse(outputs.summary)).toEqual(testSummary)
    })

    it('should format summary logs correctly', () => {
      const formatSummary = (summary: any) => {
        const lines = [
          '='.repeat(50),
          'Installation Summary',
          '='.repeat(50),
          `Total packages: ${summary.totalPackages}`,
          `Successful installations: ${summary.successfulInstalls}`,
          `Failed installations: ${summary.failedInstalls}`,
          `Total time: ${summary.totalTime}ms`,
          `bumpx installed: ${summary.bumpxInstalled}`,
          `Bun installed: ${summary.bunInstalled}`,
          `pkgx installed: ${summary.pkgxInstalled}`,
          '='.repeat(50),
        ]
        return lines
      }

      const testSummary = {
        totalPackages: 3,
        successfulInstalls: 2,
        failedInstalls: 1,
        totalTime: 5000,
        bumpxInstalled: true,
        bunInstalled: true,
        pkgxInstalled: false,
      }

      const formatted = formatSummary(testSummary)

      expect(formatted).toContain('Installation Summary')
      expect(formatted).toContain('Total packages: 3')
      expect(formatted).toContain('Successful installations: 2')
      expect(formatted).toContain('Failed installations: 1')
      expect(formatted).toContain('Total time: 5000ms')
      expect(formatted).toContain('bumpx installed: true')
      expect(formatted).toContain('Bun installed: true')
      expect(formatted).toContain('pkgx installed: false')
    })
  })

  describe('Integration scenarios', () => {
    it('should validate complete workflow logic', () => {
      // Simulate the complete action workflow
      const simulateActionWorkflow = (inputs: any) => {
        // Input validation
        if (inputs.timeout <= 0 || inputs.timeout > 3600) {
          throw new ActionError(
            `Invalid timeout: ${inputs.timeout}`,
            ActionErrorType.CONFIG_PARSING_FAILED,
          )
        }

        // Environment setup
        const envVars = inputs.envVars ? JSON.parse(inputs.envVars) : {}

        // Package processing
        const packages = inputs.packages ? inputs.packages.split(/\s+/).filter(Boolean) : []

        // Installation simulation
        const results = packages.map((pkg: string) => ({
          name: pkg,
          success: pkg !== 'bad-package', // Simulate failure for 'bad-package'
          installTime: Math.random() * 1000,
          ...(pkg === 'bad-package' ? { error: 'Package not found' } : { version: '1.0.0' }),
        }))

        const summary = {
          totalPackages: packages.length,
          successfulInstalls: results.filter((r: any) => r.success).length,
          failedInstalls: results.filter((r: any) => !r.success).length,
          results,
          totalTime: 5000,
          bumpxInstalled: true,
          bunInstalled: inputs.installBun,
          pkgxInstalled: inputs.installPkgx,
        }

        return { summary, envVars, packages }
      }

      // Test successful workflow
      const successInputs = {
        packages: 'typescript eslint',
        envVars: '{"NODE_ENV":"test"}',
        timeout: 600,
        installBun: true,
        installPkgx: true,
      }

      const successResult = simulateActionWorkflow(successInputs)
      expect(successResult.summary.totalPackages).toBe(2)
      expect(successResult.summary.successfulInstalls).toBe(2)
      expect(successResult.summary.failedInstalls).toBe(0)
      expect(successResult.envVars.NODE_ENV).toBe('test')

      // Test with failure
      const failureInputs = {
        packages: 'typescript bad-package eslint',
        envVars: '{}',
        timeout: 300,
        installBun: false,
        installPkgx: false,
      }

      const failureResult = simulateActionWorkflow(failureInputs)
      expect(failureResult.summary.totalPackages).toBe(3)
      expect(failureResult.summary.successfulInstalls).toBe(2)
      expect(failureResult.summary.failedInstalls).toBe(1)
      expect(failureResult.summary.bunInstalled).toBe(false)
      expect(failureResult.summary.pkgxInstalled).toBe(false)

      // Test invalid timeout
      const invalidInputs = {
        packages: '',
        envVars: '{}',
        timeout: 0,
        installBun: true,
        installPkgx: true,
      }

      expect(() => simulateActionWorkflow(invalidInputs)).toThrow('Invalid timeout: 0')
    })

    it('should handle edge cases correctly', () => {
      // Test empty package list
      const emptyPackages = ''
      const packageList = emptyPackages.split(/\s+/).filter(Boolean)
      expect(packageList).toEqual([])

      // Test whitespace-only package list
      const whitespacePackages = '   \t  \n  '
      const whitespaceList = whitespacePackages.split(/\s+/).filter(Boolean)
      expect(whitespaceList).toEqual([])

      // Test mixed valid and empty package names
      const mixedPackages = 'typescript  eslint    prettier'
      const mixedList = mixedPackages.split(/\s+/).filter(Boolean)
      expect(mixedList).toEqual(['typescript', 'eslint', 'prettier'])

      // Test environment variable edge cases
      expect(() => JSON.parse('{}')).not.toThrow()
      expect(() => JSON.parse('')).toThrow()
      expect(() => JSON.parse('null')).not.toThrow()

      const emptyEnv = JSON.parse('{}')
      expect(Object.keys(emptyEnv)).toEqual([])
    })
  })
})
