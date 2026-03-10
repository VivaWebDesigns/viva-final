import { Router } from "express";
import { requireAuth } from "../auth/middleware";
import * as notificationService from "./service";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.authUser!.id;
    const { type, is_read, limit, offset } = req.query;

    const result = await notificationService.getUserNotifications(userId, {
      type: type as string | undefined,
      isRead: is_read === "true" ? true : is_read === "false" ? false : undefined,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const count = await notificationService.getUnreadCount(req.authUser!.id);
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const success = await notificationService.markAsRead(req.params.id as string, req.authUser!.id);
    if (!success) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Marked as read" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.put("/read-all", requireAuth, async (req, res) => {
  try {
    const count = await notificationService.markAllAsRead(req.authUser!.id);
    res.json({ message: `Marked ${count} notifications as read`, count });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const success = await notificationService.deleteNotification(req.params.id as string, req.authUser!.id);
    if (!success) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json({ message: "Deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const prefs = await notificationService.getPreferences(req.authUser!.id);
    res.json(prefs);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
