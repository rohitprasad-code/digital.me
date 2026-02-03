# Rohit AI / Digital Twin

## Vision

A personal AI assistant representing Rohit Prasad — skills, projects, fitness, personality — accessible via rohitprasad.dev/chat.

## Core Idea

This is not just a chatbot. It is a Hybrid Memory AI System that evolves weekly using real data.

## Memory Layers

- Static Memory: Resume, bio, tech stack
- Dynamic Memory: Strava, GitHub, notes
- Episodic Memory: User chat history
- Real-time State: Availability, mood

## Architecture

User -> Next.js Chat UI -> API -> RAG Layer -> Model Router (Ollama / GPT) -> Streaming Response

## Update Cycle

Weekly cron fetches data, updates memory, embeds it, and commits changes.

## End Goal

Make /chat more powerful than a resume.
