import { Router } from "express";
import { requireRole } from "../auth/middleware";
import { logAudit } from "../audit/service";
import * as docsStorage from "./storage";
import { insertDocCategorySchema, insertDocArticleSchema } from "@shared/schema";

const router = Router();

router.get("/categories", requireRole("admin", "developer"), async (_req, res) => {
  const categories = await docsStorage.getCategories();
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
    const category = await docsStorage.updateCategory(req.params.id, req.body);
    await logAudit({
      userId: req.authUser?.id,
      action: "update",
      entity: "doc_category",
      entityId: category.id,
      ipAddress: req.ip,
    });
    res.json(category);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/articles", requireRole("admin", "developer"), async (req, res) => {
  const { categoryId, search } = req.query;
  const articles = await docsStorage.getArticles(
    categoryId as string | undefined,
    search as string | undefined
  );
  res.json(articles);
});

router.get("/articles/by-id/:id", requireRole("admin", "developer"), async (req, res) => {
  const article = await docsStorage.getArticleById(req.params.id);
  if (!article) return res.status(404).json({ message: "Article not found" });

  const tags = await docsStorage.getArticleTags(article.id);
  res.json({ ...article, tags });
});

router.get("/articles/:slug", requireRole("admin", "developer"), async (req, res) => {
  const article = await docsStorage.getArticleBySlug(req.params.slug);
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
    const existing = await docsStorage.getArticleById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Article not found" });

    if (req.body.content && req.body.content !== existing.content) {
      await docsStorage.createRevision({
        articleId: existing.id,
        content: existing.content,
        authorId: req.authUser?.id || null,
      });
    }

    const article = await docsStorage.updateArticle(req.params.id, req.body);
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
  await docsStorage.deleteArticle(req.params.id);
  await logAudit({
    userId: req.authUser?.id,
    action: "delete",
    entity: "doc_article",
    entityId: req.params.id,
    ipAddress: req.ip,
  });
  res.json({ message: "Article deleted" });
});

router.get("/articles/:id/revisions", requireRole("admin", "developer"), async (req, res) => {
  const revisions = await docsStorage.getRevisions(req.params.id);
  res.json(revisions);
});

router.get("/tags", requireRole("admin", "developer"), async (_req, res) => {
  const tags = await docsStorage.getTags();
  res.json(tags);
});

router.post("/tags", requireRole("admin", "developer"), async (req, res) => {
  try {
    const tag = await docsStorage.createTag(req.body);
    res.status(201).json(tag);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.put("/articles/:id/tags", requireRole("admin", "developer"), async (req, res) => {
  await docsStorage.setArticleTags(req.params.id, req.body.tagIds || []);
  res.json({ message: "Tags updated" });
});

export default router;
