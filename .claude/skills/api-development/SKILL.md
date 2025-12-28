---
name: api-development
description: API route development guidelines for Hybe Hydra. Use when creating API endpoints, handling requests, or when user says "create API", "add endpoint", "API route".
---

# API Development Guide

Guidelines for building API routes in the Hybe Hydra platform.

## When to Use

- Creating new API endpoints
- Handling HTTP requests/responses
- Integrating with external services
- Database operations via API

## API Route Structure

```
app/api/
├── v1/                          # Versioned API
│   ├── admin/                   # Admin-only endpoints
│   │   └── prompts/
│   ├── ai/                      # AI-related endpoints
│   │   └── jobs/
│   ├── campaigns/               # Campaign CRUD
│   ├── compose/                 # Video composition
│   ├── fast-cut/                # Fast-cut workflow
│   │   ├── script/
│   │   ├── images/
│   │   └── music/
│   ├── generations/             # Generation management
│   └── trends/                  # Trend data
└── auth/                        # Authentication (non-versioned)
```

## Route Handler Pattern

### Basic Route Handler

```typescript
// app/api/v1/my-feature/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1. Authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get query params
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "10");

    // 3. Database query
    const data = await db.myTable.findMany({
      where: { userId: session.user.id },
      take: limit,
    });

    // 4. Return response
    return NextResponse.json({ data });
  } catch (error) {
    console.error("[MY_FEATURE_GET]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse body
    const body = await req.json();
    const { name, description } = body;

    // Validate
    if (!name) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    // Create record
    const record = await db.myTable.create({
      data: {
        name,
        description,
        userId: session.user.id,
      },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (error) {
    console.error("[MY_FEATURE_POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

### Dynamic Route Handler

```typescript
// app/api/v1/campaigns/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Fetch by ID
  const campaign = await db.campaign.findUnique({
    where: { id },
  });

  if (!campaign) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ data: campaign });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updated = await db.campaign.update({
    where: { id },
    data: body,
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await db.campaign.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

## Authentication

### Server-Side Auth Check

```typescript
import { getServerSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // session.user.id - User ID
  // session.user.email - User email
}
```

### Admin-Only Routes

```typescript
export async function POST(req: NextRequest) {
  const session = await getServerSession();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admin logic here
}
```

## Database Operations (Supabase)

### Using Supabase Client

```typescript
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();

  // Query
  const { data, error } = await supabase
    .from("generations")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("[DB_ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
```

### Insert with Supabase

```typescript
const { data, error } = await supabase
  .from("campaigns")
  .insert({
    name: body.name,
    user_id: session.user.id,
    status: "draft",
  })
  .select()
  .single();
```

## AI Agent Integration

### Using Agents in API Routes

```typescript
import { createScriptWriterAgent } from "@/lib/agents/creators/script-writer";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // Create agent instance
  const agent = createScriptWriterAgent();

  // Execute with context
  const result = await agent.execute(
    {
      concept: body.concept,
      platform: body.platform,
      duration: body.duration,
    },
    {
      userId: session.user.id,
      campaignId: body.campaignId,
      workflow: {
        artistName: body.artistName,
        platform: body.platform,
      },
    }
  );

  return NextResponse.json({ data: result });
}
```

## Error Handling

### Standard Error Responses

```typescript
// 400 Bad Request - Invalid input
return NextResponse.json(
  { error: "Invalid input", details: { field: "name", message: "Required" } },
  { status: 400 }
);

// 401 Unauthorized - Not logged in
return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

// 403 Forbidden - No permission
return NextResponse.json({ error: "Forbidden" }, { status: 403 });

// 404 Not Found
return NextResponse.json({ error: "Resource not found" }, { status: 404 });

// 500 Internal Server Error
return NextResponse.json({ error: "Internal server error" }, { status: 500 });
```

### Error Logging Convention

```typescript
// Always log with route identifier
console.error("[ROUTE_NAME_METHOD]", error);

// Examples
console.error("[CAMPAIGNS_POST]", error);
console.error("[FAST_CUT_SCRIPT_POST]", error);
console.error("[GENERATIONS_ID_GET]", error);
```

## Response Patterns

### Success Responses

```typescript
// Single item
return NextResponse.json({ data: item });

// List with pagination
return NextResponse.json({
  data: items,
  pagination: {
    total: 100,
    page: 1,
    limit: 10,
    hasMore: true,
  },
});

// Creation success
return NextResponse.json({ data: created }, { status: 201 });

// Delete success
return NextResponse.json({ success: true });
```

### Streaming Response (AI)

```typescript
export async function POST(req: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Stream chunks
      for await (const chunk of generateChunks()) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## External API Integration

### Calling External Services

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Call external API
  const response = await fetch("https://api.external.com/endpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.EXTERNAL_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("[EXTERNAL_API_ERROR]", error);
    return NextResponse.json(
      { error: "External service error" },
      { status: 502 }
    );
  }

  const data = await response.json();
  return NextResponse.json({ data });
}
```

## File Uploads

### Handling File Upload

```typescript
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Upload to S3
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `uploads/${Date.now()}-${file.name}`;

  await s3.putObject({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: file.type,
  });

  return NextResponse.json({
    data: { url: `https://${process.env.S3_BUCKET}.s3.amazonaws.com/${key}` },
  });
}
```

## Caching

### Cache Headers

```typescript
export async function GET(req: NextRequest) {
  const data = await fetchData();

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    }
  );
}
```

## Rate Limiting Pattern

```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "10 s"),
});

export async function POST(req: NextRequest) {
  const ip = req.ip ?? "127.0.0.1";
  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString(),
        },
      }
    );
  }

  // Continue with request
}
```

## Checklist for New API Routes

- [ ] Auth check (if required)
- [ ] Input validation
- [ ] Error handling with proper status codes
- [ ] Logging with route identifier
- [ ] TypeScript types for request/response
- [ ] Rate limiting (if public endpoint)
- [ ] Documentation (if public API)
