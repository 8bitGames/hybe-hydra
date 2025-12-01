"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  composeApi,
  ComposedVideo,
} from "@/lib/compose-api";
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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Wand2,
  Search,
  FolderOpen,
  Play,
  Download,
  Clock,
  User,
  Music,
  Film,
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
} from "lucide-react";

export default function ComposeGalleryPage() {
  const router = useRouter();
  const [videos, setVideos] = useState<ComposedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Video preview modal
  const [selectedVideo, setSelectedVideo] = useState<ComposedVideo | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const loadVideos = useCallback(async () => {
    setLoading(true);
    try {
      const result = await composeApi.getComposedVideos({
        page,
        page_size: 12,
      });

      setVideos(result.items);
      setTotalPages(result.pages);
      setTotal(result.total);
    } catch (error) {
      console.error("Failed to load composed videos:", error);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const filteredVideos = videos.filter(
    (video) =>
      video.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleVideoClick = (video: ComposedVideo) => {
    setSelectedVideo(video);
    setIsPreviewOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getAspectRatioLabel = (ratio: string) => {
    switch (ratio) {
      case "9:16":
        return "TikTok/Reels";
      case "16:9":
        return "YouTube";
      case "1:1":
        return "Instagram";
      default:
        return ratio;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500">
              <Film className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Composed Videos</h1>
              <p className="text-muted-foreground">
                View and download your slideshow videos created with Compose
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/compose">
              <Wand2 className="h-4 w-4 mr-2" />
              Create New
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                  <Film className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{total}</p>
                  <p className="text-xs text-muted-foreground">Total Videos</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Play className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {videos.filter((v) => v.composed_output_url).length}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready to Play</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {videos.reduce((sum, v) => sum + v.duration_seconds, 0)}s
                  </p>
                  <p className="text-xs text-muted-foreground">Total Duration</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by campaign, artist, or prompt..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Video Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filteredVideos.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mx-auto mb-4">
                <FolderOpen className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium mb-2">No videos found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {searchQuery
                  ? "Try a different search term"
                  : "Create your first slideshow video with Compose"}
              </p>
              <Button asChild>
                <Link href="/compose">
                  <Wand2 className="h-4 w-4 mr-2" />
                  Create Video
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredVideos.map((video) => (
              <Card
                key={video.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                onClick={() => handleVideoClick(video)}
              >
                {/* Video Preview Thumbnail */}
                <div className="relative aspect-video bg-muted">
                  {video.composed_output_url ? (
                    <video
                      src={video.composed_output_url}
                      className="w-full h-full object-cover"
                      muted
                      preload="metadata"
                      onMouseOver={(e) => (e.currentTarget as HTMLVideoElement).play()}
                      onMouseOut={(e) => {
                        const videoEl = e.currentTarget as HTMLVideoElement;
                        videoEl.pause();
                        videoEl.currentTime = 0;
                      }}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <Film className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                      <Play className="h-6 w-6 text-gray-900 ml-1" />
                    </div>
                  </div>
                  {/* Duration badge */}
                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 right-2 bg-black/70 text-white"
                  >
                    {video.duration_seconds}s
                  </Badge>
                </div>

                <CardContent className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {video.campaign_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {video.artist_name}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {getAspectRatioLabel(video.aspect_ratio)}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {video.prompt}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {video.creator.name}
                      </span>
                      <span>•</span>
                      <span>{formatDate(video.created_at)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Video Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="h-5 w-5" />
              {selectedVideo?.campaign_name}
            </DialogTitle>
          </DialogHeader>

          {selectedVideo && (
            <div className="space-y-4">
              {/* Video Player */}
              <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                {selectedVideo.composed_output_url ? (
                  <video
                    src={selectedVideo.composed_output_url}
                    className="w-full h-full object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white">
                    <p>Video not available</p>
                  </div>
                )}
              </div>

              {/* Video Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Artist</p>
                    <p className="font-medium">{selectedVideo.artist_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="font-medium">{selectedVideo.duration_seconds} seconds</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aspect Ratio</p>
                    <p className="font-medium">
                      {selectedVideo.aspect_ratio} ({getAspectRatioLabel(selectedVideo.aspect_ratio)})
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Created By</p>
                    <p className="font-medium">{selectedVideo.creator.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created At</p>
                    <p className="font-medium">{formatDate(selectedVideo.created_at)}</p>
                  </div>
                  {selectedVideo.audio_asset && (
                    <div>
                      <p className="text-xs text-muted-foreground">Music</p>
                      <p className="font-medium flex items-center gap-1">
                        <Music className="h-3 w-3" />
                        {selectedVideo.audio_asset.original_filename}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Prompt */}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Prompt</p>
                <p className="text-sm p-3 bg-muted rounded-lg">{selectedVideo.prompt}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-2">
                {selectedVideo.composed_output_url && (
                  <>
                    <Button asChild>
                      <a
                        href={selectedVideo.composed_output_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Open in New Tab
                      </a>
                    </Button>
                    <Button variant="outline" asChild>
                      <a href={selectedVideo.composed_output_url} download>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </a>
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  asChild
                  className="ml-auto"
                >
                  <Link href={`/campaigns/${selectedVideo.campaign_id}/compose`}>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Create Similar
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
