import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_CONFIG = {
  aiProvider: 'groq',
  maxTitleLength: 72,
  confirmBeforeCommit: true,
  allowedTypes: ['feat', 'fix', 'refactor', 'chore', 'test']
};

/**
 * Load configuration from .batt/config.json if it exists
 * @param {string} projectRoot - Root directory of the project
 * @returns {Object} Configuration object with defaults merged
 */
export function loadConfig(projectRoot = process.cwd()) {
  const configPath = join(projectRoot, '.batt', 'config.json');
  
  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }
  
  try {
    const configContent = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(configContent);
    
    // Merge with defaults, only allowing valid keys
    return {
      aiProvider: userConfig.aiProvider || DEFAULT_CONFIG.aiProvider,
      maxTitleLength: userConfig.maxTitleLength || DEFAULT_CONFIG.maxTitleLength,
      confirmBeforeCommit: userConfig.confirmBeforeCommit !== undefined 
        ? userConfig.confirmBeforeCommit 
        : DEFAULT_CONFIG.confirmBeforeCommit,
      allowedTypes: userConfig.allowedTypes || DEFAULT_CONFIG.allowedTypes
    };
  } catch (error) {
    console.warn(`⚠️  Failed to load config from ${configPath}: ${error.message}`);
    return DEFAULT_CONFIG;
  }
}
