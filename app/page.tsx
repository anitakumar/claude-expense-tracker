'use client';

import Link from 'next/link';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Expense } from '@/types/expense';
import { formatCurrency, formatDate } from '@/utils/formatting';
import { CATEGORY_BG, CATEGORY_ICONS } from '@/constants/categories';

export default function DashboardPage() {
  const [expenses] = useLocalStorage<Expense[]>('expenses', []);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const recent = [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">SpendWise</h1>
            <p className="text-sm text-gray-500">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''} · Total {formatCurrency(total)}
            </p>
          </div>
          <Link
            href="/export"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Hub
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-8">
        {expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
            <div className="mb-4 rounded-full bg-violet-50 p-4">
              <svg className="h-8 w-8 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900">No expenses yet</h2>
            <p className="mt-1 text-sm text-gray-500">Add expenses to your tracker, then explore the Export Hub.</p>
            <Link href="/export" className="mt-4 text-sm font-medium text-violet-600 hover:underline">
              Open Export Hub →
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4">
              <h2 className="font-semibold text-gray-800">Recent Expenses</h2>
            </div>
            <ul className="divide-y divide-gray-50">
              {recent.map((e) => (
                <li key={e.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{CATEGORY_ICONS[e.category]}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{e.description}</p>
                      <p className="text-xs text-gray-500">{formatDate(e.date)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_BG[e.category]}`}>
                      {e.category}
                    </span>
                    <span className="font-semibold text-gray-900">{formatCurrency(e.amount)}</span>
                  </div>
                </li>
              ))}
            </ul>
            {expenses.length > 5 && (
              <div className="border-t border-gray-100 px-5 py-3 text-center text-xs text-gray-400">
                Showing 5 most recent · {expenses.length - 5} more in storage
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
