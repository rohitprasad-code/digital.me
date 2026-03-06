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
- **Environment Variables**: A `.env.docker` file in the `docker/` directory. You can use the provided template.

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
