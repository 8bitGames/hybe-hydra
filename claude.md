# Claude Rules

  ## General Restrictions
  - Do NOT run `npm run dev` or `npm run build` without explicit user permission
  - Do NOT create README or markdown files unless explicitly told to
  - Do NOT change AI models (e.g., Gemini model versions) without explicit user permission

  ## Database Operations
  - ALWAYS use Supabase MCP tools (`mcp__supabase__*`) for database migrations and schema lookups instead of raw SQL
  files or Drizzle CLI
  ## Documentation
  - ALWAYS check with Context7 MCP tool (`mcp__context7__*`) for library documentation before implementing code

  ## Gemini AI Integration
  When using Gemini AI, follow these requirements:

  ### Dependencies
  ```bash
  npm install @google/genai mime
  npm install -D @types/node

  Model Selection

  - For image generation: use gemini-3-pro-image-preview
  - For text generation: use gemini-flash-lite-latest

  Required Code Pattern

  import { GoogleGenAI } from '@google/genai';

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const tools = [{ googleSearch: {} }];

  const config = {
    thinkingConfig: {
      thinkingLevel: 'HIGH',
    },
    tools,
  };

  const response = await ai.models.generateContentStream({
    model: 'gemini-flash-lite-latest', // or gemini-3-pro-image-preview for images
    config,
    contents: [
      {
        role: 'user',
        parts: [{ text: 'your prompt here' }],
      },
    ],
  });

  for await (const chunk of response) {
    console.log(chunk.text);
  }
- use only muted colors like black, grey, and white. never use colors unless i tell you to for design.