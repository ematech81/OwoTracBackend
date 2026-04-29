import { Response, NextFunction } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { UserNotification } from "../../models/userNotification.model";

export const notificationsController = {
  async list(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const notifications = await UserNotification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
      const unreadCount = await UserNotification.countDocuments({ userId, isRead: false });
      res.json({ success: true, data: { notifications, unreadCount }, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const { id } = req.params;
      await UserNotification.findOneAndUpdate({ _id: id, userId }, { isRead: true });
      res.json({ success: true, data: null, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      await UserNotification.updateMany({ userId, isRead: false }, { isRead: true });
      res.json({ success: true, data: null, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },

  async unreadCount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.userId!;
      const count = await UserNotification.countDocuments({ userId, isRead: false });
      res.json({ success: true, data: { count }, error: null, meta: null });
    } catch (err) {
      next(err);
    }
  },
};
