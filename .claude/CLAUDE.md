# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Mirage AI - AI-powered virtual model chat and image generation platform. Next.js 15 app with React 19, Supabase auth, Drizzle ORM, and multi-language support (ko, en, ja, zh, id).

**Supabase Project ID**: `weqgfsfmqpstmghvmamt` (always use this for MCP tools)

## Common Commands

```bash
# Development (requires explicit permission)
npm run dev              # Next.js dev server with Turbopack
npm run inngest:dev      # Run Inngest dev server for background jobs

# Linting & Formatting (Biome)
npm run lint             # Check linting issues
npm run lint:fix         # Fix linting issues
npm run format           # Format code
npm run typecheck        # TypeScript type checking

# Testing
npm run test             # Run unit tests (Vitest)
npm run test:ui          # Unit tests with UI
npm run test:coverage    # Unit tests with coverage
npm run test:creator     # Run creator-specific tests
vitest run tests/unit/lib/db/schema.test.ts  # Single unit test file

npm run test:e2e         # Run E2E tests (Playwright)
npm run test:e2e:ui      # E2E tests with UI
npm run test:e2e:debug   # Debug E2E tests
npm run test:e2e:creator # Run creator E2E tests only
npm run test:e2e:mobile  # Run mobile viewport tests
npx playwright test tests/e2e/auth.spec.ts   # Single E2E test file

# Pre-deployment
npm run pre-deploy-check # Run deployment checks
```

## Architecture

### Directory Structure
- `src/app/` - Next.js App Router pages
  - `[locale]/` - Internationalized routes (ko default)
  - `api/` - API routes
- `src/actions/` - Server actions (`'use server'`)
- `src/lib/` - Core libraries and services
  - `db/` - Drizzle ORM schema and queries
  - `supabase/` - Supabase client (server/client/middleware)
  - `inngest/` - Background job functions
- `src/components/` - React components
- `src/hooks/` - Custom React hooks
- `locales/` - Translation files (ko.ts, en.ts, ja.ts, zh.ts, id.ts)

### Key Patterns

**Database**: Drizzle ORM with Supabase Postgres
- Schema defined in `src/lib/db/schema/`
- Use `db` from `@/lib/db` for queries
- Use `withRetry()` wrapper for resilient queries

**Authentication**: Supabase Auth
- Server: `createClient()` from `@/lib/supabase/server`
- Client: `createClient()` from `@/lib/supabase/client`
- Protected routes: `/studio`, `/brand`, `/chat`, `/generate`, `/profile`

**Server Actions**: Return `{ success: boolean, error?: string }` pattern
```typescript
'use server';
export async function myAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };
  // ... logic
  return { success: true };
}
```

**Background Jobs**: Inngest functions in `src/lib/inngest/functions/`

**Internationalization**: next-intl with locale-prefixed routes

## User Roles

Three user roles:
- **fan** - Chat with models, generate images via `(main)` routes
- **creator** - Model management via `/studio` in `(protected)` routes
- **brand** - Brand portal via `/brand`

## Restrictions

- Do NOT run `npm run dev` or `npm run build` without explicit user permission
- Do NOT create README or markdown files unless explicitly told to

## Database Operations

- ALWAYS use Supabase MCP tools (`mcp__supabase__*`) for database migrations and schema lookups instead of raw SQL files or Drizzle CLI

## Deployment

- Deploy to Vercel project `mirage-v4` (with hyphen) using custom domain `mirage.ai.kr`
- Do NOT use `mirage_v4` (with underscore) which uses `miragev4.vercel.app`

## Gemini AI Integration

When using Gemini AI:

**Model Selection**
- Image generation: `models/gemini-3-pro-image-preview`
- Text generation: `models/gemini-flash-lite-latest`

**Required Pattern**
```typescript
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const config = {
  thinkingConfig: { thinkingLevel: 'HIGH' },
  tools: [{ googleSearch: {} }],
};

const response = await ai.models.generateContentStream({
  model: 'gemini-flash-lite-latest',
  config,
  contents: [{ role: 'user', parts: [{ text: 'prompt' }] }],
});
```

## Code Style

- Biome for linting/formatting (single quotes, semicolons, 2-space indent)
- Path alias: `@/` maps to `src/`
- Use `camelCase` for functions/variables, `PascalCase` for components/types

## Additional Services

**voice-sidecar/** - Bun-based voice streaming service
- Uses `@google/genai` and `groq-sdk`
- Run with `bun run dev` (inside voice-sidecar directory)

**websocket-server/** - Bun + Hono WebSocket server (deployed to Fly.io)
- Real-time communication backend
- Uses Upstash Redis for pub/sub

## Route Groups

Routes are organized by user role under `src/app/[locale]/`:
- `(auth)/` - Login, signup, password reset
- `(main)/` - Fan-facing routes (discover, chat, generate, profile)
- `(protected)/` - Routes requiring authentication
- `admin/` - Admin dashboard
- `brand/` - Brand portal routes
