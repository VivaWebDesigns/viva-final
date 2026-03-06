import { db } from "../../db";
import {
  docCategories, docArticles, docTags, docArticleTags, docRevisions,
  type InsertDocCategory, type InsertDocArticle, type InsertDocTag, type InsertDocRevision,
  type DocCategory, type DocArticle, type DocTag, type DocRevision,
} from "@shared/schema";
import { eq, ilike, or, desc, asc, sql } from "drizzle-orm";

export async function getCategories(): Promise<DocCategory[]> {
  return db.select().from(docCategories).orderBy(asc(docCategories.sortOrder));
}

export async function getCategoryBySlug(slug: string): Promise<DocCategory | undefined> {
  const [result] = await db.select().from(docCategories).where(eq(docCategories.slug, slug));
  return result;
}

export async function createCategory(data: InsertDocCategory): Promise<DocCategory> {
  const [result] = await db.insert(docCategories).values(data).returning();
  return result;
}

export async function updateCategory(id: string, data: Partial<InsertDocCategory>): Promise<DocCategory> {
  const [result] = await db.update(docCategories).set(data).where(eq(docCategories.id, id)).returning();
  return result;
}

export async function getArticles(categoryId?: string, search?: string): Promise<DocArticle[]> {
  let query = db.select().from(docArticles);

  if (categoryId) {
    query = query.where(eq(docArticles.categoryId, categoryId)) as any;
  }

  if (search) {
    query = query.where(
      or(
        ilike(docArticles.title, `%${search}%`),
        ilike(docArticles.content, `%${search}%`)
      )
    ) as any;
  }

  return query.orderBy(desc(docArticles.updatedAt));
}

export async function getArticleBySlug(slug: string): Promise<DocArticle | undefined> {
  const [result] = await db.select().from(docArticles).where(eq(docArticles.slug, slug));
  return result;
}

export async function getArticleById(id: string): Promise<DocArticle | undefined> {
  const [result] = await db.select().from(docArticles).where(eq(docArticles.id, id));
  return result;
}

export async function createArticle(data: InsertDocArticle): Promise<DocArticle> {
  const [result] = await db.insert(docArticles).values(data).returning();
  return result;
}

export async function updateArticle(id: string, data: Partial<InsertDocArticle>): Promise<DocArticle> {
  const [result] = await db.update(docArticles).set({
    ...data,
    updatedAt: new Date(),
  }).where(eq(docArticles.id, id)).returning();
  return result;
}

export async function deleteArticle(id: string): Promise<void> {
  await db.delete(docArticleTags).where(eq(docArticleTags.articleId, id));
  await db.delete(docRevisions).where(eq(docRevisions.articleId, id));
  await db.delete(docArticles).where(eq(docArticles.id, id));
}

export async function getTags(): Promise<DocTag[]> {
  return db.select().from(docTags).orderBy(asc(docTags.name));
}

export async function createTag(data: InsertDocTag): Promise<DocTag> {
  const [result] = await db.insert(docTags).values(data).returning();
  return result;
}

export async function getArticleTags(articleId: string): Promise<DocTag[]> {
  const result = await db
    .select({ id: docTags.id, name: docTags.name, slug: docTags.slug })
    .from(docArticleTags)
    .innerJoin(docTags, eq(docArticleTags.tagId, docTags.id))
    .where(eq(docArticleTags.articleId, articleId));
  return result;
}

export async function setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  await db.delete(docArticleTags).where(eq(docArticleTags.articleId, articleId));
  if (tagIds.length > 0) {
    await db.insert(docArticleTags).values(tagIds.map(tagId => ({ articleId, tagId })));
  }
}

export async function createRevision(data: InsertDocRevision): Promise<DocRevision> {
  const [result] = await db.insert(docRevisions).values(data).returning();
  return result;
}

export async function getRevisions(articleId: string): Promise<DocRevision[]> {
  return db.select().from(docRevisions).where(eq(docRevisions.articleId, articleId)).orderBy(desc(docRevisions.createdAt));
}
