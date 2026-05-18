'use client';

import { useLocalStorage } from '@/hooks/useLocalStorage';
import { exportToCSV } from '@/utils/export';
import { Expense } from '@/types/expense';

export default function DashboardPage() {
  const [expenses] = useLocalStorage<Expense[]>('expenses', []);

  function handleExport() {
    exportToCSV(expenses);
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Expense Tracker</h1>
        <p className="text-gray-500 mb-8">
          {expenses.length} expense{expenses.length !== 1 ? 's' : ''} recorded
        </p>

        <button
          onClick={handleExport}
          disabled={expenses.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export Data
        </button>

        {expenses.length === 0 && (
          <p className="mt-4 text-sm text-gray-400">
            Add some expenses to enable export.
          </p>
        )}
      </div>
    </main>
  );
}
