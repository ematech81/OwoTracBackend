import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as subscriptionService from "./subscription.service";
import { PlanId } from "../../config/plans";
import { AppError } from "../../middleware/errorHandler";

export const subscriptionController = {
  async getStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const status = await subscriptionService.getStatus(req.userId!);
      res.json({ success: true, message: "ok", data: status, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async initialize(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const planId = req.params.planId as PlanId;
      const result = await subscriptionService.initializeSubscription(req.userId!, planId);
      res.json({ success: true, message: "Checkout initialized", data: result, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { txRef } = req.params;
      const result = await subscriptionService.verifyTransaction(txRef);
      res.json({ success: true, message: "Payment verified", data: result, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async cancel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await subscriptionService.cancelSubscription(req.userId!);
      res.json({ success: true, message: "Subscription cancelled", data: null, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async webhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers["verif-hash"] as string;

      if (!subscriptionService.verifyWebhookSignature(signature)) {
        throw new AppError(401, "Invalid webhook signature", "INVALID_SIGNATURE");
      }

      // express.json() has already parsed the body at this point
      await subscriptionService.handleWebhookEvent(req.body.event, req.body.data);

      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  },
};
