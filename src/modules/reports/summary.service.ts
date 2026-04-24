import { Sale } from "../sales/sale.model";
import { Expense } from "../expenses/expense.model";
import { Credit } from "../credits/credit.model";
import { DailySummary } from "./dailySummary.model";

const dayBounds = (dateStr: string) => {
  const start = new Date(dateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const toDateStr = (d: Date) => d.toISOString().split("T")[0];

const EMPTY_PAYMENT = { cash: 0, transfer: 0, pos: 0, credit: 0, mixed: 0 };

function sumPaymentBreakdowns(
  summaries: Array<{ paymentBreakdown?: typeof EMPTY_PAYMENT } | null>
) {
  return summaries.reduce(
    (acc, s) => {
      if (!s?.paymentBreakdown) return acc;
      return {
        cash:     acc.cash     + (s.paymentBreakdown.cash     ?? 0),
        transfer: acc.transfer + (s.paymentBreakdown.transfer ?? 0),
        pos:      acc.pos      + (s.paymentBreakdown.pos      ?? 0),
        credit:   acc.credit   + (s.paymentBreakdown.credit   ?? 0),
        mixed:    acc.mixed    + (s.paymentBreakdown.mixed    ?? 0),
      };
    },
    { ...EMPTY_PAYMENT }
  );
}

function growthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const summaryService = {
  async computeAndSaveDaily(userId: string, dateStr: string) {
    const { start, end } = dayBounds(dateStr);

    const [sales, expenses, creditsGiven, creditsCollected] = await Promise.all([
      Sale.find({ userId, date: { $gte: start, $lte: end }, isDeleted: false }),
      Expense.find({ userId, date: { $gte: start, $lte: end }, isDeleted: false }),
      Credit.find({ userId, createdAt: { $gte: start, $lte: end }, isDeleted: false }),
      Credit.find({ userId, "payments.date": { $gte: start, $lte: end }, isDeleted: false }),
    ]);

    const totalSales = sales.reduce((s, x) => s + x.totalAmount, 0);
    const totalCostOfGoods = sales.reduce((s, x) => s + x.totalCostOfGoods, 0);
    const totalExpenses = expenses.reduce((s, x) => s + x.amount, 0);
    const grossProfit = totalSales - totalCostOfGoods;
    const netProfit = grossProfit - totalExpenses;
    const profitMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 1000) / 10 : 0;

    const expenseBreakdown = {
      stock_purchase: 0, transportation: 0, market_levy: 0,
      labor: 0, utilities: 0, other: 0,
    };
    for (const exp of expenses) {
      const key = exp.category as keyof typeof expenseBreakdown;
      if (key in expenseBreakdown) expenseBreakdown[key] += exp.amount;
      else expenseBreakdown.other += exp.amount;
    }

    const productTotals: Record<string, number> = {};
    for (const sale of sales) {
      for (const item of sale.items) {
        productTotals[item.productName] = (productTotals[item.productName] || 0) + item.totalAmount;
      }
    }
    const bestProduct = Object.entries(productTotals).sort((a, b) => b[1] - a[1])[0];

    const creditGiven = creditsGiven.reduce((s, c) => s + c.amount, 0);
    const creditCollected = creditsCollected.reduce((s, c) => {
      const dayPayments = c.payments.filter((p) => p.date >= start && p.date <= end);
      return s + dayPayments.reduce((ps, p) => ps + p.amount, 0);
    }, 0);

    const salesCount = sales.length;
    const paymentBreakdown = { cash: 0, transfer: 0, pos: 0, credit: 0, mixed: 0 };
    for (const sale of sales) {
      const pt = sale.paymentType as keyof typeof paymentBreakdown;
      if (pt in paymentBreakdown) paymentBreakdown[pt] += sale.totalAmount;
      else paymentBreakdown.mixed += sale.totalAmount;
    }

    return DailySummary.findOneAndUpdate(
      { userId, date: start },
      {
        $set: {
          totalSales, totalCostOfGoods, totalExpenses,
          grossProfit, netProfit, profitMargin, expenseBreakdown,
          creditGiven, creditCollected, salesCount, paymentBreakdown,
          bestProduct: bestProduct ? { name: bestProduct[0], amount: bestProduct[1] } : undefined,
        },
      },
      { upsert: true, new: true }
    );
  },

  async getOutstandingCredits(userId: string): Promise<number> {
    const credits = await Credit.find(
      { userId, isDeleted: false, status: { $ne: "paid" } },
      { balance: 1 }
    );
    return credits.reduce((s, c) => s + c.balance, 0);
  },

  async getDaily(userId: string, dateStr: string) {
    const today = toDateStr(new Date());

    const yesterdayDate = new Date(dateStr);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayStr = toDateStr(yesterdayDate);

    const [summary, yesterdaySummary, totalOutstandingCredits] = await Promise.all([
      dateStr === today
        ? this.computeAndSaveDaily(userId, dateStr)
        : (async () => {
            const { start } = dayBounds(dateStr);
            const cached = await DailySummary.findOne({ userId, date: start });
            return cached ?? this.computeAndSaveDaily(userId, dateStr);
          })(),
      (async () => {
        const { start } = dayBounds(yesterdayStr);
        return DailySummary.findOne({ userId, date: start }).lean();
      })(),
      this.getOutstandingCredits(userId),
    ]);

    const s = summary!.toObject();
    return {
      ...s,
      totalOutstandingCredits,
      salesCount: s.salesCount ?? 0,
      avgSaleValue: (s.salesCount ?? 0) > 0 ? Math.round(s.totalSales / s.salesCount) : 0,
      paymentBreakdown: s.paymentBreakdown ?? { ...EMPTY_PAYMENT },
      salesGrowthPercent:  growthPct(s.totalSales,  yesterdaySummary?.totalSales  ?? 0),
      profitGrowthPercent: growthPct(s.netProfit,    yesterdaySummary?.netProfit   ?? 0),
    };
  },

  async getWeekly(userId: string, dateStr: string) {
    const anchor = new Date(dateStr);
    anchor.setHours(0, 0, 0, 0);
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      days.push(toDateStr(d));
    }

    // Fetch daily summaries and outstanding credits in parallel
    const today = toDateStr(new Date());
    const [summaries, totalOutstandingCredits] = await Promise.all([
      Promise.all(days.map((d) => {
        if (d === today) return this.computeAndSaveDaily(userId, d);
        return (async () => {
          const { start } = dayBounds(d);
          const cached = await DailySummary.findOne({ userId, date: start });
          return cached ?? this.computeAndSaveDaily(userId, d);
        })();
      })),
      this.getOutstandingCredits(userId),
    ]);

    const totals = summaries.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + (s?.totalSales ?? 0),
        totalExpenses: acc.totalExpenses + (s?.totalExpenses ?? 0),
        grossProfit: acc.grossProfit + (s?.grossProfit ?? 0),
        netProfit: acc.netProfit + (s?.netProfit ?? 0),
        totalCostOfGoods: acc.totalCostOfGoods + (s?.totalCostOfGoods ?? 0),
        creditGiven: acc.creditGiven + (s?.creditGiven ?? 0),
        creditCollected: acc.creditCollected + (s?.creditCollected ?? 0),
      }),
      { totalSales: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0, totalCostOfGoods: 0, creditGiven: 0, creditCollected: 0 }
    );

    const expenseBreakdown = summaries.reduce(
      (acc, s) => {
        if (!s?.expenseBreakdown) return acc;
        return {
          stock_purchase: acc.stock_purchase + s.expenseBreakdown.stock_purchase,
          transportation: acc.transportation + s.expenseBreakdown.transportation,
          market_levy: acc.market_levy + s.expenseBreakdown.market_levy,
          labor: acc.labor + s.expenseBreakdown.labor,
          utilities: acc.utilities + s.expenseBreakdown.utilities,
          other: acc.other + s.expenseBreakdown.other,
        };
      },
      { stock_purchase: 0, transportation: 0, market_levy: 0, labor: 0, utilities: 0, other: 0 }
    );

    const productMap: Record<string, number> = {};
    for (const s of summaries) {
      if (s?.bestProduct?.name) {
        productMap[s.bestProduct.name] = (productMap[s.bestProduct.name] || 0) + s.bestProduct.amount;
      }
    }
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    // Previous week: 7 days before this window
    const prevAnchor = new Date(anchor);
    prevAnchor.setDate(prevAnchor.getDate() - 7);
    const prevDays: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(prevAnchor);
      d.setDate(d.getDate() - i);
      prevDays.push(toDateStr(d));
    }
    const prevSummaries = await Promise.all(
      prevDays.map((d) => {
        const { start } = dayBounds(d);
        return DailySummary.findOne({ userId, date: start }).lean();
      })
    );
    const prevTotals = prevSummaries.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + (s?.totalSales ?? 0),
        netProfit:  acc.netProfit  + (s?.netProfit  ?? 0),
      }),
      { totalSales: 0, netProfit: 0 }
    );

    const salesCount = summaries.reduce((s, x) => s + (x?.salesCount ?? 0), 0);
    const paymentBreakdown = sumPaymentBreakdowns(summaries as never);

    return {
      ...totals,
      profitMargin: totals.totalSales > 0 ? Math.round((totals.netProfit / totals.totalSales) * 1000) / 10 : 0,
      expenseBreakdown,
      topProducts,
      totalOutstandingCredits,
      salesCount,
      avgSaleValue: salesCount > 0 ? Math.round(totals.totalSales / salesCount) : 0,
      paymentBreakdown,
      salesGrowthPercent:  growthPct(totals.totalSales, prevTotals.totalSales),
      profitGrowthPercent: growthPct(totals.netProfit,  prevTotals.netProfit),
      days: days.map((date, i) => ({
        date,
        label: new Date(date).toLocaleDateString("en-NG", { weekday: "short" }),
        totalSales: summaries[i]?.totalSales ?? 0,
        netProfit: summaries[i]?.netProfit ?? 0,
        totalExpenses: summaries[i]?.totalExpenses ?? 0,
      })),
    };
  },

  async getMonthly(userId: string, year: number, month: number) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }

    const today = toDateStr(new Date());
    const [summaries, totalOutstandingCredits] = await Promise.all([
      Promise.all(days.map((d) => {
        if (d === today) return this.computeAndSaveDaily(userId, d);
        return (async () => {
          const { start } = dayBounds(d);
          const cached = await DailySummary.findOne({ userId, date: start });
          return cached ?? this.computeAndSaveDaily(userId, d);
        })();
      })),
      this.getOutstandingCredits(userId),
    ]);

    const totals = summaries.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + (s?.totalSales ?? 0),
        totalExpenses: acc.totalExpenses + (s?.totalExpenses ?? 0),
        grossProfit: acc.grossProfit + (s?.grossProfit ?? 0),
        netProfit: acc.netProfit + (s?.netProfit ?? 0),
        totalCostOfGoods: acc.totalCostOfGoods + (s?.totalCostOfGoods ?? 0),
        creditGiven: acc.creditGiven + (s?.creditGiven ?? 0),
        creditCollected: acc.creditCollected + (s?.creditCollected ?? 0),
      }),
      { totalSales: 0, totalExpenses: 0, grossProfit: 0, netProfit: 0, totalCostOfGoods: 0, creditGiven: 0, creditCollected: 0 }
    );

    const expenseBreakdown = summaries.reduce(
      (acc, s) => {
        if (!s?.expenseBreakdown) return acc;
        return {
          stock_purchase: acc.stock_purchase + s.expenseBreakdown.stock_purchase,
          transportation: acc.transportation + s.expenseBreakdown.transportation,
          market_levy: acc.market_levy + s.expenseBreakdown.market_levy,
          labor: acc.labor + s.expenseBreakdown.labor,
          utilities: acc.utilities + s.expenseBreakdown.utilities,
          other: acc.other + s.expenseBreakdown.other,
        };
      },
      { stock_purchase: 0, transportation: 0, market_levy: 0, labor: 0, utilities: 0, other: 0 }
    );

    const weeks = [0, 1, 2, 3].map((w) => {
      const weekDays = summaries.slice(w * 7, w * 7 + 7);
      return {
        label: `Wk ${w + 1}`,
        totalSales: weekDays.reduce((s, x) => s + (x?.totalSales ?? 0), 0),
        netProfit: weekDays.reduce((s, x) => s + (x?.netProfit ?? 0), 0),
      };
    });

    const productMap: Record<string, number> = {};
    for (const s of summaries) {
      if (s?.bestProduct?.name) {
        productMap[s.bestProduct.name] = (productMap[s.bestProduct.name] || 0) + s.bestProduct.amount;
      }
    }
    const topProducts = Object.entries(productMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({ name, amount }));

    // Previous month totals for growth comparison
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
    const prevDays: string[] = [];
    for (let d = 1; d <= prevDaysInMonth; d++) {
      prevDays.push(`${prevYear}-${String(prevMonth).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    const prevSummaries = await Promise.all(
      prevDays.map((d) => {
        const { start } = dayBounds(d);
        return DailySummary.findOne({ userId, date: start }).lean();
      })
    );
    const prevTotals = prevSummaries.reduce(
      (acc, s) => ({
        totalSales: acc.totalSales + (s?.totalSales ?? 0),
        netProfit:  acc.netProfit  + (s?.netProfit  ?? 0),
      }),
      { totalSales: 0, netProfit: 0 }
    );

    const salesCount = summaries.reduce((s, x) => s + (x?.salesCount ?? 0), 0);
    const paymentBreakdown = sumPaymentBreakdowns(summaries as never);

    return {
      ...totals,
      profitMargin: totals.totalSales > 0 ? Math.round((totals.netProfit / totals.totalSales) * 1000) / 10 : 0,
      expenseBreakdown,
      topProducts,
      totalOutstandingCredits,
      salesCount,
      avgSaleValue: salesCount > 0 ? Math.round(totals.totalSales / salesCount) : 0,
      paymentBreakdown,
      salesGrowthPercent:  growthPct(totals.totalSales, prevTotals.totalSales),
      profitGrowthPercent: growthPct(totals.netProfit,  prevTotals.netProfit),
      weeks,
    };
  },
};
