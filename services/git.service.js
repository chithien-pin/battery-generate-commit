import { execSync, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

/**
 * Check if current directory is a git repository
 * @returns {boolean}
 */
export function isGitRepository() {
  const gitDir = join(process.cwd(), '.git');
  return existsSync(gitDir);
}

/**
 * Get staged changes using git diff --cached
 * @returns {string} The diff output
 */
export function getStagedDiff() {
  try {
    const diff = execSync('git diff --cached', { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return diff.trim();
  } catch (error) {
    throw new Error(`Failed to get staged diff: ${error.message}`);
  }
}

/**
 * Check if there are any staged changes
 * @returns {boolean}
 */
export function hasStagedChanges() {
  try {
    const diff = getStagedDiff();
    return diff.length > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Commit changes with the given message
 * @param {string} message - Commit message
 * @returns {void}
 */
export function commitChanges(message) {
  try {
    // Use spawnSync with array of arguments for cross-platform compatibility
    const result = spawnSync('git', ['commit', '-m', message], {
      encoding: 'utf-8',
      stdio: 'inherit',
      shell: false
    });
    
    if (result.error) {
      throw result.error;
    }
    
    if (result.status !== 0) {
      throw new Error(`Git commit exited with code ${result.status}`);
    }
  } catch (error) {
    throw new Error(`Failed to commit: ${error.message}`);
  }
}
