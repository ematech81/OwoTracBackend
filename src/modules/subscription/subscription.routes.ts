import { Router } from "express";
import { subscriptionController } from "./subscription.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

// Webhook is unauthenticated — Flutterwave calls it directly with a hash header
router.post("/webhook", subscriptionController.webhook);

// All other routes require a valid user JWT
router.use(authenticate);

router.get("/status", subscriptionController.getStatus);
router.post("/initialize/:planId", subscriptionController.initialize);
router.get("/verify/:txRef", subscriptionController.verify);
router.post("/cancel", subscriptionController.cancel);

export default router;
