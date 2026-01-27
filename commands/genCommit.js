import { isGitRepository, hasStagedChanges, getStagedDiff, commitChanges } from '../services/git.service.js';
import { loadConfig } from '../services/config.service.js';
import { generateCommitMessage } from '../services/ai.service.js';
import { logger } from '../utils/logger.js';
import readline from 'readline';

/**
 * Prompt user for confirmation
 * @param {string} message - Message to display
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
function askConfirmation(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();
      resolve(normalized === 'y' || normalized === 'yes' || normalized === '');
    });
  });
}

/**
 * Main function to generate and commit
 */
export async function genCommit() {
  try {
    // Check if we're in a git repository
    if (!isGitRepository()) {
      logger.error('Not a git repository. Please run this command in a git repository.');
      process.exit(1);
    }
    
    // Check for staged changes
    if (!hasStagedChanges()) {
      logger.warning('No staged changes found.');
      logger.info('Stage your changes first with: git add <files>');
      process.exit(0);
    }
    
    // Load configuration
    const config = loadConfig();
    logger.info('Loading configuration...');
    
    // Get staged diff
    logger.info('Reading staged changes...');
    const diff = getStagedDiff();
    
    if (!diff) {
      logger.warning('Staged diff is empty.');
      process.exit(0);
    }
    
    // Generate commit message
    logger.info('Generating commit message with AI...');
    let commitMessage;
    
    try {
      commitMessage = await generateCommitMessage(diff, config);
      logger.success('Commit message generated!');
      logger.plain('');
      logger.plain('Generated commit message:');
      logger.plain(`  ${commitMessage}`);
      logger.plain('');
    } catch (error) {
      logger.warning(`Failed to generate commit message: ${error.message}`);
      logger.info('You can write your commit message manually.');
      logger.info('Run: git commit');
      process.exit(0);
    }
    
    // Ask for confirmation if enabled
    if (config.confirmBeforeCommit) {
      const confirmed = await askConfirmation('Commit with this message? (Y/n): ');
      
      if (!confirmed) {
        logger.info('Commit cancelled.');
        process.exit(0);
      }
    }
    
    // Commit changes
    logger.info('Committing changes...');
    commitChanges(commitMessage);
    logger.success('Changes committed successfully!');
    
  } catch (error) {
    logger.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
