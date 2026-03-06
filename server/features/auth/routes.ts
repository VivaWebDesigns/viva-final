import { Router } from "express";
import { requireAuth } from "./middleware";

const router = Router();

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.authUser });
});

export default router;
