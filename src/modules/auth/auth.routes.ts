import { Router } from "express";
import { authController } from "./auth.controller";
import { validate } from "../../middleware/validate";
import { authenticate } from "../../middleware/auth.middleware";
import { otpLimiter, authLimiter } from "../../middleware/rateLimiter";
import {
  sendOtpSchema,
  verifyOtpSchema,
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePinSchema,
  forgotPinSchema,
  resetPinSchema,
} from "./auth.validation";

const router = Router();

router.post("/send-otp", otpLimiter, validate(sendOtpSchema), authController.sendOtp);
router.post("/verify-otp", validate(verifyOtpSchema), authController.verifyOtp);
router.post("/register", validate(registerSchema), authController.register);
router.post("/login", authLimiter, validate(loginSchema), authController.login);
router.post("/refresh-token", validate(refreshTokenSchema), authController.refreshToken);
router.post("/logout", authController.logout);
router.post("/change-pin", authenticate, validate(changePinSchema), authController.changePin);
router.post("/forgot-pin", otpLimiter, validate(forgotPinSchema), authController.forgotPin);
router.post("/reset-pin", validate(resetPinSchema), authController.resetPin);

export default router;
