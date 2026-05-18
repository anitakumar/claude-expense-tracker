import { startOfMonth, endOfMonth, parseISO, isWithinInterval, format } from 'date-fns';
import { Expense, CategorySummary, MonthlySummary, FilterState } from '@/types/expense';
import { CATEGORIES } from '@/constants/categories';

export function getTotalSpending(expenses: Expense[]): number {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function getThisMonthExpenses(expenses: Expense[]): Expense[] {
  const now = new Date();
  const start = startOfMonth(now);
  const end = endOfMonth(now);
  return expenses.filter((e) => {
    const d = parseISO(e.date);
    return isWithinInterval(d, { start, end });
  });
}

export function getCategoryBreakdown(expenses: Expense[]): CategorySummary[] {
  const total = getTotalSpending(expenses);
  return CATEGORIES.map((category) => {
    const catExpenses = expenses.filter((e) => e.category === category);
    const catTotal = catExpenses.reduce((sum, e) => sum + e.amount, 0);
    return {
      category,
      total: catTotal,
      count: catExpenses.length,
      percentage: total > 0 ? (catTotal / total) * 100 : 0,
    };
  }).filter((c) => c.count > 0);
}

export function getMonthlyTrend(expenses: Expense[]): MonthlySummary[] {
  const monthMap = new Map<string, number>();
  expenses.forEach((e) => {
    const month = format(parseISO(e.date), 'yyyy-MM');
    monthMap.set(month, (monthMap.get(month) ?? 0) + e.amount);
  });
  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, total]) => ({
      month: format(parseISO(`${month}-01`), 'MMM yy'),
      total,
    }));
}

export function applyFilters(expenses: Expense[], filters: FilterState): Expense[] {
  return expenses.filter((e) => {
    if (filters.category !== 'All' && e.category !== filters.category) return false;
    if (filters.dateFrom && e.date < filters.dateFrom) return false;
    if (filters.dateTo && e.date > filters.dateTo) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!e.description.toLowerCase().includes(q) && !e.category.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });
}
