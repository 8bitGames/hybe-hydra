"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "@phosphor-icons/react";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const { t } = useI18n();

  const [email, setEmail] = useState("admin@hydra.com");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const result = await login(email, password);

    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || t.auth.login.error);
    }
  };

  return (
    <div
      className="fixed inset-0 min-h-screen w-full flex items-center justify-center px-4"
      style={{
        backgroundColor: '#FEFEFE',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999
      }}
    >
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold tracking-tight text-black">HYDRA</h1>
        </div>

        {/* Login Form */}
        <Card className="bg-white shadow-lg">
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">{t.auth.login.title}</CardTitle>
            <CardDescription>
              {t.auth.login.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.login.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.login.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t.auth.login.passwordPlaceholder}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? <Spinner className="h-4 w-4" /> : t.auth.login.submit}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t.auth.login.noAccount} </span>
              <Link href="/register" className="font-medium hover:underline">
                {t.auth.login.register}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to Home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            {t.auth.login.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
