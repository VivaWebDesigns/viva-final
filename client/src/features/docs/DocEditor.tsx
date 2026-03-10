import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Save, Plus, X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import RichTextEditorField from "@/features/chat/RichTextEditorField";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocCategory, DocArticle, DocTag } from "@shared/schema";

interface DocEditorProps {
  articleId: string | null;
  categories: DocCategory[];
  onClose: () => void;
  onSaved?: (slug: string) => void;
}

export default function DocEditor({ articleId, categories, onClose, onSaved }: DocEditorProps) {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [content, setContent] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [status, setStatus] = useState("draft");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);
  const { toast } = useToast();

  const { data: existing } = useQuery<DocArticle & { tags?: DocTag[] }>({
    queryKey: ["/api/docs/articles/by-id", articleId],
    queryFn: async () => {
      const res = await fetch(`/api/docs/articles/by-id/${articleId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch article");
      return res.json();
    },
    enabled: !!articleId,
  });

  const { data: allTags = [] } = useQuery<DocTag[]>({
    queryKey: ["/api/docs/tags"],
  });

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setSlug(existing.slug);
      setContent(existing.content);
      setCategoryId(existing.categoryId || "");
      setStatus(existing.status);
      setSelectedTagIds(existing.tags?.map((t) => t.id) || []);
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      let savedArticle: DocArticle;
      if (articleId && existing) {
        const res = await apiRequest("PUT", `/api/docs/articles/${existing.id}`, {
          title, slug, content, categoryId: categoryId || null, status,
        });
        savedArticle = await res.json();
      } else {
        const res = await apiRequest("POST", "/api/docs/articles", {
          title, slug, content, categoryId: categoryId || null, status,
        });
        savedArticle = await res.json();
      }
      await apiRequest("PUT", `/api/docs/articles/${savedArticle.id}/tags`, { tagIds: selectedTagIds });
      return savedArticle;
    },
    onSuccess: (savedArticle) => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] });
      toast({ title: articleId ? "Article updated" : "Article created" });
      if (onSaved) {
        onSaved(savedArticle.slug);
      } else {
        onClose();
      }
    },
    onError: (e: any) => {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    },
  });

  const createTagMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/docs/tags", { name });
      return res.json() as Promise<DocTag>;
    },
    onSuccess: (tag: DocTag) => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/tags"] });
      setSelectedTagIds((prev) => [...prev, tag.id]);
      setNewTagName("");
      setShowTagInput(false);
    },
    onError: (e: any) => {
      toast({ title: "Tag creation failed", description: e.message, variant: "destructive" });
    },
  });

  const generateSlug = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCreateTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    const existing = allTags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedTagIds.includes(existing.id)) setSelectedTagIds((prev) => [...prev, existing.id]);
      setNewTagName("");
      setShowTagInput(false);
      return;
    }
    createTagMutation.mutate(name);
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
              <Select value={categoryId || "__none__"} onValueChange={(v) => setCategoryId(v === "__none__" ? "" : v)}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— No Category —</SelectItem>
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
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" />
              Tags
            </Label>
            <div className="flex flex-wrap gap-2 p-3 border border-gray-200 rounded-lg min-h-[44px] bg-gray-50">
              {allTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      selected
                        ? "bg-teal-600 text-white border-teal-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-teal-300 hover:text-teal-700"
                    }`}
                    data-testid={`tag-toggle-${tag.slug}`}
                  >
                    {tag.name}
                    {selected && <X className="w-2.5 h-2.5" />}
                  </button>
                );
              })}
              {showTagInput ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); handleCreateTag(); }
                      if (e.key === "Escape") { setShowTagInput(false); setNewTagName(""); }
                    }}
                    placeholder="Tag name…"
                    className="h-6 text-xs w-28 py-0 px-2"
                    autoFocus
                    data-testid="input-new-tag"
                  />
                  <button
                    type="button"
                    onClick={handleCreateTag}
                    disabled={createTagMutation.isPending || !newTagName.trim()}
                    className="text-xs text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
                    data-testid="button-confirm-new-tag"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowTagInput(false); setNewTagName(""); }}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 text-gray-400 hover:text-teal-600 transition-colors"
                  data-testid="button-add-tag"
                >
                  <Plus className="w-3 h-3" />
                  Add tag
                </button>
              )}
              {allTags.length === 0 && !showTagInput && (
                <span className="text-xs text-gray-400">No tags yet — create one above.</span>
              )}
            </div>
            {selectedTagIds.length > 0 && (
              <p className="text-xs text-gray-400">{selectedTagIds.length} tag{selectedTagIds.length !== 1 ? "s" : ""} selected</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Content <span className="text-gray-400 font-normal text-xs ml-1">— Markdown supported</span></Label>
            <RichTextEditorField
              value={content}
              onChange={(html) => setContent(html)}
              placeholder="Write your article content here. Use the toolbar for Bold, Italic, links and emojis."
              minHeight="400px"
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
