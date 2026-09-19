import { Router } from "express";
import { advisorController } from "./advisor.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { advisorLimiter } from "../../middleware/rateLimiter";

const router = Router();

router.use(authenticate);
router.use(advisorLimiter);

router.get("/tip", advisorController.tip);
router.get("/greeting", advisorController.greeting);
router.post("/chat", advisorController.chat);
router.post("/chat/stream", advisorController.chatStream);

export default router;
