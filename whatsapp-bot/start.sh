#!/bin/bash
# Startup script for WhatsApp Bot service
# Handles PORT environment variable and proper Python path setup

set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Set default PORT if not set
export PORT=${PORT:-8001}

# Ensure we're in the right directory
if [ ! -d "src" ]; then
    echo "Error: src directory not found. Please run from whatsapp-bot directory."
    exit 1
fi

# Run uvicorn
# If running from whatsapp-bot directory, use src.main:app
# If running from parent directory, use whatsapp-bot.src.main:app
if [ -f "src/main.py" ]; then
    exec uvicorn src.main:app --host 0.0.0.0 --port "$PORT"
else
    echo "Error: src/main.py not found"
    exit 1
fi

