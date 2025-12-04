"use client";

export default function AnalyzeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 top-28 overflow-hidden">
      {children}
    </div>
  );
}
