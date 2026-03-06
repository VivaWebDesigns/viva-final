import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Search, Plus, Edit, Trash2, ChevronRight, Clock, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DocCategory, DocArticle } from "@shared/schema";
import DocEditor from "./DocEditor";

export default function DocsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: categories = [] } = useQuery<DocCategory[]>({
    queryKey: ["/api/docs/categories"],
  });

  const { data: articles = [] } = useQuery<DocArticle[]>({
    queryKey: ["/api/docs/articles", selectedCategory, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("categoryId", selectedCategory);
      if (search) params.set("search", search);
      const res = await fetch(`/api/docs/articles?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
  });

  const { data: articleDetail } = useQuery<DocArticle & { tags: any[] }>({
    queryKey: ["/api/docs/articles", selectedArticle],
    queryFn: async () => {
      const res = await fetch(`/api/docs/articles/${selectedArticle}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch article");
      return res.json();
    },
    enabled: !!selectedArticle,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/docs/articles/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/docs/articles"] });
      setSelectedArticle(null);
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
      />
    );
  }

  return (
    <div>
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
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Categories</h3>
            <div className="space-y-0.5">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !selectedCategory ? "bg-[#0D9488]/10 text-[#0D9488] font-medium" : "text-gray-600 hover:bg-gray-50"
                }`}
                data-testid="button-category-all"
              >
                All Articles ({articles.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    selectedCategory === cat.id ? "bg-[#0D9488]/10 text-[#0D9488] font-medium" : "text-gray-600 hover:bg-gray-50"
                  }`}
                  data-testid={`button-category-${cat.slug}`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${selectedArticle ? "lg:col-span-4" : "lg:col-span-9"}`}>
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search articles..."
                  className="pl-10"
                  data-testid="input-search-docs"
                />
              </div>
            </div>
            <div className="divide-y divide-gray-100">
              {articles.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No articles found</p>
                </div>
              ) : (
                articles.map((article) => (
                  <button
                    key={article.id}
                    onClick={() => setSelectedArticle(article.slug)}
                    className={`w-full text-left p-4 hover:bg-gray-50 transition-colors ${
                      selectedArticle === article.slug ? "bg-[#0D9488]/5" : ""
                    }`}
                    data-testid={`button-article-${article.slug}`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-gray-900 text-sm">{article.title}</h4>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        {getCategoryName(article.categoryId)}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(article.updatedAt).toLocaleDateString()}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        article.status === "published" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}>
                        {article.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {selectedArticle && articleDetail && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="lg:col-span-5"
            >
              <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-4">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900" data-testid="text-article-title">
                    {articleDetail.title}
                  </h2>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing(articleDetail.id)}
                      data-testid="button-edit-article"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500 hover:text-red-700"
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

                <div className="flex gap-2 mb-4 text-xs text-gray-500">
                  <span>{getCategoryName(articleDetail.categoryId)}</span>
                  <span>·</span>
                  <span>Updated {new Date(articleDetail.updatedAt).toLocaleDateString()}</span>
                </div>

                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap" data-testid="text-article-content">
                  {articleDetail.content}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
