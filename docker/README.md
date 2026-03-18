# Docker Setup for Digital Me

This directory contains the necessary files to containerize the Digital Me application while connecting to a local Ollama instance running on your host machine.

## Prerequisites

- **Docker Desktop**: Installed and running on your Mac.
- **Ollama**: Installed and running on your Mac.
- **Ollama Models**: Ensure you have pulled the required models locally:
  ```bash
  ollama pull llama3
  ollama pull nomic-embed-text
  ```
  ollama pull nomic-embed-text
  ```
- **Environment Variables**: A `.env.docker` file in the `docker/` directory. You can use the provided template.

## 🛠️ Implementation

The Docker setup uses a **multi-stage build** process to create a secure, production-ready environment for the Next.js application.

- **Base Image**: Uses `node:18-alpine` for a minimal, lightweight runtime.
- **Port Mapping**: The Next.js API server runs on port 7001 within the container, which is exposed to the host for interaction by the CLI or browser.
- **Host Connectivity**: Leverages `host.docker.internal` to allow the containerized application to communicate with a local instance of **Ollama** running outside the Docker environment.
- **Volume Management**: Persistent data (like vector store indices and reports) are stored in the `/app/data` and `/app/.memory` directories, which are recommended to be mounted as host volumes for persistence across container restarts.

## Building the Image

To build the image locally:

```bash
cd docker
docker build -f docker/Dockerfile -t debugger612/digital-me:latest .
```

Alternatively, using Docker Compose:

```bash
cd docker
docker compose build
```

## Running the Container Locally

### Using Docker Compose (Recommended)

Docker Compose handles port mapping, environment variables, and volume mounting for data persistence.

```bash
cd docker
docker compose up -d
```

### Using Docker Run

If you prefer to use `docker run`, ensure you pass the environment file:

```bash
docker run --env-file docker/.env.docker -p 7001:7001 --name digital-me debugger612/digital-me:latest
```

## Monitoring and Cleanup

- **View Logs**:
  ```bash
  docker logs -f digital-me
  ```
- **Stop Container**:
  ```bash
  docker stop digital-me
  ```
- **Remove Container**:
  ```bash
  docker rm -f digital-me
  ```
- **Stop Compose Services**:
  ```bash
  docker compose down
  ```

## Publishing to Docker Hub

1. **Login**:
   ```bash
   docker login
   ```
2. **Tag the Image**:
   ```bash
   docker tag digital-me:latest debugger612/digital-me:latest
   ```
3. **Push the Image**:
   ```bash
   docker push debugger612/digital-me:latest
   ```

## Running the Published Image

To run the latest image from Docker Hub:

```bash
docker run -d -p 7001:7001 --name digital-me debugger612/digital-me:latest
```

> [!IMPORTANT]
> When running the published image, ensure your `.env.local` contains `OLLAMA_HOST=http://host.docker.internal:11434` to correctly point to your host's Ollama instance.
