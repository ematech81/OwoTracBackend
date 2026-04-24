import { Request, Response, NextFunction } from "express";
import { openai } from "../../config/openai";
import { sendSuccess } from "../../utils/response";
import { AppError } from "../../middleware/errorHandler";
import { toFile } from "openai";
import { logger } from "../../config/logger";

export const transcribeAudio = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError(400, "No audio file uploaded", "NO_FILE");

    logger.info(`Voice transcribe: received file size=${req.file.size} mime=${req.file.mimetype}`);

    const audioFile = await toFile(
      req.file.buffer,
      req.file.originalname || "recording.m4a",
      { type: req.file.mimetype || "audio/m4a" }
    );

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      prompt: "Nigerian Pidgin English, market trader, sales and expenses, prices in Naira",
    });

    sendSuccess(res, { transcript: transcription.text }, "Transcribed");
  } catch (error) {
    logger.error("Voice transcription failed:", error);
    next(error);
  }
};
