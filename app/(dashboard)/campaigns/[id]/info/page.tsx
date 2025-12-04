"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useCampaign, useAssetsStats, useUpdateCampaign } from "@/lib/queries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pencil,
  Check,
  X,
  Calendar,
  User,
  FolderOpen,
  Image,
  Video,
  Music,
  Package,
  Sparkles,
  Film,
  Send,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";

const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  archived: "outline",
};

const statusLabels: Record<string, { ko: string; en: string }> = {
  draft: { ko: "초안", en: "Draft" },
  active: { ko: "활성", en: "Active" },
  completed: { ko: "완료", en: "Completed" },
  archived: { ko: "보관됨", en: "Archived" },
};

export default function CampaignInfoPage() {
  const params = useParams();
  const router = useRouter();
  const { language, t } = useI18n();
  const campaignId = params.id as string;

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({
    name: "",
    description: "",
    status: "",
    start_date: "",
    end_date: "",
  });

  // Use TanStack Query for data fetching with caching
  const { data: campaign, isLoading: loading, error: campaignError } = useCampaign(campaignId);
  const { data: stats } = useAssetsStats(campaignId);
  const updateCampaignMutation = useUpdateCampaign();

  const saving = updateCampaignMutation.isPending;

  // Initialize edit data when campaign loads
  if (campaign && editData.name === "" && editData.status === "") {
    setEditData({
      name: campaign.name,
      description: campaign.description || "",
      status: campaign.status,
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
    });
  }

  // Redirect if campaign not found
  if (campaignError) {
    router.push("/campaigns");
  }

  const handleSave = async () => {
    if (!campaign) return;

    updateCampaignMutation.mutate(
      {
        id: campaign.id,
        data: {
          name: editData.name,
          description: editData.description || undefined,
          status: editData.status,
          start_date: editData.start_date || undefined,
          end_date: editData.end_date || undefined,
        },
      },
      { onSuccess: () => setEditMode(false) }
    );
  };

  const handleCancel = () => {
    if (campaign) {
      setEditData({
        name: campaign.name,
        description: campaign.description || "",
        status: campaign.status,
        start_date: campaign.start_date || "",
        end_date: campaign.end_date || "",
      });
    }
    setEditMode(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  if (!campaign) return null;

  return (
    <div className="space-y-6 px-[7%]">
      {/* Campaign Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <CardTitle className="text-xl">
            {language === "ko" ? "캠페인 정보" : "Campaign Information"}
          </CardTitle>
          {!editMode && (
            <Button variant="outline" size="sm" onClick={() => setEditMode(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              {language === "ko" ? "수정" : "Edit"}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editMode ? (
            <div className="space-y-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  {language === "ko" ? "캠페인 이름" : "Campaign Name"}
                </Label>
                <Input
                  id="name"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  placeholder={language === "ko" ? "캠페인 이름 입력" : "Enter campaign name"}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">
                  {language === "ko" ? "설명" : "Description"}
                </Label>
                <Textarea
                  id="description"
                  value={editData.description}
                  onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                  placeholder={language === "ko" ? "캠페인 설명 입력..." : "Enter description..."}
                  rows={3}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>{language === "ko" ? "상태" : "Status"}</Label>
                <Select
                  value={editData.status}
                  onValueChange={(value) => setEditData({ ...editData, status: value })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label[language]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">
                    {language === "ko" ? "시작일" : "Start Date"}
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={editData.start_date}
                    onChange={(e) => setEditData({ ...editData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">
                    {language === "ko" ? "종료일" : "End Date"}
                  </Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={editData.end_date}
                    onChange={(e) => setEditData({ ...editData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <Spinner className="h-4 w-4 mr-2" />
                  ) : (
                    <Check className="h-4 w-4 mr-2" />
                  )}
                  {language === "ko" ? "저장" : "Save"}
                </Button>
                <Button variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 mr-2" />
                  {language === "ko" ? "취소" : "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Name & Status */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold">{campaign.name}</h2>
                  {campaign.description && (
                    <p className="text-muted-foreground mt-2">{campaign.description}</p>
                  )}
                </div>
                <Badge variant={statusVariants[campaign.status]} className="text-sm">
                  {statusLabels[campaign.status]?.[language] || campaign.status}
                </Badge>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                {/* Artist */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "아티스트" : "Artist"}
                    </p>
                    <p className="font-medium">
                      {campaign.artist_stage_name || campaign.artist_name || "-"}
                    </p>
                  </div>
                </div>

                {/* Start Date */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "시작일" : "Start Date"}
                    </p>
                    <p className="font-medium">
                      {campaign.start_date
                        ? new Date(campaign.start_date).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                </div>

                {/* End Date */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "종료일" : "End Date"}
                    </p>
                    <p className="font-medium">
                      {campaign.end_date
                        ? new Date(campaign.end_date).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                </div>

                {/* Created */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">
                      {language === "ko" ? "생성일" : "Created"}
                    </p>
                    <p className="font-medium">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Asset Stats */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {language === "ko" ? "에셋 현황" : "Asset Statistics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <FolderOpen className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "전체" : "Total"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Image className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.image}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "이미지" : "Images"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Video className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.video}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "비디오" : "Videos"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Music className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.audio}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "오디오" : "Audio"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.goods}</p>
                  <p className="text-xs text-muted-foreground">
                    {language === "ko" ? "굿즈" : "Goods"}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {language === "ko" ? "빠른 작업" : "Quick Actions"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <FolderOpen className="h-6 w-6" />
                <span>{language === "ko" ? "에셋 관리" : "Manage Assets"}</span>
              </Button>
            </Link>

            <Link href={`/campaigns/${campaignId}/create`}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Sparkles className="h-6 w-6" />
                <span>{language === "ko" ? "영상 만들기" : "Create Video"}</span>
              </Button>
            </Link>

            <Link href={`/campaigns/${campaignId}/curation`}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Film className="h-6 w-6" />
                <span>{language === "ko" ? "영상 보기" : "View Videos"}</span>
              </Button>
            </Link>

            <Link href={`/campaigns/${campaignId}/publish`}>
              <Button variant="outline" className="w-full h-auto py-4 flex flex-col gap-2">
                <Send className="h-6 w-6" />
                <span>{language === "ko" ? "발행하기" : "Publish"}</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
