#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════════
#  Choose setup mode
# ═══════════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}╔══════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       ${GREEN}Digital Me — Setup Wizard${BLUE}           ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════╝${NC}\n"

echo -e "${YELLOW}How would you like to run Digital Me?${NC}\n"
echo -e "  ${CYAN}1)${NC} ${GREEN}System${NC}  — Install directly on this machine (Mac / Linux / Termux)"
echo -e "  ${CYAN}2)${NC} ${GREEN}Docker${NC}  — Run everything in containers (requires Docker)\n"
read -rp "Choose [1/2] (default: 1): " SETUP_MODE
SETUP_MODE=${SETUP_MODE:-1}
echo ""

# ═══════════════════════════════════════════════════════════════════════════════
#  Shared: Create directories & .env.local
# ═══════════════════════════════════════════════════════════════════════════════
setup_directories() {
    echo -e "${YELLOW}Creating environment directories...${NC}"
    mkdir -p data/vector
    mkdir -p data/processed/static
    mkdir -p data/processed/dynamic
    mkdir -p data/processed/episodic
    mkdir -p data/reports
    mkdir -p .logs
    echo -e "${GREEN}Directories created successfully.${NC}\n"
}

setup_env_file() {
    echo -e "${YELLOW}Setting up environment variables...${NC}"
    if [ ! -f .env.local ]; then
        cat <<EOT > .env.local
# LLM Provider: "ollama" or "gemini"
LLM_PROVIDER=ollama

# GitHub integration
GITHUB_TOKEN=your_github_token
GITHUB_USERNAME=your_github_username

# Strava integration
STRAVA_ACCESS_TOKEN=your_strava_token

# Gemini (optional — cloud-based, no local LLM needed)
# GEMINI_API_KEY=your_gemini_api_key
# GEMINI_MODEL=gemini-2.0-flash

# Optional: Override API URL
# DIGITAL_ME_API_URL=http://localhost:7000/api
EOT
        echo -e "${GREEN}Created .env.local template.${NC}"
    else
        echo -e "${GREEN}.env.local already exists. Skipping creation.${NC}"
    fi
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
#  Mode 1: System Install
# ═══════════════════════════════════════════════════════════════════════════════
setup_system() {
    echo -e "${BLUE}── System Setup ──────────────────────────────${NC}\n"

    # Directories
    setup_directories

    # Node.js
    echo -e "${YELLOW}Checking for Node.js (v18+)...${NC}"
    if ! command -v node &> /dev/null; then
        echo -e "${RED}Node.js could not be found. Please install Node.js v18 or higher.${NC}"
        exit 1
    fi
    NODE_VERSION=$(node -v)
    echo -e "${GREEN}Node.js installed: $NODE_VERSION${NC}\n"

    # npm install
    echo -e "${YELLOW}Installing npm dependencies...${NC}"
    npm install
    echo -e "${GREEN}Dependencies installed successfully.${NC}\n"

    # Ollama
    echo -e "${YELLOW}Checking for Ollama...${NC}"
    if ! command -v ollama &> /dev/null; then
        echo -e "${RED}Ollama could not be found. Please install Ollama from https://ollama.com/${NC}"
        echo -e "After installing, re-run this setup script."
        exit 1
    fi
    echo -e "${GREEN}Ollama is installed.${NC}\n"

    # Pull model
    echo -e "${YELLOW}Pulling the llama3 model (this may take a while)...${NC}"
    ollama pull llama3
    echo -e "${GREEN}Model pulled successfully.${NC}\n"

    # Environment file
    setup_env_file

    # Done
    echo -e "\n${BLUE}========================================================${NC}"
    echo -e "        ${GREEN}System Setup Complete!${NC}"
    echo -e "${BLUE}========================================================${NC}\n"

    echo -e "${YELLOW}Action Required:${NC}"
    echo -e "  1. Open ${BLUE}.env.local${NC} and add your GitHub & Strava tokens."
    echo -e "  2. Place your resume PDF at ${BLUE}memory/static/resume.pdf${NC}.\n"

    echo -e "${YELLOW}Ready for liftoff? Run these commands:${NC}"
    echo -e "  Terminal 1 (Next.js API):  ${GREEN}npm run dev${NC}"
    echo -e "  Terminal 2 (Ingest Data):  ${GREEN}npm run cli ingest${NC}"
    echo -e "  Terminal 3 (Chat CLI):     ${GREEN}npm run cli chat${NC}"

    echo -e "\n${BLUE}========================================================${NC}\n"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  Mode 2: Docker Setup
# ═══════════════════════════════════════════════════════════════════════════════
setup_docker() {
    echo -e "${BLUE}── Docker Setup ──────────────────────────────${NC}\n"

    # Check Docker
    echo -e "${YELLOW}Checking for Docker...${NC}"
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Docker could not be found. Please install Docker Desktop from https://docker.com${NC}"
        exit 1
    fi
    echo -e "${GREEN}Docker is installed.${NC}\n"

    # Check Docker Compose
    echo -e "${YELLOW}Checking for Docker Compose...${NC}"
    if docker compose version &> /dev/null; then
        COMPOSE_CMD="docker compose"
    elif command -v docker-compose &> /dev/null; then
        COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}Docker Compose could not be found. Please install it — it ships with Docker Desktop.${NC}"
        exit 1
    fi
    echo -e "${GREEN}Docker Compose is available ($COMPOSE_CMD).${NC}\n"

    # Directories (needed for volume mounts)
    setup_directories

    # Environment file
    setup_env_file

    # Build & start containers
    echo -e "${YELLOW}Building and starting containers...${NC}"
    echo -e "${CYAN}This will build the Next.js app and pull the Ollama image.${NC}"
    echo -e "${CYAN}First run may take a few minutes.${NC}\n"
    $COMPOSE_CMD -f docker/docker-compose.yml up -d --build

    echo -e "\n${GREEN}Containers are running!${NC}\n"

    # Pull the model inside the Ollama container
    echo -e "${YELLOW}Pulling llama3 model inside the Ollama container...${NC}"
    echo -e "${CYAN}(this may take a while on first run)${NC}\n"
    docker exec -it digital-me-ollama ollama pull llama3
    echo -e "${GREEN}Model pulled successfully.${NC}\n"

    # Done
    echo -e "\n${BLUE}========================================================${NC}"
    echo -e "        ${GREEN}Docker Setup Complete!${NC}"
    echo -e "${BLUE}========================================================${NC}\n"

    echo -e "${YELLOW}Action Required:${NC}"
    echo -e "  1. Open ${BLUE}.env.local${NC} and add your GitHub & Strava tokens."
    echo -e "  2. Place your resume PDF at ${BLUE}memory/static/resume.pdf${NC}.\n"

    echo -e "${YELLOW}Services running:${NC}"
    echo -e "  ${GREEN}Next.js API${NC}   →  http://localhost:7000"
    echo -e "  ${GREEN}Ollama${NC}        →  http://localhost:11434\n"

    echo -e "${YELLOW}Useful commands:${NC}"
    echo -e "  View logs:     ${GREEN}$COMPOSE_CMD -f docker/docker-compose.yml logs -f${NC}"
    echo -e "  Stop:          ${GREEN}$COMPOSE_CMD -f docker/docker-compose.yml down${NC}"
    echo -e "  Restart:       ${GREEN}$COMPOSE_CMD -f docker/docker-compose.yml up -d${NC}"
    echo -e "  Ingest data:   ${GREEN}docker exec -it digital-me-app npm run cli ingest${NC}"
    echo -e "  Chat CLI:      ${GREEN}docker exec -it digital-me-app npm run cli chat${NC}"

    echo -e "\n${BLUE}========================================================${NC}\n"
}

# ═══════════════════════════════════════════════════════════════════════════════
#  Run the chosen mode
# ═══════════════════════════════════════════════════════════════════════════════
case $SETUP_MODE in
    1) setup_system ;;
    2) setup_docker ;;
    *)
        echo -e "${RED}Invalid choice. Please run the script again and pick 1 or 2.${NC}"
        exit 1
        ;;
esac
