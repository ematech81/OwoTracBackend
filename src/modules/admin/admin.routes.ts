import { Router } from "express";
import { adminController } from "./admin.controller";
import { adminAuth } from "../../middleware/adminAuth";

const router = Router();

router.post("/login", adminController.login);

router.use(adminAuth);

router.get("/stats", adminController.getStats);
router.get("/users", adminController.listUsers);
router.get("/users/:id", adminController.getUser);
router.patch("/users/:id/subscription", adminController.updateSubscription);
router.patch("/users/:id/status", adminController.toggleUserStatus);
router.get("/subscriptions", adminController.listSubscriptions);
router.get("/logs", adminController.getLogs);
router.get("/transactions", adminController.listTransactions);

router.post("/broadcasts", adminController.createBroadcast);
router.get("/broadcasts", adminController.listBroadcasts);
router.delete("/broadcasts/:id", adminController.deleteBroadcast);

router.get("/notifications", adminController.listNotifications);
router.patch("/notifications/:id/read", adminController.markNotificationRead);
router.patch("/notifications/read-all", adminController.markAllNotificationsRead);

export default router;
