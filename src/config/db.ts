import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "./logger";

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error("MongoDB connection failed:", error);
    process.exit(1);
  }
};

mongoose.connection.on("disconnected", () => {
  logger.warn("MongoDB disconnected");
});
