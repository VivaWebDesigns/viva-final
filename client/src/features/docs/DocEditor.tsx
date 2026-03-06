import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DocCategory, DocArticle } from "@shared/schema";

interface DocEditorProps {
  articleId: string | null;
  categories: DocCategory[];
  onClose: () => void;
}

export default function DocEditor({ articleId, categories, onClose }: DocEditorProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState("draft");

  const { data: existing } = useQuery<DocArticle>({
    queryKey: ["/api/docs/articles/by-id", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/docs/articles/by-id/${articleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch article");
      return res.json();
    },
    enabled: !!articleId,
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setContent(existing.content);
      setCategoryId(existing.categoryId || "");
      setStatus(existing.status);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (articleId && existing) {
        await apiRequest("PUT", `/api/docs/articles/${existing.id}`, {
          title, slug, content, categoryId: categoryId || null, status,
        });
      } else {
        await apiRequest("POST", "/api/docs/articles", {
          title, slug, content, categoryId: categoryId || null, status,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
      onClose();
    },
  });

  const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onClose} data-testid="button-back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">
          {articleId ? "Edit Article" : "New Article"}
        </h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-4xl">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!articleId) setSlug(generateSlug(e.target.value));
                }}
                placeholder="Article title"
                data-testid="input-article-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="article-slug"
                data-testid="input-article-slug"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Content</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your article content here (Markdown supported)..."
              className="min-h-[400px] font-mono text-sm"
              data-testid="textarea-article-content"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !title || !slug}
              className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
              data-testid="button-save-article"
            >
              {saveMutation.isPending ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {articleId ? "Save Changes" : "Create Article"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
