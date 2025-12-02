"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignsApi, artistsApi, Campaign, Artist } from "@/lib/campaigns-api";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  FolderOpen,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  BarChart3,
} from "lucide-react";

export default function CampaignsPage() {
  const { language } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [artistFilter, setArtistFilter] = useState<string>("");

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [campaignsResult, artistsResult] = await Promise.all([
          campaignsApi.getAll({
            page,
            page_size: 10,
            status: statusFilter || undefined,
            artist_id: artistFilter || undefined,
          }),
          artistsApi.getAll(),
        ]);

        if (campaignsResult.data) {
          setCampaigns(campaignsResult.data.items);
          setTotalPages(campaignsResult.data.pages);
        }
        if (artistsResult.data) {
          setArtists(artistsResult.data);
        }
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [page, statusFilter, artistFilter]);

  const statusVariants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    draft: "secondary",
    active: "default",
    completed: "outline",
    archived: "outline",
  };

  const handleDelete = async (id: string, name: string) => {
    const confirmMessage = language === "ko"
      ? `정말로 "${name}"을(를) 삭제하시겠습니까?`
      : `Are you sure you want to delete "${name}"?`;
    if (!confirm(confirmMessage)) return;

    const result = await campaignsApi.delete(id);
    if (!result.error) {
      setCampaigns(campaigns.filter((c) => c.id !== id));
    }
  };

  const clearFilters = () => {
    setStatusFilter("");
    setArtistFilter("");
    setPage(1);
  };

  const hasFilters = statusFilter || artistFilter;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {language === "ko" ? "캠페인" : "Campaigns"}
          </h1>
        </div>
        <Link href="/campaigns/new">
          <Button size="lg" className="text-base font-semibold">
            <Plus className="h-5 w-5 mr-2" />
            {language === "ko" ? "새 캠페인" : "New Campaign"}
          </Button>
        </Link>
      </div>

      {/* Filters - Inline */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px] h-10 text-base">
            <SelectValue placeholder={language === "ko" ? "모든 상태" : "All Statuses"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">{language === "ko" ? "모든 상태" : "All Statuses"}</SelectItem>
            <SelectItem value="draft" className="text-base">{language === "ko" ? "초안" : "Draft"}</SelectItem>
            <SelectItem value="active" className="text-base">{language === "ko" ? "활성" : "Active"}</SelectItem>
            <SelectItem value="completed" className="text-base">{language === "ko" ? "완료" : "Completed"}</SelectItem>
            <SelectItem value="archived" className="text-base">{language === "ko" ? "보관됨" : "Archived"}</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={artistFilter}
          onValueChange={(value) => {
            setArtistFilter(value === "all" ? "" : value);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px] h-10 text-base">
            <SelectValue placeholder={language === "ko" ? "모든 아티스트" : "All Artists"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-base">{language === "ko" ? "모든 아티스트" : "All Artists"}</SelectItem>
            {artists.map((artist) => (
              <SelectItem key={artist.id} value={artist.id} className="text-base">
                {artist.stage_name || artist.name}
                {artist.group_name ? ` (${artist.group_name})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" onClick={clearFilters} className="text-base">
            <X className="h-5 w-5 mr-1" />
            {language === "ko" ? "초기화" : "Clear"}
          </Button>
        )}
      </div>

      {/* Campaign List */}
      <div className="border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner className="h-8 w-8" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {language === "ko" ? "캠페인을 찾을 수 없습니다" : "No campaigns found"}
            </h3>
            <p className="text-base text-muted-foreground mb-6">
              {hasFilters
                ? (language === "ko" ? "필터를 조정해보세요" : "Try adjusting your filters")
                : (language === "ko" ? "첫 번째 캠페인을 만들어보세요" : "Create your first campaign to get started")}
            </p>
            {!hasFilters && (
              <Link href="/campaigns/new">
                <Button size="lg" className="text-base font-semibold">
                  {language === "ko" ? "캠페인 만들기" : "Create Campaign"}
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[40%] text-base font-semibold py-3">
                    {language === "ko" ? "캠페인" : "Campaign"}
                  </TableHead>
                  <TableHead className="text-base font-semibold py-3">
                    {language === "ko" ? "아티스트" : "Artist"}
                  </TableHead>
                  <TableHead className="text-base font-semibold py-3">
                    {language === "ko" ? "상태" : "Status"}
                  </TableHead>
                  <TableHead className="text-center text-base font-semibold py-3">
                    {language === "ko" ? "에셋" : "Assets"}
                  </TableHead>
                  <TableHead className="text-right text-base font-semibold py-3">
                    {language === "ko" ? "작업" : "Actions"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id} className="hover:bg-muted/30">
                    <TableCell className="py-4">
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="block hover:underline"
                      >
                        <div className="text-base font-semibold">{campaign.name}</div>
                        {campaign.description && (
                          <div className="text-sm text-muted-foreground truncate max-w-[300px]">
                            {campaign.description}
                          </div>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell className="text-base text-muted-foreground py-4">
                      {campaign.artist_stage_name || campaign.artist_name || "-"}
                    </TableCell>
                    <TableCell className="py-4">
                      <Badge variant={statusVariants[campaign.status]} className="text-sm">
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center text-base text-muted-foreground py-4">
                      {campaign.asset_count ?? 0}
                    </TableCell>
                    <TableCell className="text-right py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/campaigns/${campaign.id}/analytics`}>
                          <Button variant="ghost" size="icon" title="Analytics">
                            <BarChart3 className="h-5 w-5" />
                          </Button>
                        </Link>
                        <Link href={`/campaigns/${campaign.id}`}>
                          <Button variant="ghost" size="icon">
                            <Eye className="h-5 w-5" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(campaign.id, campaign.name)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-5 w-5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="text-base"
                >
                  <ChevronLeft className="h-5 w-5 mr-1" />
                  {language === "ko" ? "이전" : "Previous"}
                </Button>
                <span className="text-base text-muted-foreground">
                  {language === "ko"
                    ? `${page} / ${totalPages} 페이지`
                    : `Page ${page} of ${totalPages}`}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="text-base"
                >
                  {language === "ko" ? "다음" : "Next"}
                  <ChevronRight className="h-5 w-5 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
