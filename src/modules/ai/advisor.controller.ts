import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { advisorService, ChatMessage } from "./advisor.service";
import { sendSuccess } from "../../utils/response";
import { User } from "../users/user.model";

export const advisorController = {
  async tip(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).lean();
      const userName = user?.name ?? "Trader";
      const result = await advisorService.getTip(req.userId!, userName);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async greeting(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const user = await User.findById(req.userId).lean();
      const userName = user?.name ?? "Trader";
      const result = await advisorService.getGreeting(req.userId!, userName);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async chat(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message, history = [] } = req.body as { message: string; history: ChatMessage[] };
      const user = await User.findById(req.userId).lean();
      const userName = user?.name ?? "Trader";
      const result = await advisorService.chat(req.userId!, userName, message, history);
      sendSuccess(res, result);
    } catch (err) { next(err); }
  },

  async chatStream(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { message, history = [] } = req.body as { message: string; history: ChatMessage[] };
      const user = await User.findById(req.userId).lean();
      const userName = user?.name ?? "Trader";
      await advisorService.chatStream(req.userId!, userName, message, history, res);
    } catch (err) { next(err); }
  },
};
