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
router.get("/transactions", adminController.listTransactions);

export default router;
