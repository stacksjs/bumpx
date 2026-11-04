// Default import, not `* as`: process's EventEmitter methods (on,
// listeners, removeListener) live on its prototype, so an ESM namespace
// drops them under Node — which the bin's shebang selects.
import process from 'node:process'

/**
 * Global flag to track user interrupt status
 */
export const userInterrupted = { value: false }

/**
 * Check if the user has interrupted the process and exit if they have
 */
export function checkInterruption(): void {
  if (userInterrupted.value) {
    process.stderr.write('\nOperation cancelled by user\n')
    process.exit(0)
  }
}
