import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { creditsController } from "./credits.controller";
import { guardCredits } from "../../middleware/planGate";

const router = Router();

router.use(authenticate);

router.get("/stats", creditsController.getStats);
router.get("/", creditsController.list);
router.post("/", guardCredits, creditsController.create);
router.get("/:id", creditsController.getById);
router.post("/:id/payment", creditsController.recordPayment);
router.delete("/:id", creditsController.delete);

export default router;
