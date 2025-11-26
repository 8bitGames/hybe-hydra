"use client";

import { useEffect, useState } from "react";

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
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        status === "ok"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800"
      }`}
    >
      {status === "ok" ? "Connected" : "Disconnected"}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="text-center mb-16">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="text-5xl font-bold text-white">HYBE HYDRA</h1>
          </div>
          <p className="text-xl text-gray-300">
            Enterprise AI Video Orchestration Platform
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Powered by Google Veo 3 & Gemini Pro
          </p>
        </header>

        {/* System Status */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-6 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              System Status
            </h2>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* API Status */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">Backend API</p>
                      <p className="text-gray-400 text-sm">
                        {apiHealth?.app} v{apiHealth?.version}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={apiHealth?.status || "error"} />
                </div>

                {/* Database Status */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">PostgreSQL</p>
                      <p className="text-gray-400 text-sm">Database</p>
                    </div>
                  </div>
                  <StatusBadge status={dbHealth?.status || "error"} />
                </div>

                {/* Redis Status */}
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-5 h-5 text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 10V3L4 14h7v7l9-11h-7z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">Redis</p>
                      <p className="text-gray-400 text-sm">Cache & Queue</p>
                    </div>
                  </div>
                  <StatusBadge status={redisHealth?.status || "error"} />
                </div>
              </div>
            )}
          </div>

          {/* Quick Start Guide */}
          <div className="mt-8 bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Quick Start
            </h2>
            <div className="space-y-3 text-gray-300">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  1
                </span>
                <div>
                  <code className="bg-black/30 px-2 py-1 rounded text-sm">
                    docker-compose up -d
                  </code>
                  <p className="text-sm text-gray-400 mt-1">
                    Start PostgreSQL, Redis, MinIO
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  2
                </span>
                <div>
                  <code className="bg-black/30 px-2 py-1 rounded text-sm">
                    npm run db:push && npm run db:seed
                  </code>
                  <p className="text-sm text-gray-400 mt-1">Setup database schema & seed data</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  3
                </span>
                <div>
                  <code className="bg-black/30 px-2 py-1 rounded text-sm">
                    npm run dev
                  </code>
                  <p className="text-sm text-gray-400 mt-1">
                    Start Next.js application
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="mt-8 flex justify-center gap-4">
            <a
              href="http://localhost:5555"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                />
              </svg>
              Prisma Studio
            </a>
            <a
              href="http://localhost:9001"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                />
              </svg>
              MinIO Console
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
