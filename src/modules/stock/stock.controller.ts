import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { stockService } from "./stock.service";
import { sendSuccess } from "../../utils/response";
import { stockQuerySchema } from "./stock.validation";

export const stockController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await stockService.create(req.userId!, req.body);
      sendSuccess(res, item, "Stock item created", 201);
    } catch (err) { next(err); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const query = stockQuerySchema.parse(req.query);
      const { items, total, page, limit } = await stockService.list(req.userId!, query);
      sendSuccess(res, items, "Stock items fetched", 200, { page, limit, total });
    } catch (err) { next(err); }
  },

  async getStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const stats = await stockService.getStats(req.userId!);
      sendSuccess(res, stats);
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await stockService.getById(req.userId!, req.params.id);
      sendSuccess(res, item);
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const item = await stockService.update(req.userId!, req.params.id, req.body);
      sendSuccess(res, item, "Stock item updated");
    } catch (err) { next(err); }
  },

  async adjustQty(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { delta } = req.body;
      const item = await stockService.adjustQty(req.userId!, req.params.id, delta);
      sendSuccess(res, item, "Quantity adjusted");
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await stockService.delete(req.userId!, req.params.id);
      sendSuccess(res, null, "Stock item deleted");
    } catch (err) { next(err); }
  },
};
