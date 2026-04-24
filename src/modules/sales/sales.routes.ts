import { Router } from "express";
import { salesController } from "./sales.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { createSaleSchema, updateSaleSchema, parseTextSchema } from "./sales.validation";
import { guardSales } from "../../middleware/planGate";

const router = Router();

router.use(authenticate);

router.post("/parse-text", validate(parseTextSchema), salesController.parseText);
router.post("/", guardSales, validate(createSaleSchema), salesController.create);
router.get("/", salesController.list);
router.get("/:id", salesController.getById);
router.patch("/:id", validate(updateSaleSchema), salesController.update);
router.delete("/:id", salesController.delete);

export default router;
