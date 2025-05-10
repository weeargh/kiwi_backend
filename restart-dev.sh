#!/bin/bash

# Kill existing server and restart on port 8080
echo "🔄 Restarting development server on port 8080..."

# Kill any process using port 8080
echo "⚡ Killing any process using port 8080..."
if [ "$(uname)" == "Darwin" ]; then
  # macOS
  lsof -i :8080 -t | xargs kill -9 2>/dev/null || echo "No process found on port 8080"
elif [ "$(expr substr $(uname -s) 1 5)" == "Linux" ]; then
  # Linux
  fuser -k 8080/tcp 2>/dev/null || echo "No process found on port 8080"
elif [ "$(expr substr $(uname -s) 1 10)" == "MINGW32_NT" ] || [ "$(expr substr $(uname -s) 1 10)" == "MINGW64_NT" ]; then
  # Windows Git Bash
  netstat -ano | findstr :8080 | awk '{print $5}' | xargs taskkill /F /PID 2>/dev/null || echo "No process found on port 8080"
fi

# Navigate to frontend directory and start the server
cd frontend && npm run dev:force 