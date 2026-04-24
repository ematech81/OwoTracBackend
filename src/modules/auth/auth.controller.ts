import { Request, Response, NextFunction } from "express";
import { authService } from "./auth.service";
import { sendSuccess } from "../../utils/response";
import { AuthRequest } from "../../middleware/auth.middleware";

export const authController = {
  async sendOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.sendOtp(req.body.phone);
      sendSuccess(res, result, "OTP sent successfully");
    } catch (err) {
      next(err);
    }
  },

  async verifyOtp(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.verifyOtp(req.body.phone, req.body.otp);
      sendSuccess(res, result, "Phone verified successfully");
    } catch (err) {
      next(err);
    }
  },

  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      sendSuccess(res, result, "Registration successful", 201);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body.phone, req.body.pin);
      sendSuccess(res, result, "Login successful");
    } catch (err) {
      next(err);
    }
  },

  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.refreshToken(req.body.refreshToken);
      sendSuccess(res, result, "Token refreshed");
    } catch (err) {
      next(err);
    }
  },

  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.logout(req.body.refreshToken);
      sendSuccess(res, null, "Logged out successfully");
    } catch (err) {
      next(err);
    }
  },

  async changePin(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      await authService.changePin(req.userId!, req.body.currentPin, req.body.newPin);
      sendSuccess(res, null, "PIN changed successfully");
    } catch (err) {
      next(err);
    }
  },

  async forgotPin(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.forgotPin(req.body.phone);
      sendSuccess(res, result, "OTP sent for PIN reset");
    } catch (err) {
      next(err);
    }
  },

  async resetPin(req: Request, res: Response, next: NextFunction) {
    try {
      await authService.resetPin(req.body.phone, req.body.otp, req.body.newPin);
      sendSuccess(res, null, "PIN reset successful");
    } catch (err) {
      next(err);
    }
  },
};
