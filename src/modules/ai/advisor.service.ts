import { Response } from "express";
import { openai } from "../../config/openai";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { summaryService } from "../reports/summary.service";
import { Credit } from "../credits/credit.model";
import { StockItem } from "../stock/stock.model";

// Context cache — re-use for up to 2 minutes per user to avoid rebuilding on every message
const ctxCache = new Map<string, { text: string; expiresAt: number }>();
async function getCachedContext(userId: string): Promise<string> {
  const now = Date.now();
  const cached = ctxCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.text;
  const text = await buildContext(userId);
  ctxCache.set(userId, { text, expiresAt: now + 5 * 60 * 1000 });
  return text;
}

const todayStr = () => new Date().toISOString().split("T")[0];

const SYSTEM_PROMPT = (userName: string, context: string) => `
You are OwoTrack AI Advisor — a smart, warm business coach for Nigerian market traders.
You are talking to ${userName}.

BUSINESS CONTEXT:
${context}

RULES:
- Keep responses SHORT: 2–4 sentences for chat, max 5 for analysis
- Be specific — reference actual numbers from the context when relevant
- Speak in a friendly mix of English and Nigerian Pidgin (e.g., "your profit don increase", "make you watch your expenses")
- Address the user by first name occasionally
- Give ONE clear actionable advice per response
- Use 1 emoji per response max
- If asked about something not in the context, give general good business advice
- Never make up specific numbers that aren't in the context
- Do NOT use markdown formatting (no bold, no bullet points with -)
- Keep responses conversational, like a knowledgeable friend
`.trim();

export interface AdvisorCard {
  type: "tracker" | "alert" | "tip";
  title: string;
  subtitle: string;
  value: string;
  positive?: boolean;
}

export interface AdvisorResponse {
  message: string;
  card?: AdvisorCard;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function buildContext(userId: string): Promise<string> {
  try {
    const today = todayStr();
    const [daily, weekly] = await Promise.all([
      summaryService.getDaily(userId, today).catch(() => null),
      summaryService.getWeekly(userId, today).catch(() => null),
    ]);

    const [credits, stockItems] = await Promise.all([
      Credit.find({ userId, status: { $in: ["active", "overdue", "due_soon"] } })
        .lean().catch(() => []),
      StockItem.find({ userId, isDeleted: false })
        .select("name category qty unit costPrice sellingPrice lowStockThreshold")
        .lean().catch(() => []),
    ]);

    const totalOutstanding = credits.reduce((s, c) => s + c.balance, 0);
    const overdueCount = credits.filter((c) => c.status === "overdue").length;

    // Stock calculations (use selling price as primary value, cost as fallback — Nigerian market convention)
    const stockTotalValue = stockItems.reduce(
      (s, i) => s + i.qty * (i.sellingPrice || i.costPrice),
      0,
    );
    const outOfStock = stockItems.filter((i) => i.qty === 0);
    const lowStock = stockItems.filter(
      (i) => i.qty > 0 && i.qty <= (i.lowStockThreshold ?? 5),
    );
    const topByValue = [...stockItems]
      .sort((a, b) => {
        const va = b.qty * (b.sellingPrice || b.costPrice);
        const vb = a.qty * (a.sellingPrice || a.costPrice);
        return va - vb;
      })
      .slice(0, 5);

    const lines: string[] = [
      `TODAY (${today}):`,
      `  Sales: ₦${(daily?.totalSales ?? 0).toLocaleString()}`,
      `  Expenses: ₦${(daily?.totalExpenses ?? 0).toLocaleString()}`,
      `  Net Profit: ₦${(daily?.netProfit ?? 0).toLocaleString()}`,
    ];

    if (daily?.bestProduct?.name) {
      lines.push(`  Best product today: ${daily.bestProduct.name} (₦${daily.bestProduct.amount.toLocaleString()})`);
    }

    lines.push("", "THIS WEEK (last 7 days):");
    lines.push(`  Total Sales: ₦${(weekly?.totalSales ?? 0).toLocaleString()}`);
    lines.push(`  Total Expenses: ₦${(weekly?.totalExpenses ?? 0).toLocaleString()}`);
    lines.push(`  Net Profit: ₦${(weekly?.netProfit ?? 0).toLocaleString()}`);
    lines.push(`  Profit Margin: ${weekly?.profitMargin ?? 0}%`);

    if (weekly?.topProducts?.length) {
      lines.push(`  Top products: ${weekly.topProducts.slice(0, 3).map((p) => p.name).join(", ")}`);
    }

    if (weekly?.days?.length) {
      const bestDay = weekly.days.reduce((best, d) => d.totalSales > best.totalSales ? d : best, weekly.days[0]);
      lines.push(`  Best sales day this week: ${bestDay.label} (₦${bestDay.totalSales.toLocaleString()})`);
    }

    lines.push("", "CREDITS:");
    lines.push(`  Outstanding: ₦${totalOutstanding.toLocaleString()} from ${credits.length} customer(s)`);
    if (overdueCount > 0) lines.push(`  Overdue: ${overdueCount} customer(s) — needs follow-up`);

    lines.push("", "STOCK INVENTORY:");
    lines.push(`  Total stock value: ₦${stockTotalValue.toLocaleString()}`);
    lines.push(`  Total items tracked: ${stockItems.length}`);
    lines.push(`  Out of stock: ${outOfStock.length} item(s)`);
    lines.push(`  Low stock (≤5 units): ${lowStock.length} item(s)`);

    if (outOfStock.length > 0) {
      lines.push(`  Out-of-stock items: ${outOfStock.slice(0, 5).map((i) => i.name).join(", ")}`);
    }
    if (lowStock.length > 0) {
      lines.push(`  Low-stock items: ${lowStock.slice(0, 5).map((i) => `${i.name} (${i.qty} left)`).join(", ")}`);
    }
    if (topByValue.length > 0) {
      lines.push(
        `  Top items by value: ${topByValue
          .map((i) => `${i.name} — ${i.qty} ${i.unit}s @ ₦${(i.sellingPrice || i.costPrice).toLocaleString()} = ₦${(i.qty * (i.sellingPrice || i.costPrice)).toLocaleString()}`)
          .join("; ")}`,
      );
    }

    return lines.join("\n");
  } catch (err) {
    logger.error("Context build failed:", err);
    return "No business data available yet.";
  }
}

export const advisorService = {
  async getTip(userId: string, userName: string): Promise<AdvisorResponse> {
    const context = await getCachedContext(userId);
    const firstName = userName.split(" ")[0];

    try {
      const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content: `You are OwoTrack AI — a smart business coach for Nigerian market traders.
Generate ONE short, specific, actionable business insight (1–2 sentences max) for ${firstName} based on their real data.
Rules:
- Reference actual numbers from the context if helpful
- Be direct and practical — not generic advice
- Friendly but concise
- No markdown, no bullet points, no greetings
- Do NOT start with "Hello", "Hi", or the user's name`,
          },
          {
            role: "user",
            content: `Business data:\n${context}\n\nGenerate a single actionable tip or insight based on this data.`,
          },
        ],
        max_tokens: 80,
        temperature: 0.7,
      });

      return {
        message: response.choices[0].message.content?.trim() ?? "Keep tracking your sales daily to spot trends early.",
      };
    } catch (err) {
      logger.error("Advisor tip failed:", err);
      return { message: "Track your best-selling product and make sure you never run out of stock." };
    }
  },

  async getGreeting(userId: string, userName: string): Promise<AdvisorResponse> {
    const context = await getCachedContext(userId);
    const firstName = userName.split(" ")[0];

    try {
      const today = todayStr();
      // Re-use cached weekly data already embedded in context — only fetch if needed for card
      const weekly = await summaryService.getWeekly(userId, today).catch(() => null);

      // Compute week-over-week trend if we have 2 weeks of data
      let card: AdvisorCard | undefined;
      if (weekly && weekly.totalSales > 0) {
        const prevWeekAnchor = new Date();
        prevWeekAnchor.setDate(prevWeekAnchor.getDate() - 7);
        const prevWeekStr = prevWeekAnchor.toISOString().split("T")[0];
        const prevWeekly = await summaryService.getWeekly(userId, prevWeekStr).catch(() => null);

        if (prevWeekly && prevWeekly.totalSales > 0) {
          const growth = ((weekly.totalSales - prevWeekly.totalSales) / prevWeekly.totalSales) * 100;
          const growthRounded = Math.round(growth * 10) / 10;
          const positive = growth >= 0;

          const topProduct = weekly.topProducts?.[0];
          card = {
            type: "tracker",
            title: "Growth Tracker",
            subtitle: topProduct
              ? `Your business is showing ${positive ? "strong positive" : "a decline in"} trends in the '${topProduct.name}' category.`
              : `Your weekly sales ${positive ? "increased" : "dropped"} compared to last week.`,
            value: `${positive ? "+" : ""}${growthRounded}%`,
            positive,
          };
        } else if (weekly.totalSales > 0) {
          card = {
            type: "tip",
            title: "Weekly Summary",
            subtitle: weekly.topProducts?.[0]
              ? `Your top product this week is ${weekly.topProducts[0].name}.`
              : "Keep recording your sales to unlock growth insights.",
            value: `₦${weekly.netProfit.toLocaleString()} profit`,
            positive: weekly.netProfit >= 0,
          };
        }
      }

      const hour = new Date().getHours();
      const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

      const prompt = `Generate a short, warm greeting (2 sentences max) for ${firstName}.
Context: ${context}
Start with "${greeting} ${firstName}!"
Mention 1 specific insight from today or this week.
End with an engaging question.`;

      const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT(firstName, context) },
          { role: "user", content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.7,
      });

      return {
        message: response.choices[0].message.content?.trim() ?? `${greeting} ${firstName}! How is business today?`,
        card,
      };
    } catch (err) {
      logger.error("Advisor greeting failed:", err);
      return { message: `Hello ${firstName}! How can I help your business today?` };
    }
  },

  async chat(
    userId: string,
    userName: string,
    message: string,
    history: ChatMessage[]
  ): Promise<AdvisorResponse> {
    const context = await getCachedContext(userId);
    const firstName = userName.split(" ")[0];

    try {
      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT(firstName, context) },
        ...history.slice(-6),
        { role: "user" as const, content: message },
      ];

      const response = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        max_tokens: 200,
        temperature: 0.7,
      });

      return {
        message: response.choices[0].message.content?.trim() ?? "I no fit answer that right now. Try again.",
      };
    } catch (err) {
      logger.error("Advisor chat failed:", err);
      return { message: "Something went wrong. Please try again." };
    }
  },

  async chatStream(
    userId: string,
    userName: string,
    message: string,
    history: ChatMessage[],
    res: Response
  ): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const context = await getCachedContext(userId);
      const firstName = userName.split(" ")[0];

      const messages = [
        { role: "system" as const, content: SYSTEM_PROMPT(firstName, context) },
        ...history.slice(-6),
        { role: "user" as const, content: message },
      ];

      const stream = await openai.chat.completions.create({
        model: env.OPENAI_MODEL,
        messages,
        max_tokens: 200,
        temperature: 0.7,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) {
          res.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
      }
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    } catch (err) {
      logger.error("Advisor stream failed:", err);
      res.write(`data: ${JSON.stringify({ error: "Something went wrong." })}\n\n`);
    } finally {
      res.end();
    }
  },
};
