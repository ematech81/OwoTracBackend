import mongoose from "mongoose";
import { Expense, IExpense } from "./expense.model";
import { AppError } from "../../middleware/errorHandler";
import { parseExpenseText } from "../ai/parseService";

export const expensesService = {
  async create(userId: string, body: {
    date: string;
    description: string;
    amount: number;
    category: string;
    isRecurring: boolean;
    recurringFrequency: string;
    rawInput?: string;
    localId?: string;
  }) {
    const expense = await Expense.create({
      userId,
      date: new Date(body.date),
      description: body.description,
      amount: body.amount,
      category: body.category,
      isRecurring: body.isRecurring,
      recurringFrequency: body.recurringFrequency,
      rawInput: body.rawInput,
      localId: body.localId,
      syncStatus: "synced",
    });
    return expense;
  },

  async list(userId: string, query: {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
    category?: string;
  }) {
    const filter: mongoose.FilterQuery<typeof Expense> = { userId, isDeleted: false };

    if (query.startDate || query.endDate) {
      filter.date = {};
      if (query.startDate) filter.date.$gte = new Date(query.startDate);
      if (query.endDate) filter.date.$lte = new Date(query.endDate);
    }
    if (query.category) filter.category = query.category;

    const skip = (query.page - 1) * query.limit;
    const [expenses, total] = await Promise.all([
      Expense.find(filter).sort({ date: -1 }).skip(skip).limit(query.limit),
      Expense.countDocuments(filter),
    ]);

    return { expenses, total, page: query.page, limit: query.limit };
  },

  async getById(userId: string, expenseId: string) {
    const expense = await Expense.findOne({ _id: expenseId, userId, isDeleted: false });
    if (!expense) throw new AppError(404, "Expense not found", "NOT_FOUND");
    return expense;
  },

  async update(userId: string, expenseId: string, body: Partial<IExpense>) {
    const expense = await Expense.findOne({ _id: expenseId, userId, isDeleted: false });
    if (!expense) throw new AppError(404, "Expense not found", "NOT_FOUND");

    if (body.date) expense.date = body.date;
    if (body.description) expense.description = body.description;
    if (body.amount !== undefined) expense.amount = body.amount;
    if (body.category) expense.category = body.category;
    if (body.isRecurring !== undefined) expense.isRecurring = body.isRecurring;
    if (body.recurringFrequency) expense.recurringFrequency = body.recurringFrequency;

    await expense.save();
    return expense;
  },

  async delete(userId: string, expenseId: string) {
    const expense = await Expense.findOne({ _id: expenseId, userId, isDeleted: false });
    if (!expense) throw new AppError(404, "Expense not found", "NOT_FOUND");
    expense.isDeleted = true;
    await expense.save();
  },

  async parseText(input: string) {
    return parseExpenseText(input);
  },
};
