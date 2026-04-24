import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { expensesService } from "./expenses.service";
import { sendSuccess } from "../../utils/response";
import { expensesQuerySchema } from "./expenses.validation";

export const expensesController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expensesService.create(req.userId!, req.body);
      sendSuccess(res, expense, "Expense recorded", 201);
    } catch (err) { next(err); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const query = expensesQuerySchema.parse(req.query);
      const { expenses, total, page, limit } = await expensesService.list(req.userId!, query);
      sendSuccess(res, expenses, "Expenses fetched", 200, { page, limit, total });
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expensesService.getById(req.userId!, req.params.id);
      sendSuccess(res, expense);
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const expense = await expensesService.update(req.userId!, req.params.id, req.body);
      sendSuccess(res, expense, "Expense updated");
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await expensesService.delete(req.userId!, req.params.id);
      sendSuccess(res, null, "Expense deleted");
    } catch (err) { next(err); }
  },

  async parseText(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await expensesService.parseText(req.body.input);
      sendSuccess(res, result, "Parsed successfully");
    } catch (err) { next(err); }
  },
};
