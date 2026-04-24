import { Router } from "express";
import { advisorController } from "./advisor.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/tip", advisorController.tip);
router.get("/greeting", advisorController.greeting);
router.post("/chat", advisorController.chat);
router.post("/chat/stream", advisorController.chatStream);

export default router;
