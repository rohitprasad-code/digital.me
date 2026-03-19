# How to Run Digital Me

This document provides comprehensive instructions on how to run the Digital Me project across various environments.

## 1. Local Development (Node.js & Ollama)

### Prerequisites
- Node.js (v18+)
- Ollama installed locally

### Steps
1. **Start Ollama** with your preferred model in a separate terminal:
   ```bash
   ollama run llama3
   ```
2. **Install dependencies** in the root directory:
   ```bash
   npm install
   ```
3. **Configure Environment Variables**:
   Ensure `.env.local` is present with necessary tokens (GitHub, Strava, etc.) and `LLM_PROVIDER=ollama`.
4. **Data Ingestion** (First-time or to sync data):
   ```bash
   npm run cli ingest
   ```
5. **Run the Next.js Dev Server**:
   ```bash
   npm run dev
   ```
   *The server runs on `http://localhost:7001`.*
6. **Optional - Run CLI Chat**:
   Interact directly in the terminal:
   ```bash
   npm run cli chat
   ```

---

## 2. Docker Execution

If you prefer to run the API component inside an isolated docker container. Note that if using a local Ollama instance, Docker connects via `host.docker.internal`.

### Steps
1. **Prepare Environment File**: Ensure `docker/.env.docker` is correctly setup.
2. **Run Docker Compose**:
   ```bash
   cd docker
   docker-compose up --build -d
   ```
   *This starts the `digital-me` image and exposes port 7001 on the host, mounting the `../data` folder for memory persistence.*
3. **Check Logs**:
   ```bash
   docker-compose logs -f app
   ```
4. **Stop the Container**:
   ```bash
   docker-compose down
   ```

---

## 3. Termux Setup (Run on Android)

You can run the full Digital Me backend (API and Ollama) on an Android phone using Termux. 

For full details, please refer to [**TERMUX_SETUP.md**](./TERMUX_SETUP.md).

### Quick Summary
1. Install Termux (via F-Droid).
2. Install dependencies: `pkg install nodejs git ollama`
3. Run `ollama serve` and pull a lightweight model (e.g., `ollama pull llama3.2:1b`).
4. Clone the repository and `npm install`.
5. Optionally configure `LLM_PROVIDER=gemini` inside your `.env.local` to offload LLM compute to cloud, saving phone battery.
6. Start the server via `npm run dev`.
7. (Optional) Expose server globally using `cloudflared tunnel --url http://localhost:7001`.

---
