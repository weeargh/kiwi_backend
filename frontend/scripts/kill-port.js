#!/usr/bin/env node

/**
 * Kill-port script - Finds and kills processes using a specified port
 * Usage: node kill-port.js [port]
 */

import { execSync } from 'child_process';

const port = process.argv[2] || '8080';

console.log(`👀 Checking for processes using port ${port}...`);

try {
  // Different commands based on platform
  if (process.platform === 'win32') {
    // Windows - find PID using netstat and kill it
    const output = execSync(`netstat -ano | findstr :${port}`).toString();
    console.log('Active connections:', output);
    
    const lines = output.split('\n').filter(line => line.includes(`LISTENING`) || line.includes(`ESTABLISHED`));
    
    if (lines.length > 0) {
      for (const line of lines) {
        const pid = line.trim().split(/\s+/).pop();
        if (pid && parseInt(pid)) {
          console.log(`🔫 Killing process ${pid} using port ${port}`);
          try {
            execSync(`taskkill /F /PID ${pid}`);
            console.log(`✅ Successfully killed process ${pid}`);
          } catch (killError) {
            console.error(`❌ Failed to kill process ${pid}:`, killError.message);
          }
        }
      }
    } else {
      console.log(`🎉 No processes found using port ${port}`);
    }
  } else {
    // macOS/Linux - use lsof to find the process and kill it
    try {
      const output = execSync(`lsof -i :${port} -t`).toString().trim();
      
      if (output) {
        const pids = output.split('\n');
        for (const pid of pids) {
          if (pid && parseInt(pid)) {
            console.log(`🔫 Killing process ${pid} using port ${port}`);
            try {
              execSync(`kill -9 ${pid}`);
              console.log(`✅ Successfully killed process ${pid}`);
            } catch (killError) {
              console.error(`❌ Failed to kill process ${pid}:`, killError.message);
            }
          }
        }
      } else {
        console.log(`🎉 No processes found using port ${port}`);
      }
    } catch (error) {
      // If lsof command fails, likely no process is using the port
      if (error.status !== 1) {
        console.error('❌ Error checking port:', error.message);
      } else {
        console.log(`🎉 No processes found using port ${port}`);
      }
    }
  }
  
  console.log(`🚀 Port ${port} is now available!`);
} catch (error) {
  console.error('❌ Error running kill-port script:', error.message);
  // Don't exit with error code, let the process continue even if we fail to kill
} 