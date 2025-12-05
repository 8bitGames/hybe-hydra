"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/auth-store";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ArrowLeft } from "@phosphor-icons/react";

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading } = useAuthStore();
  const { t } = useI18n();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError(t.auth.register.passwordMismatch);
      return;
    }

    if (password.length < 6) {
      setError(t.auth.register.passwordTooShort);
      return;
    }

    const result = await register(email, password, name);

    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || t.auth.register.error);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/logo.png"
              alt="Hydra"
              width={160}
              height={48}
              className="h-10 w-auto object-contain mx-auto"
              priority
            />
          </Link>
          <p className="text-muted-foreground mt-3">{t.auth.register.subtitle}</p>
        </div>

        {/* Register Form */}
        <Card className="border-border shadow-sm">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">{t.auth.register.title}</CardTitle>
            <CardDescription>
              {t.auth.register.description}
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
                <Label htmlFor="name">{t.auth.register.name}</Label>
                <Input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder={t.auth.register.namePlaceholder}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">{t.auth.register.email}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="example@email.com"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t.auth.register.password}</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={t.auth.register.passwordPlaceholder}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t.auth.register.confirmPassword}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder={t.auth.register.confirmPasswordPlaceholder}
                  className="h-11"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
                disabled={isLoading}
              >
                {isLoading ? <Spinner className="h-4 w-4" /> : t.auth.register.submit}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{t.auth.register.hasAccount} </span>
              <Link href="/login" className="font-medium text-foreground hover:underline">
                {t.auth.register.login}
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Back to home */}
        <div className="mt-6 text-center">
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} weight="bold" />
            {t.auth.register.backToHome}
          </Link>
        </div>
      </div>
    </div>
  );
}
