import { Router } from "express";
import { z } from "zod";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as docsStorage from "./storage";
import { insertDocCategorySchema, insertDocArticleSchema } from "@shared/schema";

const updateDocCategorySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
}).strict();

const updateDocArticleSchema = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  content: z.string().optional(),
  categoryId: z.string().nullable().optional(),
  authorId: z.string().nullable().optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
}).strict();

const createDocTagSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
}).strict();

const articleTagsSchema = z.object({
  tagIds: z.array(z.string()).optional().default([]),
});

const router = Router();

router.get("/categories", requireRole("admin", "developer"), async (_req, res) => {
  const categories = await docsStorage.getCategoriesWithCount();
  res.json(categories);
});

router.post("/categories", requireRole("admin", "developer"), async (req, res) => {
  try {
    const data = insertDocCategorySchema.parse(req.body);
    const category = await docsStorage.createCategory(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "doc_category",
      entityId: category.id,
      metadata: { name: category.name },
      ipAddress: req.ip,
    });
    res.status(201).json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/categories/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const validated = updateDocCategorySchema.parse(req.body);
    const category = await docsStorage.updateCategory(req.params.id as string, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "doc_category",
      entityId: category.id,
      metadata: { name: category.name, slug: category.slug },
      ipAddress: req.ip,
    });
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/categories/:id", requireRole("admin"), async (req, res) => {
  try {
    await docsStorage.deleteCategory(req.params.id as string);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "doc_category",
      entityId: req.params.id as string,
      ipAddress: req.ip,
    });
    res.json({ message: "Category deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/articles", requireRole("admin", "developer"), async (req, res) => {
  const { categoryId, search, status } = req.query;
  const articles = await docsStorage.getArticles(
    categoryId as string | undefined,
    search as string | undefined,
    status as string | undefined
  );
  res.json(articles);
});

router.get("/articles/by-id/:id", requireRole("admin", "developer"), async (req, res) => {
  const article = await docsStorage.getArticleById(req.params.id as string);
  if (!article) return res.status(404).json({ message: "Article not found" });

  const tags = await docsStorage.getArticleTags(article.id);
  res.json({ ...article, tags });
});

router.get("/articles/:slug/revisions", requireRole("admin", "developer"), async (req, res) => {
  const article = await docsStorage.getArticleBySlug(req.params.slug as string);
  if (!article) return res.status(404).json({ message: "Article not found" });
  const revisions = await docsStorage.getRevisions(article.id);
  res.json(revisions);
});

router.get("/articles/:slug", requireRole("admin", "developer"), async (req, res) => {
  const article = await docsStorage.getArticleBySlug(req.params.slug as string);
  if (!article) return res.status(404).json({ message: "Article not found" });

  const tags = await docsStorage.getArticleTags(article.id);
  res.json({ ...article, tags });
});

router.post("/articles", requireRole("admin", "developer"), async (req, res) => {
  try {
    const data = insertDocArticleSchema.parse(req.body);
    const article = await docsStorage.createArticle(data);
    await logAudit({
      userId: req.authUser?.id,
      action: "create",
      entity: "doc_article",
      entityId: article.id,
      metadata: { title: article.title },
      ipAddress: req.ip,
    });
    res.status(201).json(article);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/articles/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const existing = await docsStorage.getArticleById(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Article not found" });

    const validated = updateDocArticleSchema.parse(req.body);

    if (validated.content && validated.content !== existing.content) {
      await docsStorage.createRevision({
        articleId: existing.id,
        content: existing.content,
        authorId: req.authUser?.id || null,
      });
    }

    const article = await docsStorage.updateArticle(req.params.id as string, validated);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "doc_article",
      entityId: article.id,
      metadata: { title: article.title },
      ipAddress: req.ip,
    });
    res.json(article);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/articles/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    const existing = await docsStorage.getArticleById(req.params.id as string);
    if (!existing) return res.status(404).json({ message: "Article not found" });
    await docsStorage.deleteArticle(req.params.id as string);
    await logAudit({
      userId: req.authUser?.id,
      action: "delete",
      entity: "doc_article",
      entityId: req.params.id as string,
      metadata: { title: existing.title, slug: existing.slug },
      ipAddress: req.ip,
    });
    res.json({ message: "Article deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/tags", requireRole("admin", "developer"), async (_req, res) => {
  const tags = await docsStorage.getTags();
  res.json(tags);
});

router.post("/tags", requireRole("admin", "developer"), async (req, res) => {
  try {
    const validated = createDocTagSchema.parse(req.body);
    const slug = validated.slug ?? validated.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const tag = await docsStorage.createTag({ name: validated.name, slug });
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/tags/:id", requireRole("admin", "developer"), async (req, res) => {
  try {
    await docsStorage.deleteTag(req.params.id as string);
    res.json({ message: "Tag deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/articles/:id/tags", requireRole("admin", "developer"), async (req, res) => {
  try {
    const { tagIds } = articleTagsSchema.parse(req.body);
    await docsStorage.setArticleTags(req.params.id as string, tagIds);
    res.json({ message: "Tags updated" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
