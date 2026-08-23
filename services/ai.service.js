import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Groq API constants
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Primary model plus fallbacks. Each model has its own rate-limit bucket on Groq,
// so a 429 on one model can still succeed on the next. See:
// https://console.groq.com/docs/models and https://console.groq.com/docs/rate-limits
const GROQ_MODEL_CHAIN = [
  // Compound has a much smaller per-request body limit than its 70K TPM cap.
  { id: 'groq/compound', maxTotalTokens: 2800 },
  // OSS models use a separate rate-limit bucket and handle larger diffs well.
  { id: 'openai/gpt-oss-20b', maxTotalTokens: 7000, reasoningEffort: 'low', maxCompletionTokens: 200 },
  { id: 'openai/gpt-oss-120b', maxTotalTokens: 7000, reasoningEffort: 'low', maxCompletionTokens: 200 },
];

// Gemini API constants
const GEMINI_MODEL = 'gemini-3-flash-preview';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// OpenAI (ChatGPT) API constants
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = 'gpt-4o-mini'; // Fast and cost-effective

// Anthropic (Claude) API constants
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_MODEL = 'claude-3-5-haiku-20241022'; // Fast and cost-effective

// Rough estimate: ~4 characters per token (conservative estimate)
const CHARS_PER_TOKEN = 4;
// Starting budget for a single request. groq/compound allows 70K TPM on the free
// plan, but the limit varies per organization, so this is only an opening bid:
// the real limit is read from the API's rate-limit headers and applied on retry.
const MAX_TOTAL_TOKENS = 60000;
// Reserve for the prompt template, the provider's system preamble and the reply.
const PROMPT_OVERHEAD_TOKENS = 500;
// Maximum tokens for the diff content only
const MAX_DIFF_TOKENS = MAX_TOTAL_TOKENS - PROMPT_OVERHEAD_TOKENS;
// Shrinking the diff below this leaves too little context to describe the change
const MIN_DIFF_TOKENS = 500;
// How many times to shrink the diff and retry after a too-large rejection
const MAX_TOKEN_LIMIT_RETRIES = 4;

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
 * @param {number} maxDiffTokens - Token budget for the diff
 * @returns {string} Truncated diff
 */
function truncateDiff(diff, maxDiffTokens = MAX_DIFF_TOKENS) {
  const estimatedTokens = estimateTokens(diff);
  
  if (estimatedTokens <= maxDiffTokens) {
    return diff;
  }
  
  // Calculate max characters to keep (conservative estimate)
  const maxChars = maxDiffTokens * CHARS_PER_TOKEN;
  
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
 * Token budget left for the diff once the template and reply are accounted for
 * @param {number} maxTotalTokens - Budget for the whole request
 * @returns {number} Token budget for the diff
 */
function diffBudgetFor(maxTotalTokens) {
  return Math.max(MIN_DIFF_TOKENS, maxTotalTokens - PROMPT_OVERHEAD_TOKENS);
}

/**
 * Build the prompt with the diff
 * @param {string} diff - Git diff content
 * @param {number} maxTotalTokens - Budget for the whole request
 * @returns {string} Formatted prompt
 */
function buildPrompt(diff, maxTotalTokens = MAX_TOTAL_TOKENS) {
  const template = loadPromptTemplate();
  const truncatedDiff = truncateDiff(diff, diffBudgetFor(maxTotalTokens));
  
  return template.replace('{{DIFF}}', truncatedDiff);
}

/**
 * Read the API's token limit from rate-limit headers, falling back to the
 * "Limit N" figure that Groq includes in too-large error messages.
 * @param {Response} response - Rejected fetch response
 * @param {Object} errorData - Parsed error body
 * @returns {number|null} Token limit, or null if the API did not report one
 */
function parseTokenLimit(response, errorData) {
  const header = Number(response.headers.get('x-ratelimit-limit-tokens'));
  if (Number.isFinite(header) && header > 0) {
    return header;
  }
  
  const match = /limit[:\s]+([\d,]+)/i.exec(errorData?.error?.message || '');
  if (match) {
    const reported = Number(match[1].replace(/,/g, ''));
    if (Number.isFinite(reported) && reported > 0) {
      return reported;
    }
  }
  
  return null;
}

/**
 * Whether Groq rejected the request because of rate limits (RPM/TPM/RPD).
 * @param {number} status - HTTP status code
 * @param {Object} errorData - Parsed error body
 * @returns {boolean}
 */
function isGroqRateLimitError(status, errorData) {
  if (status === 429) {
    return true;
  }
  
  const code = (errorData?.error?.code || '').toLowerCase();
  return code.includes('rate_limit') || code.includes('rate limit');
}

/**
 * Parse the commit message text from a Groq chat completion response.
 * @param {Object} data - Parsed response body
 * @returns {string}
 */
function parseGroqMessage(data) {
  const message = data.choices?.[0]?.message;
  if (!message) {
    return '';
  }
  
  const content = (message.content || '').trim();
  if (content) {
    return content;
  }
  
  // Reasoning models may spend the token budget on `reasoning` and leave `content` empty.
  const reasoning = (message.reasoning || '').trim();
  if (!reasoning) {
    return '';
  }
  
  const commitPattern = /(?:feat|fix|refactor|chore|test)(?:\([^)]+\))?:\s*[^\n."']+/i;
  const lines = reasoning.split('\n').map((line) => line.trim()).filter(Boolean);
  
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].replace(/^["']|["']$/g, '');
    if (commitPattern.test(line)) {
      return line.match(commitPattern)[0].trim();
    }
  }
  
  const match = reasoning.match(commitPattern);
  return match ? match[0].trim() : '';
}

/**
 * Build the JSON body for a Groq chat completion request.
 * @param {Object} modelConfig - Entry from GROQ_MODEL_CHAIN
 * @param {string} prompt - Fully rendered prompt
 * @returns {Object}
 */
function buildGroqRequestBody(modelConfig, prompt) {
  const body = {
    model: modelConfig.id,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: 0.7,
    max_tokens: modelConfig.maxCompletionTokens || 100
  };
  
  if (modelConfig.reasoningEffort) {
    body.reasoning_effort = modelConfig.reasoningEffort;
  }
  
  return body;
}

/**
 * Pick the next token budget after a too-large rejection.
 * @param {number} budget - Current budget
 * @param {number} totalPromptTokens - Estimated tokens in the rejected prompt
 * @param {Response} response - Rejected fetch response
 * @param {Object} errorData - Parsed error body
 * @returns {number}
 */
function nextBudgetAfterTooLarge(budget, totalPromptTokens, response, errorData) {
  const apiLimit = parseTokenLimit(response, errorData);
  
  // x-ratelimit-limit-tokens is the org TPM cap, not the per-request body limit.
  // Only trust it when the rejected prompt actually exceeded that cap.
  if (apiLimit && apiLimit < totalPromptTokens) {
    return Math.floor(apiLimit * 0.9);
  }
  
  return Math.floor(budget / 2);
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
  
  const estimatedTokens = estimateTokens(diff);
  const rateLimitErrors = [];
  let modelStartIndex = 0;
  const primaryDiffBudget = diffBudgetFor(GROQ_MODEL_CHAIN[0].maxTotalTokens);
  
  if (estimatedTokens > primaryDiffBudget && GROQ_MODEL_CHAIN.length > 1) {
    console.warn(
      `⚠️  Diff is large (estimated ${estimatedTokens} tokens). ` +
      `Skipping ${GROQ_MODEL_CHAIN[0].id} and using ${GROQ_MODEL_CHAIN[1].id}...`
    );
    modelStartIndex = 1;
  }
  
  for (let modelIndex = modelStartIndex; modelIndex < GROQ_MODEL_CHAIN.length; modelIndex++) {
    const modelConfig = GROQ_MODEL_CHAIN[modelIndex];
    const { id: model, maxTotalTokens } = modelConfig;
    let budget = maxTotalTokens;
    
    for (let attempt = 0; ; attempt++) {
      const diffBudget = diffBudgetFor(budget);
      if (estimatedTokens > diffBudget) {
        console.warn(`⚠️  Diff is large (estimated ${estimatedTokens} tokens). Truncating to ~${diffBudget} tokens to fit API limits...`);
      }
      
      const prompt = buildPrompt(diff, budget);
      const totalPromptTokens = estimateTokens(prompt);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      let response;
      try {
        response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(buildGroqRequestBody(modelConfig, prompt)),
          signal: controller.signal
        });
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout: Groq API did not respond within 30 seconds.');
        }
        
        if (error instanceof TypeError && error.message.includes('fetch')) {
          throw new Error('Network error: Failed to connect to Groq API. Check your internet connection.');
        }
        throw error;
      } finally {
        clearTimeout(timeoutId);
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || 'Unknown error';
        
        if (isGroqRateLimitError(response.status, errorData)) {
          rateLimitErrors.push(`${model}: ${errorMessage}`);
          const nextModel = GROQ_MODEL_CHAIN[modelIndex + 1];
          
          if (nextModel) {
            console.warn(`⚠️  ${model} is rate limited. Trying fallback model ${nextModel.id}...`);
            break;
          }
          
          throw new Error(
            `All Groq models are rate limited. ` +
            `Wait a minute and try again, or switch provider in .batt/config.json. ` +
            `Details: ${rateLimitErrors.join(' | ')}`
          );
        }
        
        if (response.status === 413) {
          const apiLimit = parseTokenLimit(response, errorData);
          const nextBudget = nextBudgetAfterTooLarge(budget, totalPromptTokens, response, errorData);
          const canRetry = attempt < MAX_TOKEN_LIMIT_RETRIES &&
                           nextBudget < budget &&
                           nextBudget > PROMPT_OVERHEAD_TOKENS + MIN_DIFF_TOKENS;
          
          if (canRetry) {
            console.warn(`⚠️  ${model} rejected ${totalPromptTokens} tokens${apiLimit ? ` (reported limit ${apiLimit})` : ''}. Retrying with ~${nextBudget} tokens...`);
            budget = nextBudget;
            continue;
          }
          
          const nextModel = GROQ_MODEL_CHAIN[modelIndex + 1];
          if (nextModel) {
            console.warn(`⚠️  ${model} cannot fit this diff. Trying fallback model ${nextModel.id}...`);
            break;
          }
          
          throw new Error(
            `Diff is too large for the API. The request sent approximately ${totalPromptTokens} tokens ` +
            `(diff alone: ${estimatedTokens})${apiLimit ? `, but the limit is ${apiLimit}` : ''}. ` +
            `Consider committing smaller changes or splitting into multiple commits. ` +
            `Original error: ${errorMessage}`
          );
        }
        
        const nextModel = GROQ_MODEL_CHAIN[modelIndex + 1];
        if (nextModel && (response.status >= 500 || response.status === 404)) {
          console.warn(`⚠️  ${model} failed (${response.status}). Trying fallback model ${nextModel.id}...`);
          break;
        }
        
        throw new Error(
          `Groq API error: ${response.status} ${response.statusText}. ` +
          `${errorMessage}`
        );
      }
      
      const data = await response.json();
      const rawMessage = parseGroqMessage(data);
      
      if (!rawMessage) {
        const nextModel = GROQ_MODEL_CHAIN[modelIndex + 1];
        if (nextModel) {
          console.warn(`⚠️  ${model} returned an empty response. Trying fallback model ${nextModel.id}...`);
          break;
        }
        
        throw new Error('No response from AI model');
      }
      
      const validatedMessage = validateCommitMessage(rawMessage, config);
      
      if (!validatedMessage) {
        throw new Error('AI generated invalid commit message');
      }
      
      if (modelIndex > 0) {
        console.warn(`ℹ️  Generated using fallback model ${model}.`);
      }
      
      return validatedMessage;
    }
  }
  
  throw new Error('Failed to generate commit message with Groq.');
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
          `Diff is too large for the API. The request sent approximately ${totalPromptTokens} tokens ` +
          `(diff alone: ${estimatedTokens}), which exceeds the API limit. ` +
          `Consider committing smaller changes or splitting into multiple commits. ` +
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
 * Generate commit message using OpenAI (ChatGPT) API
 * @param {string} diff - Git diff content
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Generated commit message
 */
async function generateCommitMessageWithOpenAI(diff, config) {
  const apiKey = process.env.BATT_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'BATT_OPENAI_API_KEY or OPENAI_API_KEY environment variable is not set. ' +
      'Please set it with: export BATT_OPENAI_API_KEY=your_api_key'
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
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
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
          `Diff is too large for the API. The request sent approximately ${totalPromptTokens} tokens ` +
          `(diff alone: ${estimatedTokens}), which exceeds the API limit. ` +
          `Consider committing smaller changes or splitting into multiple commits. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}. ` +
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
      throw new Error('Request timeout: OpenAI API did not respond within 30 seconds.');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to OpenAI API. Check your internet connection.');
    }
    throw error;
  }
}

/**
 * Generate commit message using Anthropic (Claude) API
 * @param {string} diff - Git diff content
 * @param {Object} config - Configuration object
 * @returns {Promise<string>} Generated commit message
 */
async function generateCommitMessageWithClaude(diff, config) {
  const apiKey = process.env.BATT_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error(
      'BATT_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY environment variable is not set. ' +
      'Please set it with: export BATT_ANTHROPIC_API_KEY=your_api_key'
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
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
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
          `Diff is too large for the API. The request sent approximately ${totalPromptTokens} tokens ` +
          `(diff alone: ${estimatedTokens}), which exceeds the API limit. ` +
          `Consider committing smaller changes or splitting into multiple commits. ` +
          `Original error: ${errorMessage}`
        );
      }
      
      throw new Error(
        `Anthropic API error: ${response.status} ${response.statusText}. ` +
        `${errorMessage}`
      );
    }
    
    const data = await response.json();
    const rawMessage = data.content?.[0]?.text || '';
    
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
      throw new Error('Request timeout: Anthropic API did not respond within 30 seconds.');
    }
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Network error: Failed to connect to Anthropic API. Check your internet connection.');
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
    case 'openai':
    case 'chatgpt':
      return await generateCommitMessageWithOpenAI(diff, config);
    case 'claude':
    case 'anthropic':
      return await generateCommitMessageWithClaude(diff, config);
    default:
      throw new Error(
        `Unsupported AI provider: ${provider}. Supported providers are: groq, gemini, openai, claude`
      );
  }
}
