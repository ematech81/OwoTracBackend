import { Router } from "express";
import multer from "multer";
import { transcribeAudio } from "./voice.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post("/transcribe", authenticate, upload.single("audio"), transcribeAudio);

export default router;
