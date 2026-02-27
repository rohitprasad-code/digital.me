#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting Digital Me setup...${NC}\n"

# 1. Create necessary environment directories
echo -e "${YELLOW}Creating environment directories...${NC}"
mkdir -p data
mkdir -p .logs
mkdir -p memory/static
mkdir -p memory/vector_store
echo -e "${GREEN}Directories created successfully.${NC}\n"

# 2. Check for Node.js
echo -e "${YELLOW}Checking for Node.js (v18+)...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js could not be found. Please install Node.js v18 or higher.${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
echo -e "${GREEN}Node.js installed: $NODE_VERSION${NC}\n"

# 3. Handle npm install
echo -e "${YELLOW}Installing npm dependencies...${NC}"
npm install
echo -e "${GREEN}Dependencies installed successfully.${NC}\n"

# 4. Check for Ollama
echo -e "${YELLOW}Checking for Ollama...${NC}"
if ! command -v ollama &> /dev/null; then
    echo -e "${RED}Ollama could not be found. Please install Ollama from https://ollama.com/${NC}"
    echo -e "After installing, re-run this setup script."
    exit 1
fi
echo -e "${GREEN}Ollama is installed.${NC}\n"

# 5. Pull Ollama model
echo -e "${YELLOW}Pulling the llama3 model (this may take a while)...${NC}"
ollama pull llama3
echo -e "${GREEN}Model pulled successfully.${NC}\n"

# 6. Create .env.local template if it doesn't exist
echo -e "${YELLOW}Setting up environment variables...${NC}"
if [ ! -f .env.local ]; then
    cat <<EOT > .env.local
# GitHub integration
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username

# Strava integration
STRAVA_ACCESS_TOKEN=your_strava_token

# Optional: Override API URL
# DIGITAL_ME_API_URL=http://localhost:7000/api
EOT
    echo -e "${GREEN}Created .env.local template.${NC}"
else
    echo -e "${GREEN}.env.local already exists. Skipping creation.${NC}"
fi
echo ""

# 7. Print final instructions
echo -e "\n${BLUE}========================================================${NC}"
echo -e "      ${GREEN}  Digital Me Setup Almost Complete! ${NC}"
echo -e "${BLUE}========================================================${NC}\n"

echo -e "${YELLOW}Action Required:${NC}"
echo -e "  1. Open ${BLUE}.env.local${NC} and add your GitHub & Strava tokens."
echo -e "  2. Place your resume PDF at ${BLUE}memory/static/resume.pdf${NC}.\n"

echo -e "${YELLOW}Ready for liftoff? Run these commands:${NC}"
echo -e "  Terminal 1 (Next.js API):  ${GREEN}npm run dev${NC}"
echo -e "  Terminal 2 (Ingest Data):  ${GREEN}npm run cli ingest${NC}"
echo -e "  Terminal 2 (Chat CLI):     ${GREEN}npm run cli chat${NC}"

echo -e "\n${BLUE}========================================================${NC}\n"
