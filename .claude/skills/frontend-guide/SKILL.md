---
name: frontend-guide
description: Frontend development guidelines for Hybe Hydra. Use when creating UI components, pages, or when user says "create component", "add page", "frontend", "UI".
---

# Frontend Development Guide

Guidelines for building UI components and pages in the Hybe Hydra platform.

## When to Use

- Creating new React components
- Adding new pages to the dashboard
- Styling with Tailwind CSS
- Using shadcn/ui components
- Implementing i18n translations

## Tech Stack

| Technology | Purpose |
|------------|---------|
| Next.js 14+ | App Router, Server Components |
| React 18+ | UI framework |
| Tailwind CSS | Utility-first styling |
| shadcn/ui | Component library (Radix UI based) |
| CVA | Class variance authority for variants |
| Zustand | State management |
| React Query | Server state & data fetching |
| lucide-react | Icons |

## Directory Structure

```
app/
├── (dashboard)/           # Dashboard routes (authenticated)
│   ├── home/
│   ├── campaigns/
│   ├── create/
│   ├── fast-cut/
│   └── settings/
├── (auth)/                # Auth routes
│   ├── login/
│   └── register/
├── (landing)/             # Public landing pages
└── api/                   # API routes

components/
├── ui/                    # shadcn/ui base components
├── features/              # Feature-specific components
│   ├── create/
│   ├── fast-cut/
│   ├── campaign/
│   └── pipeline/
├── shared/                # Shared/reusable components
├── layout/                # Layout components
├── dashboard/             # Dashboard widgets
└── landing/               # Landing page components
```

## Component Patterns

### Basic Component Template

```tsx
"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface MyComponentProps {
  className?: string;
  children?: React.ReactNode;
}

export function MyComponent({ className, children }: MyComponentProps) {
  const { t } = useI18n();

  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  );
}
```

### Component with Variants (CVA Pattern)

```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const componentVariants = cva(
  "base-styles inline-flex items-center", // Base classes
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border bg-background hover:bg-accent",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-sm",
        lg: "h-10 px-6",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

interface ComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
          VariantProps<typeof componentVariants> {}

export function Component({ className, variant, size, ...props }: ComponentProps) {
  return (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      {...props}
    />
  );
}
```

## Styling Guidelines

### Use cn() for Class Merging

```tsx
import { cn } from "@/lib/utils";

// Always use cn() for conditional classes
<div className={cn(
  "base-class",
  isActive && "active-class",
  variant === "large" && "text-lg",
  className
)} />
```

### Tailwind CSS Conventions

```tsx
// Color tokens (use semantic colors)
"bg-background"           // Main background
"bg-card"                  // Card background
"bg-primary"               // Primary brand color
"bg-muted"                 // Muted/subtle background
"text-foreground"          // Main text
"text-muted-foreground"    // Secondary text
"border-border"            // Default border

// Dark mode (automatic with CSS variables)
"dark:bg-input/30"         // Dark mode overrides

// Responsive
"md:flex-row"              // Tablet+
"lg:grid-cols-3"           // Desktop+

// States
"hover:bg-accent"
"focus-visible:ring-2"
"disabled:opacity-50"
```

### Spacing Standards

```tsx
// Padding
"p-4"   // 16px - Standard card padding
"p-6"   // 24px - Large card padding
"px-6"  // Horizontal padding for cards

// Gaps
"gap-2" // 8px - Tight spacing
"gap-4" // 16px - Standard spacing
"gap-6" // 24px - Section spacing

// Margins
"mb-4"  // Bottom margin between sections
"mt-8"  // Top margin for major sections
```

## i18n (Internationalization)

### Using Translations

```tsx
"use client";

import { useI18n } from "@/lib/i18n";

export function MyComponent() {
  const { t, language, translate } = useI18n();

  return (
    <div>
      {/* Direct access */}
      <h1>{t.common.save}</h1>

      {/* With parameters */}
      <p>{translate("campaign.itemCount", { count: 5 })}</p>

      {/* Language check */}
      {language === "ko" ? "한국어 전용" : "English only"}
    </div>
  );
}
```

### Adding Translations

Edit translation files:
- `lib/i18n/translations/ko.json` (Korean)
- `lib/i18n/translations/en.json` (English)

```json
{
  "myFeature": {
    "title": "Feature Title",
    "description": "Feature description with {param}",
    "actions": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

## State Management

### Zustand Store Pattern

```tsx
import { create } from "zustand";

interface MyStore {
  data: string;
  setData: (data: string) => void;
  reset: () => void;
}

export const useMyStore = create<MyStore>((set) => ({
  data: "",
  setData: (data) => set({ data }),
  reset: () => set({ data: "" }),
}));

// Usage with useShallow for selective subscription
import { useShallow } from "zustand/react/shallow";

const { data, setData } = useMyStore(
  useShallow((state) => ({
    data: state.data,
    setData: state.setData,
  }))
);
```

### React Query for Data Fetching

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Query
const { data, isLoading, error } = useQuery({
  queryKey: ["campaigns", userId],
  queryFn: () => fetchCampaigns(userId),
});

// Mutation
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: createCampaign,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
  },
});
```

## Common UI Components

### Using shadcn/ui Components

```tsx
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
```

### Icons (lucide-react)

```tsx
import {
  FileText,
  Image,
  Music,
  Play,
  ChevronRight,
  Sparkles,
  AlertCircle
} from "lucide-react";

<FileText className="h-4 w-4" />
<Sparkles className="size-5 text-primary" />
```

## Page Structure

### Dashboard Page Template

```tsx
// app/(dashboard)/my-feature/page.tsx
"use client";

import { useI18n } from "@/lib/i18n";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function MyFeaturePage() {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold">{t.myFeature.title}</h1>
        <p className="text-muted-foreground">{t.myFeature.description}</p>
      </div>

      {/* Content */}
      <Card>
        <CardHeader>
          <CardTitle>{t.myFeature.sectionTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Content here */}
        </CardContent>
      </Card>
    </div>
  );
}
```

### Layout with Sidebar

```tsx
// app/(dashboard)/my-feature/layout.tsx
export default function MyFeatureLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full">
      <aside className="w-64 border-r">
        {/* Sidebar */}
      </aside>
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  );
}
```

## Toast Notifications

```tsx
import { useToast } from "@/components/ui/toast";

const { toast } = useToast();

// Success
toast({
  title: "Success",
  description: "Operation completed",
});

// Error
toast({
  title: "Error",
  description: "Something went wrong",
  variant: "destructive",
});
```

## Loading & Error States

### Loading Skeleton

```tsx
import { Skeleton } from "@/components/ui/skeleton";

{isLoading ? (
  <div className="space-y-2">
    <Skeleton className="h-4 w-[250px]" />
    <Skeleton className="h-4 w-[200px]" />
  </div>
) : (
  <div>{content}</div>
)}
```

### Spinner

```tsx
import { Spinner } from "@/components/ui/spinner";

<Button disabled={isLoading}>
  {isLoading && <Spinner className="mr-2" />}
  Save
</Button>
```

## Best Practices

### Do's

- Use semantic color tokens (`bg-primary`, `text-muted-foreground`)
- Always add i18n translations for user-facing text
- Use `cn()` for class merging
- Prefer `useShallow` with Zustand for selective subscriptions
- Add loading and error states
- Use `data-slot` attributes for component parts

### Don'ts

- Don't use hardcoded colors (`bg-blue-500` → `bg-primary`)
- Don't hardcode text strings (use translations)
- Don't mutate state directly
- Don't forget `"use client"` for interactive components
- Don't skip error handling in data fetching

## File Naming Conventions

```
components/features/my-feature/
├── MyFeature.tsx           # Main component (PascalCase)
├── my-feature-item.tsx     # Sub-component (kebab-case)
├── use-my-feature.ts       # Hook (kebab-case with use- prefix)
└── types.ts                # Types
```

## Checklist for New Components

- [ ] Created in correct directory (`ui/`, `features/`, `shared/`)
- [ ] Uses `cn()` for class merging
- [ ] Has proper TypeScript types
- [ ] Uses i18n for user-facing text
- [ ] Follows existing component patterns
- [ ] Has loading/error states if fetching data
- [ ] Uses semantic color tokens
- [ ] Is responsive (mobile-first)
