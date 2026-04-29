import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { notificationsController } from "./notifications.controller";

const router = Router();

router.use(authenticate);

router.get("/", notificationsController.list);
router.get("/unread-count", notificationsController.unreadCount);
router.patch("/:id/read", notificationsController.markRead);
router.patch("/read-all", notificationsController.markAllRead);

export default router;
