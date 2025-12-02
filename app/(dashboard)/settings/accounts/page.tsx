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
  Music,
  Youtube,
  Instagram,
  Twitter,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";

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
      return {
        icon: Music,
        name: "TikTok",
        color: "bg-pink-500/10 text-pink-500",
        bgColor: "bg-pink-500/10",
        textColor: "text-pink-500"
      };
    case "YOUTUBE":
      return {
        icon: Youtube,
        name: "YouTube",
        color: "bg-red-500/10 text-red-500",
        bgColor: "bg-red-500/10",
        textColor: "text-red-500"
      };
    case "INSTAGRAM":
      return {
        icon: Instagram,
        name: "Instagram",
        color: "bg-purple-500/10 text-purple-500",
        bgColor: "bg-purple-500/10",
        textColor: "text-purple-500"
      };
    case "TWITTER":
      return {
        icon: Twitter,
        name: "Twitter/X",
        color: "bg-blue-500/10 text-blue-500",
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-500"
      };
    default:
      return {
        icon: Smartphone,
        name: platform,
        color: "bg-gray-500/10 text-gray-500",
        bgColor: "bg-gray-500/10",
        textColor: "text-gray-500"
      };
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
  const { language } = useI18n();
  const isKorean = language === "ko";

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
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "연결된 계정을 불러오지 못했습니다" : "Failed to load connected accounts"
      );
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
      toast.error(
        isKorean ? "오류" : "Error",
        isKorean ? "사용 가능한 레이블이 없습니다. 관리자에게 문의하세요." : "No label available. Please contact admin."
      );
      return;
    }

    setConnecting("TIKTOK");
    try {
      const redirectUrl = `${window.location.origin}/settings/accounts`;

      const response = await api.get<{ authorization_url: string; state: string; detail?: string }>(
        `/api/v1/publishing/oauth/tiktok?label_id=${labelId}&redirect_url=${encodeURIComponent(redirectUrl)}`
      );

      console.log("OAuth API response:", response);
      console.log("OAuth API response.data:", response.data);

      if (response.data?.authorization_url) {
        // Store state in sessionStorage for callback verification
        sessionStorage.setItem("tiktok_oauth_state", response.data.state);
        // Redirect to TikTok OAuth
        window.location.href = response.data.authorization_url;
      } else {
        console.error("No authorization_url in response:", response.data);
        throw new Error(response.data?.detail || "Failed to get authorization URL");
      }
    } catch (err: any) {
      console.error("Failed to start TikTok OAuth:", err);
      console.error("Response data:", err?.response?.data);
      console.error("Response status:", err?.response?.status);
      const errorDetail = err?.response?.data?.detail || err?.message || (isKorean ? "TikTok 연결을 시작하지 못했습니다" : "Failed to start TikTok connection");
      toast.error(isKorean ? "연결 실패" : "Connection Failed", errorDetail);
      setConnecting(null);
    }
  };

  const handleDisconnect = async (accountId: string) => {
    setDisconnecting(accountId);
    try {
      await api.delete(`/api/v1/publishing/accounts/${accountId}`);
      toast.success(
        isKorean ? "계정 연결 해제" : "Account Disconnected",
        isKorean ? "소셜 계정 연결이 성공적으로 해제되었습니다." : "The social account has been disconnected successfully."
      );
      loadAccounts();
    } catch (err: any) {
      console.error("Failed to disconnect account:", err);
      toast.error(
        isKorean ? "오류" : "Error",
        err?.response?.data?.detail || (isKorean ? "계정 연결 해제에 실패했습니다" : "Failed to disconnect account")
      );
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
          <h2 className="text-2xl font-bold tracking-tight">
            {isKorean ? "연결된 계정" : "Connected Accounts"}
          </h2>
          <p className="text-muted-foreground">
            {isKorean
              ? "게시를 위한 소셜 미디어 계정 관리"
              : "Manage your social media accounts for publishing"}
          </p>
        </div>
        <Button variant="outline" onClick={loadAccounts} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          {isKorean ? "새로고침" : "Refresh"}
        </Button>
      </div>

      {/* TikTok Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-pink-500/10 rounded-lg">
                <Music className="h-6 w-6 text-pink-500" />
              </div>
              <div>
                <CardTitle>{isKorean ? "TikTok 계정" : "TikTok Accounts"}</CardTitle>
                <CardDescription>
                  {isKorean
                    ? "TikTok 계정을 연결하여 직접 영상 게시"
                    : "Connect TikTok accounts to publish videos directly"}
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
                      <SelectValue placeholder={isKorean ? "레이블 선택" : "Select Label"} />
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
                {isKorean ? "TikTok 연결" : "Connect TikTok"}
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
              <h3 className="font-medium mb-1">
                {isKorean ? "연결된 TikTok 계정이 없습니다" : "No TikTok accounts connected"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isKorean
                  ? "TikTok 계정을 연결하여 영상 게시를 시작하세요"
                  : "Connect your TikTok account to start publishing videos"}
              </p>
              <Button onClick={handleConnectTikTok} disabled={connecting === "TIKTOK"}>
                <Plus className="h-4 w-4 mr-2" />
                {isKorean ? "첫 번째 계정 연결" : "Connect Your First Account"}
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
                  isKorean={isKorean}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Platforms (Coming Soon) */}
      <Card>
        <CardHeader>
          <CardTitle>{isKorean ? "다른 플랫폼" : "Other Platforms"}</CardTitle>
          <CardDescription>
            {isKorean ? "추가 플랫폼 지원이 곧 제공됩니다" : "Support for additional platforms coming soon"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { platform: "YOUTUBE", name: "YouTube Shorts", Icon: Youtube, bgColor: "bg-red-500/10", textColor: "text-red-500", status: isKorean ? "곧 제공" : "Coming Soon" },
              { platform: "INSTAGRAM", name: "Instagram Reels", Icon: Instagram, bgColor: "bg-purple-500/10", textColor: "text-purple-500", status: isKorean ? "곧 제공" : "Coming Soon" },
              { platform: "TWITTER", name: "Twitter/X", Icon: Twitter, bgColor: "bg-blue-500/10", textColor: "text-blue-500", status: isKorean ? "곧 제공" : "Coming Soon" },
            ].map((item) => (
              <div
                key={item.platform}
                className="p-4 border rounded-lg opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-lg", item.bgColor)}>
                    <item.Icon className={cn("h-5 w-5", item.textColor)} />
                  </div>
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
          <CardTitle>{isKorean ? "연결 방법" : "How to Connect"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              1
            </div>
            <div>
              <h4 className="font-medium">
                {isKorean ? '"TikTok 연결" 클릭' : 'Click "Connect TikTok"'}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isKorean
                  ? "TikTok 로그인 페이지로 리디렉션됩니다"
                  : "You'll be redirected to TikTok's login page"}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              2
            </div>
            <div>
              <h4 className="font-medium">
                {isKorean ? "TikTok 계정으로 로그인" : "Log in with your TikTok account"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isKorean
                  ? "영상을 게시할 계정을 사용하세요"
                  : "Use the account you want to publish videos to"}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              3
            </div>
            <div>
              <h4 className="font-medium">
                {isKorean ? "권한 승인" : "Authorize permissions"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isKorean
                  ? "HYDRA가 대신 영상을 게시할 수 있도록 허용하세요"
                  : "Allow HYDRA to publish videos on your behalf"}
              </p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              4
            </div>
            <div>
              <h4 className="font-medium">
                {isKorean ? "게시 시작!" : "Start publishing!"}
              </h4>
              <p className="text-sm text-muted-foreground">
                {isKorean
                  ? "계정이 연결되어 사용 준비가 완료되었습니다"
                  : "Your account is now connected and ready to use"}
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
  isKorean,
}: {
  account: SocialAccount;
  onDisconnect: (id: string) => void;
  disconnecting: boolean;
  isKorean: boolean;
}) {
  const platformInfo = getPlatformInfo(account.platform);
  const PlatformIcon = platformInfo.icon;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <div className={cn("p-3 rounded-lg", platformInfo.bgColor)}>
        <PlatformIcon className={cn("h-6 w-6", platformInfo.textColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{account.account_name}</span>
          {account.is_token_valid ? (
            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
              <CheckCircle className="h-3 w-3 mr-1" />
              {isKorean ? "연결됨" : "Connected"}
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              {isKorean ? "토큰 만료" : "Token Expired"}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          {account.follower_count !== null && (
            <span>
              {formatNumber(account.follower_count)} {isKorean ? "팔로워" : "followers"}
            </span>
          )}
          <span>
            {account.scheduled_posts_count} {isKorean ? "예약된 게시물" : "scheduled posts"}
          </span>
          {account.token_expires_at && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {isKorean ? "만료: " : "Expires "}{new Date(account.token_expires_at).toLocaleDateString()}
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
                  {isKorean ? "연결 해제" : "Disconnect"}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isKorean ? "계정 연결을 해제하시겠습니까?" : "Disconnect Account?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isKorean ? (
                      <>
                        <strong>{account.account_name}</strong>의 연결을 해제하시겠습니까?
                        {account.scheduled_posts_count > 0 && (
                          <span className="block mt-2 text-destructive">
                            경고: 이 계정에는 {account.scheduled_posts_count}개의 예약된 게시물이 있으며, 게시에 실패합니다.
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Are you sure you want to disconnect <strong>{account.account_name}</strong>?
                        {account.scheduled_posts_count > 0 && (
                          <span className="block mt-2 text-destructive">
                            Warning: This account has {account.scheduled_posts_count} scheduled posts
                            that will fail to publish.
                          </span>
                        )}
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{isKorean ? "취소" : "Cancel"}</AlertDialogCancel>
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
                    {isKorean ? "연결 해제" : "Disconnect"}
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
