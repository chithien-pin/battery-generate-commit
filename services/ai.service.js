import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama3-8b-8192';

/**
 * Load the commit prompt template
 * @returns {string} Prompt template
 */
function loadPromptTemplate() {
  const promptPath = join(__dirname, '..', 'prompts', 'commit.prompt.txt');
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Build the prompt with the diff
 * @param {string} diff - Git diff content
 * @returns {string} Formatted prompt
 */
function buildPrompt(diff) {
  const template = loadPromptTemplate();
  return template.replace('{{DIFF}}', diff);
}

/**
 * Validate and clean the AI-generated commit message
 * @param {string} message - Raw AI output
 * @param {Object} config - Configuration object
 * @returns {string|null} Cleaned commit message or null if invalid
 */
function validateCommitMessage(message, config) {
  if (!message) return null;
  
  // Remove any markdown code blocks if present
  let cleaned = message
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
  
  // Remove any leading/trailing quotes
  cleaned = cleaned.replace(/^["']|["']$/g, '').trim();
  
  // Split by newlines and take the first line
  const lines = cleaned.split('\n');
  cleaned = lines[0].trim();
  
  if (!cleaned) return null;
  
  // Check length
  if (cleaned.length > config.maxTitleLength) {
    cleaned = cleaned.substring(0, config.maxTitleLength).trim();
  }
  
  // Basic validation: should start with a conventional commit type
  const typePattern = new RegExp(`^(${config.allowedTypes.join('|')})(\\(.*\\))?:`, 'i');
  if (!typePattern.test(cleaned)) {
    // Try to prepend a type if missing
    cleaned = `feat: ${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Generate commit message using Groq API
 * @param {string} diff - Git diff content
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Generated commit message
 */
export async function generateCommitMessage(diff, config) {
  const apiKey = process.env.BATT_GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'BATT_GROQ_API_KEY environment variable is not set. ' +
      'Please set it with: export BATT_GROQ_API_KEY=your_api_key'
    );
  }
  
  const prompt = buildPrompt(diff);
  
  // Set up timeout (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 100
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText}. ` +
        `${errorData.error?.message || 'Unknown error'}`
      );
    }
    
    const data = await response.json();
    const rawMessage = data.choices?.[0]?.message?.content || '';
    
    if (!rawMessage) {
      throw new Error('No response from AI model');
    }
    
    const validatedMessage = validateCommitMessage(rawMessage, config);
    
    if (!validatedMessage) {
      throw new Error('AI generated invalid commit message');
    }
    
    return validatedMessage;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('Request timeout: Groq API did not respond within 30 seconds.');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to Groq API. Check your internet connection.');
    }
    throw error;
  }
}
