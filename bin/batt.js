#!/usr/bin/env node

import { program } from 'commander';
import { genCommit } from '../commands/genCommit.js';

// Handle -gen commit syntax (before commander parses)
const args = process.argv.slice(2);
if (args[0] === '-gen' && args[1] === 'commit') {
  (async () => {
    try {
      await genCommit();
      process.exit(0);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  })();
} else {
  program
    .name('batt')
    .description('AI-powered git commit message generator')
    .version('1.0.0');

  program
    .command('gen')
    .alias('generate')
    .description('Generate a commit message')
    .argument('[type]', 'Type of generation (commit)', 'commit')
    .action(async (type) => {
      if (type === 'commit') {
        await genCommit();
      } else {
        console.error(`Unknown generation type: ${type}`);
        process.exit(1);
      }
    });

  program.parse();
}
