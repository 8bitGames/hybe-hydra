"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { campaignsApi, artistsApi, Artist } from "@/lib/campaigns-api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, FolderPlus, Calendar, Globe, Users } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const COUNTRIES = [
  { code: "KR", name: { ko: "한국", en: "South Korea" } },
  { code: "US", name: { ko: "미국", en: "United States" } },
  { code: "JP", name: { ko: "일본", en: "Japan" } },
  { code: "CN", name: { ko: "중국", en: "China" } },
  { code: "TH", name: { ko: "태국", en: "Thailand" } },
  { code: "ID", name: { ko: "인도네시아", en: "Indonesia" } },
  { code: "PH", name: { ko: "필리핀", en: "Philippines" } },
  { code: "VN", name: { ko: "베트남", en: "Vietnam" } },
  { code: "BR", name: { ko: "브라질", en: "Brazil" } },
  { code: "MX", name: { ko: "멕시코", en: "Mexico" } },
  { code: "GB", name: { ko: "영국", en: "United Kingdom" } },
  { code: "DE", name: { ko: "독일", en: "Germany" } },
  { code: "FR", name: { ko: "프랑스", en: "France" } },
];

export default function NewCampaignPage() {
  const router = useRouter();
  const { language } = useI18n();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    artist_id: "",
    description: "",
    target_countries: [] as string[],
    start_date: "",
    end_date: "",
  });

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
    descriptionPlaceholder: language === "ko" ? "캠페인에 대한 간단한 설명..." : "Brief description of the campaign...",
    targetCountries: language === "ko" ? "타겟 국가" : "Target Countries",
    startDate: language === "ko" ? "시작일" : "Start Date",
    endDate: language === "ko" ? "종료일" : "End Date",
    create: language === "ko" ? "캠페인 생성" : "Create Campaign",
    creating: language === "ko" ? "생성 중..." : "Creating...",
    cancel: language === "ko" ? "취소" : "Cancel",
    solo: language === "ko" ? "솔로" : "Solo",
  };

  useEffect(() => {
    const loadArtists = async () => {
      const result = await artistsApi.getAll();
      if (result.data) {
        setArtists(result.data);
      }
    };
    loadArtists();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!formData.name.trim()) {
      setError(t.campaignNameError);
      setLoading(false);
      return;
    }

    if (!formData.artist_id) {
      setError(t.artistError);
      setLoading(false);
      return;
    }

    const result = await campaignsApi.create({
      name: formData.name.trim(),
      artist_id: formData.artist_id,
      description: formData.description.trim() || undefined,
      target_countries: formData.target_countries.length > 0 ? formData.target_countries : undefined,
      start_date: formData.start_date || undefined,
      end_date: formData.end_date || undefined,
    });

    if (result.error) {
      setError(result.error.message);
      setLoading(false);
      return;
    }

    if (result.data) {
      router.push(`/campaigns/${result.data.id}`);
    }
  };

  const toggleCountry = (code: string) => {
    setFormData((prev) => ({
      ...prev,
      target_countries: prev.target_countries.includes(code)
        ? prev.target_countries.filter((c) => c !== code)
        : [...prev.target_countries, code],
    }));
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
    <div className="min-h-[calc(100vh-4rem)] flex flex-col">
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
                </Label>
                <Select
                  value={formData.artist_id}
                  onValueChange={(value) => setFormData({ ...formData, artist_id: value })}
                >
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder={t.selectArtist} />
                  </SelectTrigger>
                  <SelectContent>
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
                <Label htmlFor="description">{t.description}</Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t.descriptionPlaceholder}
                  rows={4}
                  className="w-full px-3 py-3 bg-background border border-input rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Right Column - Optional Fields */}
          <Card>
            <CardContent className="pt-6 space-y-6">
              {/* Target Countries */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="w-4 h-4" />
                  {t.targetCountries}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {COUNTRIES.map((country) => {
                    const isSelected = formData.target_countries.includes(country.code);
                    return (
                      <Badge
                        key={country.code}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer transition-colors"
                        onClick={() => toggleCountry(country.code)}
                      >
                        {language === "ko" ? country.name.ko : country.name.en}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Date Range */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {language === "ko" ? "캠페인 기간" : "Campaign Period"}
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
    </div>
  );
}
