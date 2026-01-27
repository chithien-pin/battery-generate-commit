import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Groq API constants
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// Gemini API constants
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Rough estimate: ~4 characters per token (conservative estimate)
const CHARS_PER_TOKEN = 4;
// Maximum tokens for the entire request (Groq on-demand tier: 6000 TPM)
// Reserve ~500 tokens for prompt template and ~100 for response
const MAX_TOTAL_TOKENS = 5400;
// Maximum tokens for the diff content only
const MAX_DIFF_TOKENS = 3000;

/**
 * Load the commit prompt template
 * @returns {string} Prompt template
 */
function loadPromptTemplate() {
  const promptPath = join(__dirname, '..', 'prompts', 'commit.prompt.txt');
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Estimate token count from text
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate diff intelligently to fit within token limits
 * @param {string} diff - Full diff content
 * @returns {string} Truncated diff
 */
function truncateDiff(diff) {
  const estimatedTokens = estimateTokens(diff);
  
  if (estimatedTokens <= MAX_DIFF_TOKENS) {
    return diff;
  }
  
  // Calculate max characters to keep (conservative estimate)
  const maxChars = MAX_DIFF_TOKENS * CHARS_PER_TOKEN;
  
  // Try to truncate at a file boundary
  const lines = diff.split('\n');
  let truncated = [];
  let currentLength = 0;
  let lastFileBoundaryIndex = -1;
  
  // First pass: find file boundaries and track positions
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for newline
    
    // Check if this is a file boundary
    const isFileBoundary = line.startsWith('diff --git') || 
                          (line.startsWith('---') && i > 0 && !lines[i-1].startsWith('---'));
    
    if (isFileBoundary) {
      lastFileBoundaryIndex = i;
    }
    
    // Stop early if we're approaching the limit
    if (currentLength + lineLength > maxChars * 0.9) {
      // Try to stop at the last file boundary if we're close
      if (lastFileBoundaryIndex >= 0 && currentLength > maxChars * 0.7) {
        // Truncate at last file boundary
        truncated.push('\n... (diff truncated - showing first ~' + 
                       Math.floor(currentLength / CHARS_PER_TOKEN) + ' tokens from ' +
                       Math.floor(estimatedTokens / 1000) + 'k total)');
        break;
      }
    }
    
    if (currentLength + lineLength <= maxChars) {
      truncated.push(line);
      currentLength += lineLength;
    } else {
      // Can't fit this line, truncate here
      truncated.push('\n... (diff truncated - showing first ~' + 
                     Math.floor(currentLength / CHARS_PER_TOKEN) + ' tokens from ' +
                     Math.floor(estimatedTokens / 1000) + 'k total)');
      break;
    }
  }
  
  return truncated.join('\n');
}

/**
 * Build the prompt with the diff
 * @param {string} diff - Git diff content
 * @returns {string} Formatted prompt
 */
function buildPrompt(diff) {
  const template = loadPromptTemplate();
  const truncatedDiff = truncateDiff(diff);
  const prompt = template.replace('{{DIFF}}', truncatedDiff);
  
  // Double-check total token count and truncate more aggressively if needed
  const totalTokens = estimateTokens(prompt);
  if (totalTokens > MAX_TOTAL_TOKENS) {
    // Calculate how much space we have for the diff
    const templateTokens = estimateTokens(template.replace('{{DIFF}}', ''));
    const reservedTokens = 100; // Reserve for response
    const availableDiffTokens = MAX_TOTAL_TOKENS - templateTokens - reservedTokens;
    
    // Ensure we don't exceed the available tokens
    const maxDiffChars = Math.floor(availableDiffTokens * CHARS_PER_TOKEN * 0.95); // 95% to be safe
    
    // Truncate more aggressively
    const lines = truncatedDiff.split('\n');
    let finalDiff = [];
    let currentLength = 0;
    
    for (const line of lines) {
      const lineLength = line.length + 1;
      if (currentLength + lineLength <= maxDiffChars) {
        finalDiff.push(line);
        currentLength += lineLength;
      } else {
        finalDiff.push('\n... (further truncated to fit API limits)');
        break;
      }
    }
    
    return template.replace('{{DIFF}}', finalDiff.join('\n'));
  }
  
  return prompt;
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
async function generateCommitMessageWithGroq(diff, config) {
  const apiKey = process.env.BATT_GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'BATT_GROQ_API_KEY environment variable is not set. ' +
      'Please set it with: export BATT_GROQ_API_KEY=your_api_key'
    );
  }
  
  // Check if diff is too large and warn
  const estimatedTokens = estimateTokens(diff);
  if (estimatedTokens > MAX_DIFF_TOKENS) {
    console.warn(`⚠️  Diff is large (estimated ${estimatedTokens} tokens). Truncating to ~${MAX_DIFF_TOKENS} tokens to fit API limits...`);
  }
  
  const prompt = buildPrompt(diff);
  
  // Final check on total prompt size
  const totalPromptTokens = estimateTokens(prompt);
  if (totalPromptTokens > MAX_TOTAL_TOKENS) {
    console.warn(`⚠️  Warning: Total prompt size (${totalPromptTokens} tokens) may exceed API limits. Further truncation applied.`);
  }
  
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
      const errorMessage = errorData.error?.message || 'Unknown error';
      
      // Handle 413 Payload Too Large specifically
      if (response.status === 413) {
        throw new Error(
          `Diff is too large for the API. The diff contains approximately ${estimateTokens(diff)} tokens, ` +
          `which exceeds the API limit. Consider committing smaller changes or splitting into multiple commits. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      throw new Error(
        `Groq API error: ${response.status} ${response.statusText}. ` +
        `${errorMessage}`
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

/**
 * Generate commit message using Gemini API
 * @param {string} diff - Git diff content
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Generated commit message
 */
async function generateCommitMessageWithGemini(diff, config) {
  const apiKey = process.env.BATT_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'BATT_GEMINI_API_KEY environment variable is not set. ' +
      'Please set it with: export BATT_GEMINI_API_KEY=your_api_key'
    );
  }
  
  // Check if diff is too large and warn
  const estimatedTokens = estimateTokens(diff);
  if (estimatedTokens > MAX_DIFF_TOKENS) {
    console.warn(`⚠️  Diff is large (estimated ${estimatedTokens} tokens). Truncating to ~${MAX_DIFF_TOKENS} tokens to fit API limits...`);
  }
  
  const prompt = buildPrompt(diff);
  
  // Final check on total prompt size
  const totalPromptTokens = estimateTokens(prompt);
  if (totalPromptTokens > MAX_TOTAL_TOKENS) {
    console.warn(`⚠️  Warning: Total prompt size (${totalPromptTokens} tokens) may exceed API limits. Further truncation applied.`);
  }
  
  // Set up timeout (30 seconds)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  try {
    const url = `${GEMINI_API_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 100
        }
      }),
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || 'Unknown error';
      
      // Handle 413 Payload Too Large specifically
      if (response.status === 413) {
        throw new Error(
          `Diff is too large for the API. The diff contains approximately ${estimateTokens(diff)} tokens, ` +
          `which exceeds the API limit. Consider committing smaller changes or splitting into multiple commits. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}. ` +
        `${errorMessage}`
      );
    }
    
    const data = await response.json();
    const rawMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
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
      throw new Error('Request timeout: Gemini API did not respond within 30 seconds.');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to Gemini API. Check your internet connection.');
    }
    throw error;
  }
}

/**
 * Generate commit message using the configured AI provider
 * @param {string} diff - Git diff content
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Generated commit message
 */
export async function generateCommitMessage(diff, config) {
  const provider = config.aiProvider?.toLowerCase() || 'groq';
  
  switch (provider) {
    case 'groq':
      return await generateCommitMessageWithGroq(diff, config);
    case 'gemini':
      return await generateCommitMessageWithGemini(diff, config);
    default:
      throw new Error(
        `Unsupported AI provider: ${provider}. Supported providers are: groq, gemini`
      );
  }
}
