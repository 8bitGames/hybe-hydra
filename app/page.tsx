"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Server, Database, Zap, ExternalLink, CheckCircle, XCircle } from "lucide-react";

interface HealthStatus {
  status: string;
  app?: string;
  version?: string;
  environment?: string;
  database?: string;
  redis?: string;
  error?: string;
}

export default function Home() {
  const [apiHealth, setApiHealth] = useState<HealthStatus | null>(null);
  const [dbHealth, setDbHealth] = useState<HealthStatus | null>(null);
  const [redisHealth, setRedisHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        // Check API health
        const apiRes = await fetch("/api/health");
        const apiData = await apiRes.json();
        setApiHealth(apiData);

        // Check DB health
        const dbRes = await fetch("/api/health/db");
        const dbData = await dbRes.json();
        setDbHealth(dbData);

        // Check Redis health
        const redisRes = await fetch("/api/health/redis");
        const redisData = await redisRes.json();
        setRedisHealth(redisData);
      } catch (error) {
        setApiHealth({ status: "error", error: "API not reachable" });
      } finally {
        setLoading(false);
      }
    };

    checkHealth();
  }, []);

  const StatusBadge = ({ status }: { status: string }) => (
    <Badge variant={status === "ok" ? "default" : "destructive"}>
      {status === "ok" ? (
        <><CheckCircle className="w-3 h-3 mr-1" />Connected</>
      ) : (
        <><XCircle className="w-3 h-3 mr-1" />Disconnected</>
      )}
    </Badge>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Image
              src="/logo.png"
              alt="HYBE HYDRA"
              width={300}
              height={90}
              className="h-20 w-auto object-contain"
              priority
            />
          </div>
          <p className="text-xl text-muted-foreground">
            Enterprise AI Video Orchestration Platform
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2">
            Powered by Google Veo 3 & Gemini Pro
          </p>

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <Button asChild size="lg">
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">Create Account</Link>
            </Button>
          </div>
        </header>

        {/* System Status */}
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Spinner className="h-8 w-8" />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* API Status */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Server className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Backend API</p>
                        <p className="text-muted-foreground text-sm">
                          {apiHealth?.app} v{apiHealth?.version}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={apiHealth?.status || "error"} />
                  </div>

                  {/* Database Status */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                        <Database className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">PostgreSQL</p>
                        <p className="text-muted-foreground text-sm">Database</p>
                      </div>
                    </div>
                    <StatusBadge status={dbHealth?.status || "error"} />
                  </div>

                  {/* Redis Status */}
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                        <Zap className="w-5 h-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-foreground font-medium">Redis</p>
                        <p className="text-muted-foreground text-sm">Cache & Queue</p>
                      </div>
                    </div>
                    <StatusBadge status={redisHealth?.status || "error"} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Quick Start</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    1
                  </span>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      docker-compose up -d
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start PostgreSQL, Redis, MinIO
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    2
                  </span>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      npm run db:push && npm run db:seed
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">Setup database schema & seed data</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-bold">
                    3
                  </span>
                  <div>
                    <code className="bg-muted px-2 py-1 rounded text-sm font-mono">
                      npm run dev
                    </code>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start Next.js application
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Links */}
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild variant="outline">
              <a
                href="http://localhost:5555"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Database className="w-4 h-4 mr-2" />
                Prisma Studio
                <ExternalLink className="w-3 h-3 ml-2" />
              </a>
            </Button>
            <Button asChild variant="outline">
              <a
                href="http://localhost:9001"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Server className="w-4 h-4 mr-2" />
                MinIO Console
                <ExternalLink className="w-3 h-3 ml-2" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
