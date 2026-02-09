#!/usr/bin/env node
import { Command } from 'commander';
import { loadEnvConfig } from '@next/env';
import { startChat } from './chat';

// Load environment variables from .env* files
loadEnvConfig(process.cwd());

const program = new Command();

program
  .name('digital-me')
  .description('CLI for Digital Me')
  .version('0.1.0');
  
program
    .command('chat')
    .description('Start a chat session with Digital Me')
    .option('-u, --url <url>', 'API URL to connect to')
    .action((options) => {
        const apiUrl = options.url || process.env.DIGITAL_ME_API_URL;
        startChat(apiUrl);
    });

program.parse(process.argv);
