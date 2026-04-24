import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { summaryService } from "./summary.service";
import { sendSuccess } from "../../utils/response";

export const reportsController = {
  async daily(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const summary = await summaryService.getDaily(req.userId!, date);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  async weekly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
      const summary = await summaryService.getWeekly(req.userId!, date);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },

  async monthly(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const now = new Date();
      const year = parseInt(req.query.year as string) || now.getFullYear();
      const month = parseInt(req.query.month as string) || now.getMonth() + 1;
      const summary = await summaryService.getMonthly(req.userId!, year, month);
      sendSuccess(res, summary);
    } catch (err) { next(err); }
  },
};
