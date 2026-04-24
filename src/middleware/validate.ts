import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    req.body = result.data;
    next();
  };
