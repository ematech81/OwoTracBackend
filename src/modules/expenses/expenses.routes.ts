import { Router } from "express";
import { expensesController } from "./expenses.controller";
import { authenticate } from "../../middleware/auth.middleware";
import { validate } from "../../middleware/validate";
import { createExpenseSchema, updateExpenseSchema, parseTextSchema } from "./expenses.validation";
import { guardExpenses } from "../../middleware/planGate";

const router = Router();

router.use(authenticate);

router.post("/parse-text", validate(parseTextSchema), expensesController.parseText);
router.post("/", guardExpenses, validate(createExpenseSchema), expensesController.create);
router.get("/", expensesController.list);
router.get("/:id", expensesController.getById);
router.patch("/:id", validate(updateExpenseSchema), expensesController.update);
router.delete("/:id", expensesController.delete);

export default router;
