"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useArtists, useDeleteArtist } from "@/lib/queries";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Plus,
  RefreshCw,
  MoreVertical,
  Pencil,
  Trash2,
  Users,
  Music,
  Building,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { ArtistModal } from "@/components/features/artist/ArtistModal";
import type { Artist } from "@/lib/campaigns-api";

export default function ArtistsSettingsPage() {
  const { language } = useI18n();
  const isKorean = language === "ko";
  const toast = useToast();

  const { data: artists = [], isLoading, refetch } = useArtists();
  const deleteArtistMutation = useDeleteArtist();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedArtist, setSelectedArtist] = useState<Artist | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleAddArtist = () => {
    setSelectedArtist(null);
    setModalOpen(true);
  };

  const handleEditArtist = (artist: Artist) => {
    setSelectedArtist(artist);
    setModalOpen(true);
  };

  const handleModalClose = (open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setSelectedArtist(null);
    }
  };

  const handleSuccess = () => {
    refetch();
  };

  const handleDeleteArtist = async (artist: Artist) => {
    setDeletingId(artist.id);
    try {
      await deleteArtistMutation.mutateAsync(artist.id);
      toast.success(
        isKorean ? "삭제 완료" : "Deleted",
        isKorean ? `${artist.name} 아티스트가 삭제되었습니다` : `Artist ${artist.name} has been deleted`
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      const hasCampaigns = errorMessage.includes("existing campaigns");
      toast.error(
        isKorean ? "삭제 실패" : "Delete Failed",
        hasCampaigns
          ? (isKorean ? "캠페인이 있는 아티스트는 삭제할 수 없습니다" : "Cannot delete artist with existing campaigns")
          : (isKorean ? "아티스트 삭제에 실패했습니다" : "Failed to delete artist")
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {isKorean ? "아티스트 관리" : "Artist Management"}
          </h2>
          <p className="text-muted-foreground">
            {isKorean
              ? "아티스트 정보를 추가하고 관리합니다"
              : "Add and manage artist information"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            {isKorean ? "새로고침" : "Refresh"}
          </Button>
          <Button onClick={handleAddArtist}>
            <Plus className="h-4 w-4 mr-2" />
            {isKorean ? "아티스트 추가" : "Add Artist"}
          </Button>
        </div>
      </div>

      {/* Artists List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-neutral-100 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>{isKorean ? "아티스트 목록" : "Artist List"}</CardTitle>
              <CardDescription>
                {isKorean
                  ? `총 ${artists.length}명의 아티스트`
                  : `${artists.length} artist${artists.length !== 1 ? "s" : ""} total`}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Spinner className="h-8 w-8" />
            </div>
          ) : artists.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
              <Music className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">
                {isKorean ? "등록된 아티스트가 없습니다" : "No artists registered"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isKorean
                  ? "첫 번째 아티스트를 추가하세요"
                  : "Add your first artist to get started"}
              </p>
              <Button onClick={handleAddArtist}>
                <Plus className="h-4 w-4 mr-2" />
                {isKorean ? "아티스트 추가" : "Add Artist"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {artists.map((artist) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  onEdit={handleEditArtist}
                  onDelete={handleDeleteArtist}
                  isDeleting={deletingId === artist.id}
                  isKorean={isKorean}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Artist Modal */}
      <ArtistModal
        open={modalOpen}
        onOpenChange={handleModalClose}
        onSuccess={handleSuccess}
        artist={selectedArtist}
      />
    </div>
  );
}

function ArtistCard({
  artist,
  onEdit,
  onDelete,
  isDeleting,
  isKorean,
}: {
  artist: Artist;
  onEdit: (artist: Artist) => void;
  onDelete: (artist: Artist) => void;
  isDeleting: boolean;
  isKorean: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg hover:bg-neutral-50 transition-colors">
      <div className="p-3 rounded-lg bg-neutral-100">
        <Music className="h-6 w-6 text-neutral-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{artist.name}</span>
          {artist.stage_name && (
            <Badge variant="secondary" className="text-xs">
              {artist.stage_name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
          {artist.group_name && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {artist.group_name}
            </span>
          )}
          {artist.label_name && (
            <span className="flex items-center gap-1">
              <Building className="h-3 w-3" />
              {artist.label_name}
            </span>
          )}
        </div>
        {artist.profile_description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {artist.profile_description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isDeleting}>
              {isDeleting ? (
                <Spinner className="h-4 w-4" />
              ) : (
                <MoreVertical className="h-4 w-4" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(artist)}>
              <Pencil className="h-4 w-4 mr-2" />
              {isKorean ? "수정" : "Edit"}
            </DropdownMenuItem>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <DropdownMenuItem
                  onSelect={(e) => e.preventDefault()}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {isKorean ? "삭제" : "Delete"}
                </DropdownMenuItem>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isKorean ? "아티스트를 삭제하시겠습니까?" : "Delete Artist?"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isKorean ? (
                      <>
                        <strong>{artist.name}</strong>을(를) 삭제하시겠습니까?
                        <span className="block mt-2 text-muted-foreground">
                          캠페인이 있는 아티스트는 삭제할 수 없습니다.
                        </span>
                      </>
                    ) : (
                      <>
                        Are you sure you want to delete <strong>{artist.name}</strong>?
                        <span className="block mt-2 text-muted-foreground">
                          Artists with existing campaigns cannot be deleted.
                        </span>
                      </>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{isKorean ? "취소" : "Cancel"}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDelete(artist)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {isKorean ? "삭제" : "Delete"}
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
