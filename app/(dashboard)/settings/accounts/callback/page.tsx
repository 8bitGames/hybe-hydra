"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accessToken } = useAuthStore();

  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("Processing TikTok authorization...");
  const [accountName, setAccountName] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  useEffect(() => {
    // Prevent double execution in React Strict Mode
    if (processedRef.current) return;

    const processCallback = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const error = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      // Handle TikTok error response
      if (error) {
        setStatus("error");
        setMessage(errorDescription || `TikTok authorization failed: ${error}`);
        return;
      }

      // Validate required parameters
      if (!code || !state) {
        setStatus("error");
        setMessage("Invalid callback: missing authorization code or state");
        return;
      }

      // Verify state matches (CSRF protection)
      const savedState = sessionStorage.getItem("tiktok_oauth_state");
      if (savedState && savedState !== state) {
        setStatus("error");
        setMessage("Security error: state mismatch. Please try again.");
        return;
      }

      // Clear saved state
      sessionStorage.removeItem("tiktok_oauth_state");

      // Mark as processed
      processedRef.current = true;

      try {
        // Exchange code for token
        const response = await api.post<{
          success: boolean;
          social_account: {
            id: string;
            platform: string;
            account_name: string;
            profile_url: string;
          };
          redirect_url: string;
          message: string;
        }>("/api/v1/publishing/oauth/tiktok", { code, state });

        if (response.data?.success) {
          setStatus("success");
          setAccountName(response.data.social_account.account_name);
          setMessage("TikTok account connected successfully!");

          // Redirect after success
          setTimeout(() => {
            router.push(response.data?.redirect_url || "/settings/accounts");
          }, 2000);
        } else {
          throw new Error("Failed to connect account");
        }
      } catch (err: any) {
        console.error("OAuth callback error:", err);
        setStatus("error");
        setMessage(
          err?.response?.data?.detail ||
            err?.message ||
            "Failed to connect TikTok account. Please try again."
        );
      }
    };

    if (accessToken) {
      processCallback();
    }
  }, [searchParams, accessToken, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {status === "loading" && (
              <div className="p-4 bg-blue-500/10 rounded-full">
                <Spinner className="h-12 w-12 text-blue-500" />
              </div>
            )}
            {status === "success" && (
              <div className="p-4 bg-green-500/10 rounded-full">
                <CheckCircle className="h-12 w-12 text-green-500" />
              </div>
            )}
            {status === "error" && (
              <div className="p-4 bg-red-500/10 rounded-full">
                <XCircle className="h-12 w-12 text-red-500" />
              </div>
            )}
          </div>
          <CardTitle>
            {status === "loading" && "Connecting TikTok..."}
            {status === "success" && "Connected!"}
            {status === "error" && "Connection Failed"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-muted-foreground">{message}</p>

          {status === "success" && accountName && (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground mb-1">Connected account</p>
              <p className="font-medium flex items-center justify-center gap-2">
                <span className="text-xl">🎵</span>
                {accountName}
              </p>
            </div>
          )}

          {status === "success" && (
            <p className="text-sm text-muted-foreground">
              Redirecting to accounts page...
            </p>
          )}

          {status === "error" && (
            <div className="space-y-3">
              <Button onClick={() => router.push("/settings/accounts")} className="w-full">
                Back to Accounts
              </Button>
              <Button
                variant="outline"
                onClick={() => router.push("/settings/accounts")}
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function TikTokCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center">
          <Spinner className="h-8 w-8" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
