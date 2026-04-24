import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { salesService } from "./sales.service";
import { sendSuccess } from "../../utils/response";
import { salesQuerySchema } from "./sales.validation";

export const salesController = {
  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sale = await salesService.create(req.userId!, req.body);
      sendSuccess(res, sale, "Sale recorded", 201);
    } catch (err) { next(err); }
  },

  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const query = salesQuerySchema.parse(req.query);
      const { sales, total, page, limit } = await salesService.list(req.userId!, query);
      sendSuccess(res, sales, "Sales fetched", 200, { page, limit, total });
    } catch (err) { next(err); }
  },

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sale = await salesService.getById(req.userId!, req.params.id);
      sendSuccess(res, sale);
    } catch (err) { next(err); }
  },

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const sale = await salesService.update(req.userId!, req.params.id, req.body);
      sendSuccess(res, sale, "Sale updated");
    } catch (err) { next(err); }
  },

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await salesService.delete(req.userId!, req.params.id);
      sendSuccess(res, null, "Sale deleted");
    } catch (err) { next(err); }
  },

  async parseText(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await salesService.parseText(req.body.input);
      sendSuccess(res, result, "Parsed successfully");
    } catch (err) { next(err); }
  },
};
