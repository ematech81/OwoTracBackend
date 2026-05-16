import "dotenv/config";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { env } from "./config/env";
import { connectDB } from "./config/db";
import { connectRedis } from "./config/redis";
import { logger } from "./config/logger";
import { globalLimiter } from "./middleware/rateLimiter";
import { errorHandler } from "./middleware/errorHandler";
// import { requireAppKey } from "./middleware/appKey";

import { startCreditOverdueJob } from "./jobs/creditOverdue.job";
import { startDailySummaryJob } from "./jobs/dailySummary.job";
import { startReferralRewardExpiryJob } from "./jobs/referralRewardExpiry.job";
import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import salesRoutes from "./modules/sales/sales.routes";
import expensesRoutes from "./modules/expenses/expenses.routes";
import voiceRoutes from "./modules/voice/voice.routes";
import creditsRoutes from "./modules/credits/credits.routes";
import reportsRoutes from "./modules/reports/reports.routes";
import advisorRoutes from "./modules/ai/advisor.routes";
import stockRoutes from "./modules/stock/stock.routes";
import subscriptionRoutes from "./modules/subscription/subscription.routes";
import adminRoutes from "./modules/admin/admin.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import { Broadcast } from "./models/broadcast.model";

const app = express();

// Trust Railway's reverse proxy so express-rate-limit reads the real client IP
// from X-Forwarded-For instead of the proxy's internal IP
app.set("trust proxy", 1);

app.use(helmet());
app.use(cors({ origin: "*", credentials: true }));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev", { stream: { write: (msg) => logger.info(msg.trim()) } }));
app.use(globalLimiter);

app.get("/health", (_req, res) => {
  res.json({ success: true, message: "OwoTrack API is running", data: null, error: null, meta: null });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/sales", salesRoutes);
app.use("/api/v1/expenses", expensesRoutes);
app.use("/api/v1/voice", voiceRoutes);
app.use("/api/v1/credits", creditsRoutes);
app.use("/api/v1/reports", reportsRoutes);
app.use("/api/v1/advisor", advisorRoutes);
app.use("/api/v1/stock", stockRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// Admin routes — separate from /api/v1, no APP_KEY required, uses own JWT auth
app.use("/api/admin", adminRoutes);

// Public broadcasts — requires APP_KEY, no user auth needed
app.get("/api/v1/broadcasts", async (_req, res) => {
  try {
    const broadcasts = await Broadcast.find().sort({ createdAt: -1 }).limit(10);
    res.json({ success: true, data: broadcasts, error: null, meta: null });
  } catch {
    res.status(500).json({ success: false, data: null, error: "Server error", meta: null });
  }
});

app.use(errorHandler);

const start = async () => {
  await connectDB();
  await connectRedis();

  if (env.NODE_ENV !== "test") {
    startCreditOverdueJob();
    startDailySummaryJob();
    startReferralRewardExpiryJob();
  }

  app.listen(env.PORT, () => {
    logger.info(`${env.APP_NAME} API running on port ${env.PORT} [${env.NODE_ENV}]`);
  });
};

start();

export default app;
