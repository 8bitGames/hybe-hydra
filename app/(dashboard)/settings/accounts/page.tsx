"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  RefreshCw,
  MoreVertical,
  ExternalLink,
  Trash2,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

interface SocialAccount {
  id: string;
  platform: string;
  account_name: string;
  account_id: string;
  profile_url: string | null;
  follower_count: number | null;
  is_active: boolean;
  label_id: string;
  token_expires_at: string | null;
  scheduled_posts_count: number;
  is_token_valid: boolean;
  created_at: string;
  updated_at: string;
}

const getPlatformInfo = (platform: string) => {
  switch (platform) {
    case "TIKTOK":
      return { icon: "🎵", name: "TikTok", color: "bg-pink-500/10 text-pink-500" };
    case "YOUTUBE":
      return { icon: "📺", name: "YouTube", color: "bg-red-500/10 text-red-500" };
    case "INSTAGRAM":
      return { icon: "📸", name: "Instagram", color: "bg-purple-500/10 text-purple-500" };
    case "TWITTER":
      return { icon: "🐦", name: "Twitter/X", color: "bg-blue-500/10 text-blue-500" };
    default:
      return { icon: "📱", name: platform, color: "bg-gray-500/10 text-gray-500" };
  }
};

const formatNumber = (num: number | null): string => {
  if (num === null) return "-";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
};

interface Label {
  id: string;
  name: string;
  code: string;
}

export default function AccountsSettingsPage() {
  const router = useRouter();
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const toast = useToast();

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    if (accessToken) {
      api.setAccessToken(accessToken);
    }
  }, [accessToken]);

  const loadAccounts = useCallback(async () => {
    if (!isAuthenticated || !accessToken) return;

    setLoading(true);
    try {
      // Load accounts
      const response = await api.get<{ accounts: SocialAccount[]; total: number }>(
        "/api/v1/publishing/accounts"
      );
      if (response.data) {
        setAccounts(response.data.accounts);
      }

      // Load labels for ADMIN users or users without label_ids
      if (user?.role === "ADMIN" || !user?.label_ids?.length) {
        const labelsResponse = await api.get<{ labels: Label[] }>("/api/v1/labels");
        if (labelsResponse.data?.labels) {
          setLabels(labelsResponse.data.labels);
          // Auto-select first label if none selected
          if (!selectedLabelId && labelsResponse.data.labels.length > 0) {
            setSelectedLabelId(labelsResponse.data.labels[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
      toast.error("Error", "Failed to load connected accounts");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, accessToken, toast, user, selectedLabelId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleConnectTikTok = async () => {
    // Use user's label_id or selected label (for ADMIN)
    const labelId = user?.label_ids?.[0] || selectedLabelId;

    if (!labelId) {
      toast.error("Error", "No label available. Please contact admin.");
      return;
    }

    setConnecting("TIKTOK");
    try {
      const redirectUrl = `${window.location.origin}/settings/accounts`;

      const response = await api.get<{ authorization_url: string; state: string }>(
        `/api/v1/publishing/oauth/tiktok?label_id=${labelId}&redirect_url=${encodeURIComponent(redirectUrl)}`
      );

      if (response.data?.authorization_url) {
        // Store state in sessionStorage for callback verification
        sessionStorage.setItem("tiktok_oauth_state", response.data.state);
        // Redirect to TikTok OAuth
        window.location.href = response.data.authorization_url;
      } else {
        throw new Error("Failed to get authorization URL");
      }
    } catch (err: any) {
      console.error("Failed to start TikTok OAuth:", err);
      toast.error("Connection Failed", err?.response?.data?.detail || "Failed to start TikTok connection");
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      await api.delete(`/api/v1/publishing/accounts/${accountId}`);
      toast.success("Account Disconnected", "The social account has been disconnected successfully.");
      loadAccounts();
    } catch (err: any) {
      console.error("Failed to disconnect account:", err);
      toast.error("Error", err?.response?.data?.detail || "Failed to disconnect account");
    } finally {
      setDisconnecting(null);
    }
  };

  const tiktokAccounts = accounts.filter((a) => a.platform === "TIKTOK");
  const otherAccounts = accounts.filter((a) => a.platform !== "TIKTOK");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Connected Accounts</h2>
          <p className="text-muted-foreground">
            Manage your social media accounts for publishing
          </p>
        </div>
        <Button variant="outline" onClick={loadAccounts} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* TikTok Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-500/10 rounded-lg">
                <span className="text-2xl">🎵</span>
              </div>
              <div>
                <CardTitle>TikTok Accounts</CardTitle>
                <CardDescription>
                  Connect TikTok accounts to publish videos directly
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Label selector for ADMIN or users without labelIds */}
              {labels.length > 0 && (
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <Select
                    value={selectedLabelId || ""}
                    onValueChange={setSelectedLabelId}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select Label" />
                    </SelectTrigger>
                    <SelectContent>
                      {labels.map((label) => (
                        <SelectItem key={label.id} value={label.id}>
                          {label.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={handleConnectTikTok} disabled={connecting === "TIKTOK"}>
                {connecting === "TIKTOK" ? (
                  <Spinner className="h-4 w-4 mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Connect TikTok
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : tiktokAccounts.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No TikTok accounts connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect your TikTok account to start publishing videos
              </p>
              <Button onClick={handleConnectTikTok} disabled={connecting === "TIKTOK"}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Your First Account
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tiktokAccounts.map((account) => (
                <AccountCard
                  key={account.id}
                  account={account}
                  onDisconnect={handleDisconnect}
                  disconnecting={disconnecting === account.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Platforms (Coming Soon) */}
      <Card>
        <CardHeader>
          <CardTitle>Other Platforms</CardTitle>
          <CardDescription>
            Support for additional platforms coming soon
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { platform: "YOUTUBE", name: "YouTube Shorts", icon: "📺", status: "Coming Soon" },
              { platform: "INSTAGRAM", name: "Instagram Reels", icon: "📸", status: "Coming Soon" },
              { platform: "TWITTER", name: "Twitter/X", icon: "🐦", status: "Coming Soon" },
            ].map((item) => (
              <div
                key={item.platform}
                className="p-4 border rounded-lg opacity-60"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {item.status}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>How to Connect</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              1
            </div>
            <div>
              <h4 className="font-medium">Click &quot;Connect TikTok&quot;</h4>
              <p className="text-sm text-muted-foreground">
                You&apos;ll be redirected to TikTok&apos;s login page
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              2
            </div>
            <div>
              <h4 className="font-medium">Log in with your TikTok account</h4>
              <p className="text-sm text-muted-foreground">
                Use the account you want to publish videos to
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              3
            </div>
            <div>
              <h4 className="font-medium">Authorize permissions</h4>
              <p className="text-sm text-muted-foreground">
                Allow HYDRA to publish videos on your behalf
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              4
            </div>
            <div>
              <h4 className="font-medium">Start publishing!</h4>
              <p className="text-sm text-muted-foreground">
                Your account is now connected and ready to use
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AccountCard({
  account,
  onDisconnect,
  disconnecting,
}: {
  account: SocialAccount;
  onDisconnect: (id: string) => void;
  disconnecting: boolean;
}) {
  const platformInfo = getPlatformInfo(account.platform);

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className={cn("p-3 rounded-lg", platformInfo.color)}>
        <span className="text-2xl">{platformInfo.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{account.account_name}</span>
          {account.is_token_valid ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Token Expired
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          {account.follower_count !== null && (
            <span>{formatNumber(account.follower_count)} followers</span>
          )}
          <span>{account.scheduled_posts_count} scheduled posts</span>
          {account.token_expires_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires {new Date(account.token_expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {account.profile_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={account.profile_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Disconnect
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Disconnect Account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to disconnect <strong>{account.account_name}</strong>?
                    {account.scheduled_posts_count > 0 && (
                      <span className="block mt-2 text-destructive">
                        Warning: This account has {account.scheduled_posts_count} scheduled posts
                        that will fail to publish.
                      </span>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDisconnect(account.id)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={disconnecting}
                  >
                    {disconnecting ? (
                      <Spinner className="h-4 w-4 mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
