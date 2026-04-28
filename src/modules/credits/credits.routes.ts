import { Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { creditsController } from "./credits.controller";
import { guardCredits } from "../../middleware/planGate";
import { createCreditSchema, recordPaymentSchema } from "./credits.validation";

const router = Router();

router.use(authenticate);

router.get("/stats", creditsController.getStats);
router.get("/", creditsController.list);
router.post("/", guardCredits, validate(createCreditSchema), creditsController.create);
router.get("/:id", creditsController.getById);
router.post("/:id/payment", validate(recordPaymentSchema), creditsController.recordPayment);
router.patch("/:id/phone", creditsController.updatePhone);
router.delete("/:id", creditsController.delete);

export default router;
