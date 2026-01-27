export const logger = {
  info: (message) => {
    console.log(`ℹ️  ${message}`);
  },
  
  success: (message) => {
    console.log(`✅ ${message}`);
  },
  
  error: (message) => {
    console.error(`❌ ${message}`);
  },
  
  warning: (message) => {
    console.warn(`⚠️  ${message}`);
  },
  
  plain: (message) => {
    console.log(message);
  }
};
