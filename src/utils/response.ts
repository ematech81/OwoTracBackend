import { Response } from "express";

interface Meta {
  page?: number;
  limit?: number;
  total?: number;
}

export const sendSuccess = (
  res: Response,
  data: unknown,
  message = "Success",
  statusCode = 200,
  meta?: Meta
): void => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    error: null,
    meta: meta || null,
  });
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  code = "BAD_REQUEST",
  details?: string
): void => {
  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    error: { code, details: details || null },
    meta: null,
  });
};
