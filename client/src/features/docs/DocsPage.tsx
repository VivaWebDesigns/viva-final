import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Search, Plus, Edit, Trash2, ChevronRight, Clock, FileText,
  Tag, History, FolderPlus, X, ChevronDown, ChevronUp, Archive, Eye, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { queryClient, apiRequest, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { DocCategory, DocArticle, DocTag, DocRevision } from "@shared/schema";
import { useAdminLang } from "@/i18n/LanguageContext";
import DocEditor from "./DocEditor";

type CategoryWithCount = DocCategory & { articleCount: number };
type ArticleWithTags = DocArticle & { tags?: DocTag[] };

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  published: { label: "Published", color: "bg-green-100 text-green-700" },
  draft:     { label: "Draft",     color: "bg-yellow-100 text-yellow-700" },
  archived:  { label: "Archived",  color: "bg-gray-100 text-gray-500" },
};

const STATUS_FILTERS = ["all", "published", "draft", "archived"] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

function timeAgo(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function renderContent(content: string): string {
  return content
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-gray-900 mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-gray-900 mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-gray-900 mt-6 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal">$2</li>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br />');
}

interface NewCategoryModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function NewCategoryModal({ onClose, onCreated }: NewCategoryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/docs/categories", {
      name,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: description || null,
      sortOrder: 0,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] });
      toast({ title: "Category created" });
      onCreated();
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">New Category</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              data-testid="input-category-name"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description <span className="text-gray-400">(optional)</span></label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description"
              data-testid="input-category-description"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-category">Cancel</Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim()}
            className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
            data-testid="button-create-category"
          >
            {createMutation.isPending ? "Creating..." : "Create Category"}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface RevisionPanelProps {
  articleSlug: string;
  onRestore: (content: string) => void;
}

function RevisionPanel({ articleSlug, onRestore }: RevisionPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: revisions = [], isLoading } = useQuery<DocRevision[]>({
    queryKey: ["/api/docs/articles", articleSlug, "revisions"],
    queryFn: async () => {
      const res = await fetch(`/api/docs/articles/${articleSlug}/revisions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load revisions");
      return res.json();
    },
    staleTime: STALE.MEDIUM,
    enabled: !!articleSlug,
  });

  if (isLoading) return <p className="text-xs text-gray-400 py-2">Loading history…</p>;
  if (revisions.length === 0) return <p className="text-xs text-gray-400 py-2">No revision history yet.</p>;

  return (
    <div className="space-y-2">
      {revisions.map((rev, i) => (
        <div key={rev.id} className="border border-gray-100 rounded-lg overflow-hidden" data-testid={`revision-item-${rev.id}`}>
          <button
            className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-gray-50 transition-colors"
            onClick={() => setExpandedId(expandedId === rev.id ? null : rev.id)}
          >
            <div className="flex items-center gap-2">
              <History className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-700">Revision {revisions.length - i}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{timeAgo(rev.createdAt as unknown as string)}</span>
              {expandedId === rev.id ? <ChevronUp className="w-3 h-3 text-gray-400" /> : <ChevronDown className="w-3 h-3 text-gray-400" />}
            </div>
          </button>
          {expandedId === rev.id && (
            <div className="px-3 pb-3">
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-2 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                {rev.content.slice(0, 500)}{rev.content.length > 500 ? "…" : ""}
              </pre>
              <Button
                size="sm"
                variant="outline"
                className="mt-2 text-xs h-7"
                onClick={() => onRestore(rev.content)}
                data-testid={`button-restore-revision-${rev.id}`}
              >
                Restore this version
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function DocsPage() {
  const { t } = useAdminLang();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticleSlug, setSelectedArticleSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const { toast } = useToast();

  const { data: categories = [] } = useQuery<CategoryWithCount[]>({
    queryKey: ["/api/docs/categories"],
    staleTime: STALE.SLOW,
  });

  const { data: articles = [] } = useQuery<DocArticle[]>({
    queryKey: ["/api/docs/articles", selectedCategory, search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (search) params.set("search", search);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/docs/articles?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  const { data: articleDetail } = useQuery<ArticleWithTags>({
    queryKey: ["/api/docs/articles", selectedArticleSlug],
    queryFn: async () => {
      const res = await fetch(`/api/docs/articles/${selectedArticleSlug}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch article");
      return res.json();
    },
    enabled: !!selectedArticleSlug,
    staleTime: STALE.MEDIUM,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/docs/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
      queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] });
      setSelectedArticleSlug(null);
      setShowRevisions(false);
      toast({ title: "Article deleted" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/docs/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
      if (selectedCategory) setSelectedCategory(null);
      toast({ title: "Category deleted", description: "Articles were moved to Uncategorized." });
    },
  });

  const getCategoryName = (catId: string | null) =>
    categories.find((c) => c.id === catId)?.name || "Uncategorized";

  if (editing || creating) {
    return (
      <DocEditor
        articleId={editing}
        categories={categories}
        onClose={() => { setEditing(null); setCreating(false); }}
        onSaved={(slug) => {
          setEditing(null);
          setCreating(false);
          if (slug) setSelectedArticleSlug(slug);
          queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
          queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] });
        }}
      />
    );
  }

  const selectedCat = categories.find((c) => c.id === selectedCategory);

  return (
    <div>
      {showNewCategory && (
        <NewCategoryModal
          onClose={() => setShowNewCategory(false)}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/docs/categories"] })}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-docs-title">App Docs</h1>
          <p className="text-gray-500 text-sm mt-1">Internal documentation library</p>
        </div>
        <Button
          onClick={() => setCreating(true)}
          className="bg-[#0D9488] hover:bg-[#0F766E] text-white"
          data-testid="button-create-doc"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Article
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Categories</h3>
              <button
                onClick={() => setShowNewCategory(true)}
                className="text-gray-400 hover:text-[#0D9488] transition-colors"
                title="New category"
                data-testid="button-new-category"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-0.5">
              <button
                onClick={() => { setSelectedCategory(null); setSelectedArticleSlug(null); setShowRevisions(false); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                  !selectedCategory ? "bg-[#0D9488]/10 text-[#0D9488] font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
                data-testid="button-category-all"
              >
                <span>All Articles</span>
                <span className={`text-xs ${!selectedCategory ? "text-[#0D9488]" : "text-gray-400"}`}>{articles.length}</span>
              </button>
              {categories.map((cat) => (
                <div key={cat.id} className="group relative">
                  <button
                    onClick={() => { setSelectedCategory(cat.id); setSelectedArticleSlug(null); setShowRevisions(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between ${
                      selectedCategory === cat.id ? "bg-[#0D9488]/10 text-[#0D9488] font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                    data-testid={`button-category-${cat.slug}`}
                  >
                    <span className="truncate">{cat.name}</span>
                    <span className={`text-xs flex-shrink-0 ${selectedCategory === cat.id ? "text-[#0D9488]" : "text-gray-400"}`}>
                      {cat.articleCount}
                    </span>
                  </button>
                  {selectedCategory === cat.id && (
                    <button
                      className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center justify-center w-5 h-5 text-gray-300 hover:text-red-500 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete category "${cat.name}"? Articles will be moved to Uncategorized.`)) {
                          deleteCategoryMutation.mutate(cat.id);
                        }
                      }}
                      title="Delete category"
                      data-testid={`button-delete-category-${cat.id}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-xs text-gray-400 px-3 py-2">No categories yet.</p>
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</h3>
              <div className="space-y-0.5">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setStatusFilter(s); setSelectedArticleSlug(null); setShowRevisions(false); }}
                    className={`w-full text-left px-3 py-1.5 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                      statusFilter === s ? "bg-[#0D9488]/10 text-[#0D9488] font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                    data-testid={`button-status-filter-${s}`}
                  >
                    {s === "all" && <BookOpen className="w-3.5 h-3.5" />}
                    {s === "published" && <Eye className="w-3.5 h-3.5" />}
                    {s === "draft" && <FileText className="w-3.5 h-3.5" />}
                    {s === "archived" && <Archive className="w-3.5 h-3.5" />}
                    <span className="capitalize">{s === "all" ? "All" : s}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`${selectedArticleSlug ? "lg:col-span-4" : "lg:col-span-9"}`}>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search articles…"
                  className="pl-10"
                  data-testid="input-search-docs"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {articles.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No articles found</p>
                  {(search || selectedCategory || statusFilter !== "all") && (
                    <button
                      className="text-xs text-[#0D9488] mt-2 hover:underline"
                      onClick={() => { setSearch(""); setSelectedCategory(null); setStatusFilter("all"); }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                articles.map((article) => {
                  const sc = STATUS_CONFIG[article.status] || STATUS_CONFIG.draft;
                  const isArchived = article.status === "archived";
                  return (
                    <button
                      key={article.id}
                      onClick={() => { setSelectedArticleSlug(article.slug); setShowRevisions(false); }}
                      className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                        selectedArticleSlug === article.slug ? "bg-[#0D9488]/5" : ""
                      } ${isArchived ? "opacity-60" : ""}`}
                      data-testid={`button-article-${article.slug}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`font-medium text-sm truncate ${isArchived ? "text-gray-500 line-through" : "text-gray-900"}`}>
                          {article.title}
                        </h4>
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className="text-xs text-gray-400">{getCategoryName(article.categoryId)}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {timeAgo(article.updatedAt as unknown as string)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sc.color}`}>
                          {sc.label}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedArticleSlug && articleDetail && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-5"
            >
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight" data-testid="text-article-title">
                    {articleDetail.title}
                  </h2>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowRevisions(!showRevisions)}
                      title="Revision history"
                      data-testid="button-show-revisions"
                    >
                      <History className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditing(articleDetail.id)}
                      data-testid="button-edit-article"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-600"
                      onClick={() => {
                        if (confirm("Delete this article?")) {
                          deleteMutation.mutate(articleDetail.id);
                        }
                      }}
                      data-testid="button-delete-article"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs text-gray-400">{getCategoryName(articleDetail.categoryId)}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-400">Updated {timeAgo(articleDetail.updatedAt as unknown as string)}</span>
                  {articleDetail.status && (
                    <>
                      <span className="text-xs text-gray-300">·</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_CONFIG[articleDetail.status]?.color || STATUS_CONFIG.draft.color}`}>
                        {STATUS_CONFIG[articleDetail.status]?.label || articleDetail.status}
                      </span>
                    </>
                  )}
                </div>

                {articleDetail.tags && articleDetail.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {articleDetail.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded-full px-2 py-0.5"
                        data-testid={`tag-${tag.slug}`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {tag.name}
                      </span>
                    ))}
                  </div>
                )}

                {showRevisions && (
                  <div className="mb-5 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5" />
                      Revision History
                    </h3>
                    <RevisionPanel
                      articleSlug={selectedArticleSlug}
                      onRestore={(content) => {
                        setEditing(articleDetail.id);
                        setShowRevisions(false);
                      }}
                    />
                  </div>
                )}

                <div
                  className="prose prose-sm max-w-none text-gray-700 text-sm leading-relaxed"
                  data-testid="text-article-content"
                  dangerouslySetInnerHTML={{ __html: `<p class="mb-2">${renderContent(articleDetail.content)}</p>` }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
