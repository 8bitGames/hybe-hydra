"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/10",
        className
      )}
    />
  );
}

// Card Skeleton
export function CardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20", className)}>
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  );
}

// Video Card Skeleton
export function VideoCardSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("bg-white/5 rounded-lg overflow-hidden border border-white/10", className)}>
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </div>
  );
}

// Trend Item Skeleton
export function TrendItemSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("flex items-center gap-3 p-3", className)}>
      <Skeleton className="w-6 h-6 rounded" />
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-full max-w-[120px]" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-6 rounded-full" />
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4, className }: SkeletonProps & { columns?: number }) {
  return (
    <div className={cn("flex items-center gap-4 p-4 border-b border-white/10", className)}>
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="h-4 flex-1" />
      ))}
    </div>
  );
}

// Chat Message Skeleton
export function ChatMessageSkeleton({ isUser = false, className }: SkeletonProps & { isUser?: boolean }) {
  return (
    <div className={cn("flex gap-3 mb-4", isUser && "flex-row-reverse", className)}>
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className={cn("space-y-2", isUser ? "items-end" : "items-start")}>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-4 gap-6", className)}>
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// List Skeleton
export function ListSkeleton({ items = 5, className }: SkeletonProps & { items?: number }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <TrendItemSkeleton key={i} />
      ))}
    </div>
  );
}

// Video Grid Skeleton
export function VideoGridSkeleton({ items = 6, className }: SkeletonProps & { items?: number }) {
  return (
    <div className={cn("grid grid-cols-2 md:grid-cols-3 gap-4", className)}>
      {Array.from({ length: items }).map((_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}
