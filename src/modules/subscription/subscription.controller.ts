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
      // Korapay signs the raw request body with HMAC-SHA256 and sends the hex
      // digest in the x-korapay-signature header. We captured rawBody in app.ts.
      const signature = req.headers["x-korapay-signature"] as string;
      const rawBody = (req as any).rawBody as string ?? JSON.stringify(req.body);

      if (!subscriptionService.verifyWebhookSignature(signature, rawBody)) {
        throw new AppError(401, "Invalid webhook signature", "INVALID_SIGNATURE");
      }

      await subscriptionService.handleWebhookEvent(req.body.event, req.body.data);

      res.sendStatus(200);
    } catch (err) {
      next(err);
    }
  },
};
