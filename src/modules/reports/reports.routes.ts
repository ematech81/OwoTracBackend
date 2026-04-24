import { Router } from "express";
import { reportsController } from "./reports.controller";
import { authenticate } from "../../middleware/auth.middleware";

const router = Router();

router.use(authenticate);

router.get("/daily", reportsController.daily);
router.get("/weekly", reportsController.weekly);
router.get("/monthly", reportsController.monthly);

export default router;
