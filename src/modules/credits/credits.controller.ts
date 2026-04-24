import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { creditsService } from "./credits.service";
import { sendSuccess } from "../../utils/response";

export const creditsController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const credit = await creditsService.create(req.userId!, req.body);
      sendSuccess(res, credit, "Credit recorded", 201);
    } catch (err) { next(err); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { status, page, limit } = req.query as Record<string, string>;
      const result = await creditsService.list(req.userId!, {
        status,
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 50,
      });
      sendSuccess(res, result.credits, "Credits fetched", 200, {
        page: result.page, limit: result.limit, total: result.total,
      });
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const credit = await creditsService.getById(req.userId!, req.params.id);
      sendSuccess(res, credit);
    } catch (err) { next(err); }
  },

  async recordPayment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { amount, note } = req.body;
      const credit = await creditsService.recordPayment(req.userId!, req.params.id, amount, note);
      sendSuccess(res, credit, "Payment recorded");
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await creditsService.delete(req.userId!, req.params.id);
      sendSuccess(res, null, "Credit deleted");
    } catch (err) { next(err); }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await creditsService.getStats(req.userId!);
      sendSuccess(res, stats, "Stats fetched");
    } catch (err) { next(err); }
  },
};
