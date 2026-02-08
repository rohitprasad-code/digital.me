#!/usr/bin/env node
import { Command } from 'commander';
import { startChat } from './chat';

const program = new Command();

program
  .name('digital-me')
  .description('CLI for Digital Me')
  .version('0.1.0');
  
program
    .command('chat')
    .description('Start a chat session with Digital Me')
    .action(() => {
        startChat();
    });

program.parse(process.argv);
