import { Router } from "express";
import { subscriptionController } from "./subscription.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/status", subscriptionController.getStatus);
router.post("/initialize/:planId", subscriptionController.initialize);
router.get("/verify/:reference", subscriptionController.verify);
router.post("/cancel", subscriptionController.cancel);

export default router;
