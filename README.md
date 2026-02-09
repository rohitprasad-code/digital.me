# Digital Me

Digital Me is an AI-powered personal digital twin. It's designed to ingest your personal data (resume, GitHub activity, etc.) and use a local LLM (via Ollama) to answer questions as if it were you.

## Features

- **Personalized AI**: Uses RAG (Retrieval-Augmented Generation) to ground answers in your personal data.
- **Multi-Source Ingestion**:
  - **Resume (PDF)**: Extracts education, experience, projects, and skills.
  - **GitHub**: Fetches your profile, repositories, and recent commit activity.
  - **Static Data**: Configuration via `me.json` for core identity details.
- **CLI Interface**: Interact with your digital twin directly from the terminal.
- **Local Intelligence**: Powered by Ollama (Llama 3) for privacy and control.

## Prerequisites

- **Node.js**: v18+
- **Ollama**: Installed and running with `llama3` model pulled (`ollama pull llama3`).
- **GitHub Token**: A Personal Access Token (classic) with `repo` and `read:user` scopes.

## Setup

1.  **Clone the repository**:

    ```bash
    git clone https://github.com/yourusername/digital-me.git
    cd digital-me
    ```

2.  **Install dependencies**:

    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env.local` file in the root directory:

    ```env
    # Required for GitHub integration
    GITHUB_TOKEN=your_github_token
    GITHUB_USERNAME=your_github_username

    # Optional: API URL override
    # DIGITAL_ME_API_URL=http://localhost:3000/api
    ```

4.  **Prepare Data**:
    - Place your resume at `src/memory/static/resume.pdf`.
    - Update `src/memory/static/me.json` with your personal details.

## Quick Start

1.  **Start the API Server**:
    Run the Next.js development server in one terminal:

    ```bash
    npm run dev
    ```

2.  **Ingest Data**:
    In a new terminal, run the ingestion command to build the vector store:

    ```bash
    npm run cli ingest
    ```

3.  **Chat**:
    Start the CLI chat interface:
    ```bash
    npm run cli chat
    ```

## Project Structure

- `src/app/api`: The Next.js API route handling chat requests and RAG logic.
- `src/cli`: The command-line interface tools.
- `src/memory`: Vector store and data ingestion logic.
- `src/integrations`: Connectors for external services (e.g., GitHub).
- `src/model`: LLM client and prompt management.