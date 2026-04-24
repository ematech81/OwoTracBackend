import { Router } from "express";
import { stockController } from "./stock.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { createStockSchema, updateStockSchema, adjustQtySchema } from "./stock.validation";
import { guardStock } from "../../middleware/planGate";

const router = Router();

router.use(authenticate);

router.get("/stats", stockController.getStats);
router.post("/", guardStock, validate(createStockSchema), stockController.create);
router.get("/", stockController.list);
router.get("/:id", stockController.getById);
router.patch("/:id/adjust", validate(adjustQtySchema), stockController.adjustQty);
router.patch("/:id", validate(updateStockSchema), stockController.update);
router.delete("/:id", stockController.delete);

export default router;
