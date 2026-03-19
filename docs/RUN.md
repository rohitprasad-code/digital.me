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

Run the app inside an isolated container using Groq as the cloud LLM provider.

### Steps
1. **Configure** `docker/.env.docker` with your API keys (`GROQ_API_KEY` is required).
2. **Build and start**:
   ```bash
   docker compose -f docker/docker-compose.yml up -d --build
   ```
3. **Verify**:
   ```bash
   docker ps    # should show digital-me as "Up (healthy)"
   ```
4. Open **http://localhost:7001** in your browser.
5. **CLI** (optional):
   ```bash
   docker exec -it digital-me npm run cli ingest
   docker exec -it digital-me npm run cli chat
   ```
6. **Stop**:
   ```bash
   docker compose -f docker/docker-compose.yml down
   ```

> See [`docker/README.md`](../docker/README.md) for full details, volume mounts, and troubleshooting.

---

## 3. Cloudflare Tunnel (public access)

Expose your Docker instance to the internet — no port forwarding or static IP needed.

1. Create a tunnel at [Cloudflare Zero Trust](https://one.dash.cloudflare.com/) → **Networks** → **Tunnels**.
2. Copy the tunnel token into `docker-compose.yml` (under the `tunnel` service).
3. Add a public hostname in the Cloudflare dashboard:
   - **Subdomain**: e.g. `digital`
   - **Domain**: e.g. `rohitprasad.dev`
   - **Service URL**: `http://app:7001` (use the Docker service name, **not** `localhost`)
4. Start with the tunnel profile:
   ```bash
   docker compose -f docker/docker-compose.yml --profile tunnel up -d
   ```

Your app is live at `https://digital.yourdomain.dev` 🚀

---

## 4. Replicas (scaling)

Scale the app horizontally:

```bash
docker compose -f docker/docker-compose.yml up -d --scale app=3
```

> **Note:** Remove `container_name` and use a port range (e.g. `"7001-7003:7001"`) when scaling. The Cloudflare Tunnel auto-balances across replicas.

---

## 5. Termux Setup (Run on Android)

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

