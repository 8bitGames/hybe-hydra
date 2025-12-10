"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useArtists, useCreateCampaign } from "@/lib/queries";
import type { Artist } from "@/lib/campaigns-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FolderPlus, Calendar, Users, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { InfoButton } from "@/components/ui/info-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ArtistModal } from "@/components/features/artist/ArtistModal";

export default function NewCampaignPage() {
  const router = useRouter();
  const { language } = useI18n();
  const [error, setError] = useState("");
  const [artistModalOpen, setArtistModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    artist_id: "",
    description: "",
    start_date: "",
    end_date: "",
  });

  // Use TanStack Query for data fetching with caching
  const { data: artists = [], refetch: refetchArtists } = useArtists();
  const createCampaignMutation = useCreateCampaign();

  const loading = createCampaignMutation.isPending;

  // Translations
  const t = {
    backToCampaigns: language === "ko" ? "캠페인 목록" : "Back to Campaigns",
    title: language === "ko" ? "새 캠페인 만들기" : "Create Campaign",
    subtitle: language === "ko" ? "아티스트를 위한 새로운 영상 캠페인을 설정하세요" : "Set up a new video campaign for your artist",
    required: language === "ko" ? "필수" : "required",
    campaignName: language === "ko" ? "캠페인 이름" : "Campaign Name",
    campaignNamePlaceholder: language === "ko" ? "예: 2025 여름 컴백" : "e.g., Summer Comeback 2025",
    campaignNameError: language === "ko" ? "캠페인 이름을 입력해주세요" : "Campaign name is required",
    artist: language === "ko" ? "아티스트" : "Artist",
    selectArtist: language === "ko" ? "아티스트 선택" : "Select an artist",
    artistError: language === "ko" ? "아티스트를 선택해주세요" : "Please select an artist",
    description: language === "ko" ? "설명" : "Description",
    descriptionPlaceholder: language === "ko"
      ? "예: 청량한 여름 분위기의 컴백 티저. 새 앨범 'Summer Wave'를 홍보하며, 해변과 파티 컨셉으로 젊고 에너지 넘치는 이미지 강조. 타겟은 10-20대 팬층."
      : "e.g., Fresh summer vibe comeback teaser. Promote new album 'Summer Wave' with beach and party concept, emphasizing young and energetic image. Target: teens and 20s fans.",
    startDate: language === "ko" ? "시작일" : "Start Date",
    endDate: language === "ko" ? "종료일" : "End Date",
    create: language === "ko" ? "캠페인 생성" : "Create Campaign",
    creating: language === "ko" ? "생성 중..." : "Creating...",
    cancel: language === "ko" ? "취소" : "Cancel",
    solo: language === "ko" ? "솔로" : "Solo",
    addNewArtist: language === "ko" ? "신규 아티스트 추가" : "Add New Artist",
    // Info button tooltips
    campaignNameInfo: language === "ko"
      ? "캠페인을 쉽게 구분할 수 있는 이름을 입력하세요. 예: 앨범명, 시즌, 프로모션 종류 등"
      : "Enter a name to easily identify this campaign. e.g., album name, season, promotion type",
    artistInfo: language === "ko"
      ? "이 캠페인에서 생성될 모든 콘텐츠의 주인공이 될 아티스트를 선택하세요"
      : "Select the artist who will be featured in all content created for this campaign",
    descriptionInfo: language === "ko"
      ? "⭐ 가장 중요! AI가 영상과 이미지를 생성할 때 이 설명을 참고합니다. 원하는 분위기, 컨셉, 타겟 팬층, 홍보 포인트 등을 자세히 적어주세요."
      : "⭐ Most important! AI uses this description when generating videos and images. Include desired mood, concept, target fans, and key promotion points.",
    periodInfo: language === "ko"
      ? "캠페인 기간을 설정하면 일정 관리와 분석에 도움이 됩니다 (선택사항)"
      : "Setting campaign period helps with scheduling and analytics (optional)",
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError(t.campaignNameError);
      return;
    }

    if (!formData.artist_id) {
      setError(t.artistError);
      return;
    }

    createCampaignMutation.mutate(
      {
        name: formData.name.trim(),
        artist_id: formData.artist_id,
        description: formData.description.trim() || undefined,
        start_date: formData.start_date || undefined,
        end_date: formData.end_date || undefined,
      },
      {
        onSuccess: (data) => {
          router.push(`/campaigns/${data.id}`);
        },
        onError: (err) => {
          setError(err.message);
        },
      }
    );
  };

  // Group artists by group_name
  const groupedArtists = artists.reduce((acc, artist) => {
    const group = artist.group_name || t.solo;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(artist);
    return acc;
  }, {} as Record<string, Artist[]>);

  return (
    <TooltipProvider>
      <div className="min-h-[calc(100vh-4rem)] flex flex-col py-6 px-[7%]">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/campaigns"
            className="text-muted-foreground hover:text-foreground transition-colors text-sm flex items-center gap-2 mb-4"
          >
            <ChevronLeft className="w-4 h-4" />
            {t.backToCampaigns}
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
              <FolderPlus className="w-5 h-5 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">{t.title}</h1>
              <p className="text-sm text-muted-foreground">{t.subtitle}</p>
            </div>
          </div>
        </div>

        {/* Form - Full Width */}
        <form onSubmit={handleSubmit} className="flex-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Required Fields */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive/50 rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                {/* Campaign Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    {t.campaignName}
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {t.required}
                    </Badge>
                    <InfoButton content={t.campaignNameInfo} />
                  </Label>
                  <Input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.campaignNamePlaceholder}
                    className="h-12"
                  />
                </div>

                {/* Artist Selection */}
                <div className="space-y-2">
                  <Label htmlFor="artist" className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t.artist}
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                      {t.required}
                    </Badge>
                    <InfoButton content={t.artistInfo} />
                  </Label>
                  <Select
                    value={formData.artist_id}
                    onValueChange={(value) => {
                      if (value === "__add_new_artist__") {
                        setArtistModalOpen(true);
                      } else {
                        setFormData({ ...formData, artist_id: value });
                      }
                    }}
                  >
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder={t.selectArtist} />
                    </SelectTrigger>
                    <SelectContent>
                      {/* Add New Artist Button */}
                      <SelectItem
                        value="__add_new_artist__"
                        className="text-primary font-medium"
                      >
                        <span className="flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          {t.addNewArtist}
                        </span>
                      </SelectItem>
                      <div className="h-px bg-border my-1" />
                      {Object.entries(groupedArtists).map(([group, groupArtists]) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {groupArtists.map((artist) => (
                            <SelectItem key={artist.id} value={artist.id}>
                              {artist.stage_name || artist.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-2">
                    {t.description}
                    <InfoButton content={t.descriptionInfo} />
                  </Label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder={t.descriptionPlaceholder}
                    rows={5}
                    className="w-full px-3 py-3 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Right Column - Optional Fields */}
            <Card>
              <CardContent className="pt-6 space-y-6">
                {/* Date Range */}
                <div className="space-y-4">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {language === "ko" ? "캠페인 기간" : "Campaign Period"}
                    <InfoButton content={t.periodInfo} />
                  </Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="start_date" className="text-xs text-muted-foreground">
                        {t.startDate}
                      </Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="h-12"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date" className="text-xs text-muted-foreground">
                        {t.endDate}
                      </Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="h-12"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions - Fixed at Bottom */}
          <div className="sticky bottom-0 mt-6 py-4 bg-background border-t border-border">
            <div className="flex items-center gap-4">
              <Button type="submit" disabled={loading} size="lg" className="min-w-[200px]">
                {loading ? (
                  <>
                    <Spinner className="h-5 w-5 mr-2" />
                    {t.creating}
                  </>
                ) : (
                  <>
                    <FolderPlus className="h-5 w-5 mr-2" />
                    {t.create}
                  </>
                )}
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/campaigns">{t.cancel}</Link>
              </Button>
            </div>
          </div>
        </form>

        {/* Add New Artist Modal */}
        <ArtistModal
          open={artistModalOpen}
          onOpenChange={setArtistModalOpen}
          onSuccess={async () => {
            // Refetch artists to get the newly created one
            const result = await refetchArtists();
            if (result.data && result.data.length > 0) {
              // Auto-select the most recently created artist (last in the list after refetch)
              // Since the API returns sorted data, we find the newest by created_at
              const newestArtist = result.data.reduce((newest, current) =>
                new Date(current.created_at) > new Date(newest.created_at) ? current : newest
              );
              setFormData((prev) => ({ ...prev, artist_id: newestArtist.id }));
            }
          }}
        />
      </div>
    </TooltipProvider>
  );
}
