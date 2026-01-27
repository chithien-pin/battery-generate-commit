import readline from 'readline';
import { logger } from '../utils/logger.js';
import { existsSync, writeFileSync, mkdirSync, readFileSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';
import { platform, homedir } from 'os';

/**
 * Get shell profile path based on OS
 * @returns {string} Path to shell profile
 */
function getShellProfile() {
  const osPlatform = platform();
  const shell = process.env.SHELL || '';
  
  if (osPlatform === 'win32') {
    // Windows - use PowerShell profile
    return join(homedir(), 'Documents', 'WindowsPowerShell', 'profile.ps1');
  }
  
  // Unix-like systems
  if (shell.includes('zsh')) {
    return join(homedir(), '.zshrc');
  } else if (shell.includes('bash')) {
    return join(homedir(), '.bashrc');
  } else {
    // Default to .bashrc
    return join(homedir(), '.bashrc');
  }
}

/**
 * Prompt user for input
 * @param {string} question - Question to ask
 * @returns {Promise<string>} User input
 */
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

/**
 * Add environment variable to shell profile
 * @param {string} key - Environment variable name
 * @param {string} value - Environment variable value
 * @param {string} profilePath - Path to shell profile
 */
function addToShellProfile(key, value, profilePath) {
  const exportLine = platform() === 'win32' 
    ? `$env:${key}="${value}"`
    : `export ${key}=${value}`;
  
  const comment = `# Batt CLI - ${key}`;
  const content = `\n${comment}\n${exportLine}\n`;
  
  try {
    // Check if already exists
    if (existsSync(profilePath)) {
      const existingContent = readFileSync(profilePath, 'utf-8');
      if (existingContent.includes(key)) {
        logger.warning(`${key} already exists in ${profilePath}`);
        logger.info('Please update it manually or remove the old entry first.');
        return false;
      }
    } else {
      // Create directory if needed
      const dir = dirname(profilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    
    // Append to profile
    appendFileSync(profilePath, content);
    return true;
  } catch (error) {
    logger.error(`Failed to write to ${profilePath}: ${error.message}`);
    return false;
  }
}

/**
 * Setup API key interactively
 */
export async function setup() {
  try {
    logger.info('🚀 Batt CLI Setup');
    logger.plain('');
    logger.info('Chọn nhà cung cấp AI bạn muốn sử dụng:');
    logger.plain('  1. Groq (Mặc định - Nhanh và miễn phí)');
    logger.plain('  2. Gemini (Google)');
    logger.plain('  3. Cả hai');
    logger.plain('');
    
    const choice = await askQuestion('Nhập lựa chọn (1/2/3): ');
    
    const profilePath = getShellProfile();
    const osPlatform = platform();
    
    logger.plain('');
    logger.info(`Shell profile: ${profilePath}`);
    logger.plain('');
    
    if (choice === '1' || choice === '3') {
      logger.info('📝 Thiết lập Groq API Key');
      logger.info('Lấy API key tại: https://console.groq.com/');
      logger.plain('');
      
      const groqKey = await askQuestion('Nhập Groq API Key: ');
      
      if (groqKey) {
        if (osPlatform === 'win32') {
          logger.info('Thêm vào PowerShell profile...');
          addToShellProfile('BATT_GROQ_API_KEY', groqKey, profilePath);
          logger.info('Chạy: $env:BATT_GROQ_API_KEY="' + groqKey + '"');
        } else {
          logger.info('Thêm vào shell profile...');
          if (addToShellProfile('BATT_GROQ_API_KEY', groqKey, profilePath)) {
            logger.success('✅ Đã thêm BATT_GROQ_API_KEY vào ' + profilePath);
            logger.info('Chạy lệnh sau để áp dụng ngay:');
            logger.plain(`  source ${profilePath}`);
            logger.plain(`  hoặc: export BATT_GROQ_API_KEY="${groqKey}"`);
          }
        }
      }
      logger.plain('');
    }
    
    if (choice === '2' || choice === '3') {
      logger.info('📝 Thiết lập Gemini API Key');
      logger.info('Lấy API key tại: https://makersuite.google.com/app/apikey');
      logger.plain('');
      
      const geminiKey = await askQuestion('Nhập Gemini API Key: ');
      
      if (geminiKey) {
        if (osPlatform === 'win32') {
          logger.info('Thêm vào PowerShell profile...');
          addToShellProfile('BATT_GEMINI_API_KEY', geminiKey, profilePath);
          logger.info('Chạy: $env:BATT_GEMINI_API_KEY="' + geminiKey + '"');
        } else {
          logger.info('Thêm vào shell profile...');
          if (addToShellProfile('BATT_GEMINI_API_KEY', geminiKey, profilePath)) {
            logger.success('✅ Đã thêm BATT_GEMINI_API_KEY vào ' + profilePath);
            logger.info('Chạy lệnh sau để áp dụng ngay:');
            logger.plain(`  source ${profilePath}`);
            logger.plain(`  hoặc: export BATT_GEMINI_API_KEY="${geminiKey}"`);
          }
        }
      }
      logger.plain('');
    }
    
    if (choice !== '1' && choice !== '2' && choice !== '3') {
      logger.error('Lựa chọn không hợp lệ.');
      process.exit(1);
    }
    
    logger.success('✅ Setup hoàn tất!');
    logger.plain('');
    logger.info('Lưu ý:');
    logger.plain('  - Nếu bạn đã thêm vào shell profile, chạy: source ' + profilePath);
    logger.plain('  - Hoặc mở terminal mới để áp dụng thay đổi');
    logger.plain('  - Kiểm tra bằng: echo $BATT_GROQ_API_KEY (hoặc $BATT_GEMINI_API_KEY)');
    logger.plain('');
    logger.info('Bắt đầu sử dụng:');
    logger.plain('  batt -gen commit');
    
  } catch (error) {
    logger.error(`Setup failed: ${error.message}`);
    process.exit(1);
  }
}
