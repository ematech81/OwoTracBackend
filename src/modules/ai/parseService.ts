import { openai } from "../../config/openai";
import { env } from "../../config/env";
import { logger } from "../../config/logger";

const SALES_PARSE_PROMPT = `You are a financial assistant for Nigerian market traders.
Parse sales entries written in Nigerian Pidgin, English, or a mix of both.

PARSING RULES:
- "k" after number = × 1000 (5k = 5000, 2.5k = 2500)
- "m" after number = × 1,000,000
- Nigerian units: paint, carton, bag, piece, dozen, roll, yard, bottle, pack, plate, cup
- When quantity unclear: assume 1
- When unit price unclear: given amount is total for that item
- Handle incomplete entries gracefully — make best guess

Return ONLY valid JSON. No explanation text.`;

const EXPENSE_PARSE_PROMPT = `You are a financial assistant for Nigerian market traders.
Parse expense entries written in Nigerian Pidgin, English, or a mix of both.

PARSING RULES:
- "k" after number = × 1000 (5k = 5000)
- Extract: description, amount, and best-fit category
- Categories: stock_purchase, transportation, market_levy, shop_rent, labor, utilities, communication, packaging, equipment, personal, loan_repayment, other

Return ONLY valid JSON. No explanation text.`;

export interface ParsedSaleItem {
  productName: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalAmount: number;
}

export interface ParsedSale {
  items: ParsedSaleItem[];
  totalAmount: number;
  paymentType: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string;
}

export interface ParsedExpense {
  description: string;
  amount: number;
  category: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion: string;
}

const fallbackSale = (input: string): ParsedSale => ({
  items: [{ productName: input, category: "other", quantity: 1, unit: "piece", unitPrice: 0, totalAmount: 0 }],
  totalAmount: 0,
  paymentType: "cash",
  confidence: 0,
  needsClarification: true,
  clarificationQuestion: "I no understand. How much you sell and wetin be the product?",
});

const fallbackExpense = (input: string): ParsedExpense => ({
  description: input,
  amount: 0,
  category: "other",
  confidence: 0,
  needsClarification: true,
  clarificationQuestion: "How much be this expense?",
});

export const parseSaleText = async (input: string): Promise<ParsedSale> => {
  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: SALES_PARSE_PROMPT },
        {
          role: "user",
          content: `Parse this sale: "${input}"
Return JSON:
{
  "items": [{"productName":"","category":"","quantity":0,"unit":"","unitPrice":0,"totalAmount":0}],
  "totalAmount": 0,
  "paymentType": "cash",
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": ""
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}") as ParsedSale;
    return result;
  } catch (error) {
    logger.error("Sale parse failed:", error);
    return fallbackSale(input);
  }
};

export const parseExpenseText = async (input: string): Promise<ParsedExpense> => {
  try {
    const response = await openai.chat.completions.create({
      model: env.OPENAI_MODEL,
      messages: [
        { role: "system", content: EXPENSE_PARSE_PROMPT },
        {
          role: "user",
          content: `Parse this expense: "${input}"
Return JSON:
{
  "description": "",
  "amount": 0,
  "category": "other",
  "confidence": 0.95,
  "needsClarification": false,
  "clarificationQuestion": ""
}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.1,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}") as ParsedExpense;
    return result;
  } catch (error) {
    logger.error("Expense parse failed:", error);
    return fallbackExpense(input);
  }
};
