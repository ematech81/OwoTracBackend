import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { User } from "../users/user.model";
import { Sale } from "../sales/sale.model";

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET || process.env.JWT_ACCESS_SECRET || "admin-fallback-secret";

export const adminController = {
  login: async (req: Request, res: Response): Promise<void> => {
    const { username, password } = req.body;
    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminPassword = process.env.ADMIN_PASSWORD || "";

    if (!adminPassword) {
      res.status(503).json({ success: false, message: "Admin credentials not configured on server" });
      return;
    }
    if (username !== adminUsername || password !== adminPassword) {
      res.status(401).json({ success: false, message: "Invalid credentials" });
      return;
    }

    const token = jwt.sign({ admin: true, username }, ADMIN_JWT_SECRET, { expiresIn: "24h" });
    res.json({ success: true, data: { token } });
  },

  getStats: async (_req: Request, res: Response): Promise<void> => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [
        totalUsers,
        activeSubscriptions,
        disabledUsers,
        todayAgg,
        totalAgg,
        userGrowth,
        planDistribution,
        recentUsers,
        recentTransactions,
      ] = await Promise.all([
        User.countDocuments(),
        User.countDocuments({ "subscription.status": "active" }),
        User.countDocuments({ isActive: false }),
        Sale.aggregate([
          { $match: { date: { $gte: today, $lt: tomorrow }, isDeleted: false } },
          { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: "$totalAmount" } } },
        ]),
        Sale.aggregate([
          { $match: { isDeleted: false } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
        User.aggregate([
          { $match: { createdAt: { $gte: sevenDaysAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
              count: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        User.aggregate([
          { $group: { _id: "$subscription.plan", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        User.find()
          .select("name phone businessName subscription.plan isActive createdAt")
          .sort({ createdAt: -1 })
          .limit(5),
        Sale.find({ isDeleted: false })
          .populate("userId", "name phone")
          .select("date totalAmount paymentType items userId invoiceNumber")
          .sort({ date: -1 })
          .limit(5),
      ]);

      res.json({
        success: true,
        data: {
          totalUsers,
          activeSubscriptions,
          disabledUsers,
          todaySalesCount: todayAgg[0]?.count ?? 0,
          todayRevenue: todayAgg[0]?.revenue ?? 0,
          totalRevenue: totalAgg[0]?.total ?? 0,
          userGrowth,
          planDistribution,
          recentUsers,
          recentTransactions,
        },
      });
    } catch (err) {
      console.error("[admin] getStats error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  listUsers: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = "1", limit = "20", search = "", plan = "", status = "" } = req.query;

      const query: Record<string, unknown> = {};
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { businessName: { $regex: search, $options: "i" } },
        ];
      }
      if (status === "disabled") {
        query.isActive = false;
      } else if (status) {
        query["subscription.status"] = status;
      }
      if (plan) query["subscription.plan"] = plan;

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [users, total] = await Promise.all([
        User.find(query)
          .select("name phone businessName subscription isActive createdAt streakDays healthScore")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum),
        User.countDocuments(query),
      ]);

      res.json({ success: true, data: { users, total, page: pageNum, limit: limitNum } });
    } catch (err) {
      console.error("[admin] listUsers error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  getUser: async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.params.id).select("-pin -refreshToken");
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      const [salesCount, totalAgg] = await Promise.all([
        Sale.countDocuments({ userId: user._id, isDeleted: false }),
        Sale.aggregate([
          { $match: { userId: user._id, isDeleted: false } },
          { $group: { _id: null, total: { $sum: "$totalAmount" } } },
        ]),
      ]);

      res.json({
        success: true,
        data: {
          user,
          salesCount,
          totalRevenue: totalAgg[0]?.total ?? 0,
        },
      });
    } catch (err) {
      console.error("[admin] getUser error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  updateSubscription: async (req: Request, res: Response): Promise<void> => {
    try {
      const { plan, status, expiresAt, daysFromNow } = req.body;
      const update: Record<string, unknown> = {};

      if (plan) update["subscription.plan"] = plan;
      if (status) update["subscription.status"] = status;

      if (daysFromNow) {
        const expiry = new Date();
        expiry.setDate(expiry.getDate() + parseInt(daysFromNow, 10));
        update["subscription.expiresAt"] = expiry;
      } else if (expiresAt) {
        update["subscription.expiresAt"] = new Date(expiresAt);
      }

      if (status === "active") {
        update["subscription.startDate"] = new Date();
      }

      const user = await User.findByIdAndUpdate(req.params.id, { $set: update }, { new: true }).select("-pin -refreshToken");
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }

      res.json({ success: true, data: user });
    } catch (err) {
      console.error("[admin] updateSubscription error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  toggleUserStatus: async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await User.findById(req.params.id);
      if (!user) {
        res.status(404).json({ success: false, message: "User not found" });
        return;
      }
      user.isActive = !user.isActive;
      await user.save();
      res.json({ success: true, data: { isActive: user.isActive } });
    } catch (err) {
      console.error("[admin] toggleUserStatus error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },

  listTransactions: async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = "1", limit = "20", paymentType = "", startDate = "", endDate = "", userId = "" } = req.query;

      const query: Record<string, unknown> = { isDeleted: false };
      if (paymentType) query.paymentType = paymentType;
      if (userId) query.userId = userId;
      if (startDate || endDate) {
        const dateQuery: Record<string, Date> = {};
        if (startDate) dateQuery.$gte = new Date(startDate as string);
        if (endDate) dateQuery.$lte = new Date(endDate as string);
        query.date = dateQuery;
      }

      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const skip = (pageNum - 1) * limitNum;

      const [transactions, total] = await Promise.all([
        Sale.find(query)
          .populate("userId", "name phone")
          .select("date totalAmount paymentType items userId invoiceNumber customerName inputMethod")
          .sort({ date: -1 })
          .skip(skip)
          .limit(limitNum),
        Sale.countDocuments(query),
      ]);

      res.json({ success: true, data: { transactions, total, page: pageNum, limit: limitNum } });
    } catch (err) {
      console.error("[admin] listTransactions error:", err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  },
};
