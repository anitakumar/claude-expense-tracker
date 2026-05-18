'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Expense, Category } from '@/types/expense';
import { CATEGORIES, CATEGORY_ICONS, CATEGORY_BG } from '@/constants/categories';
import { formatDate, formatCurrency, todayISO } from '@/utils/formatting';
import { exportAsCSV, exportAsJSON, exportAsPDF } from '@/utils/exportAdvanced';
import { cn } from '@/utils/cn';

type ExportFormat = 'csv' | 'json' | 'pdf';

interface ExportModalProps {
  expenses: Expense[];
  onClose: () => void;
}

const FORMAT_META: Record<ExportFormat, { label: string; ext: string; icon: React.ReactNode; description: string }> = {
  csv: {
    label: 'CSV',
    ext: '.csv',
    description: 'Spreadsheet-compatible, great for Excel or Google Sheets',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
  json: {
    label: 'JSON',
    ext: '.json',
    description: 'Structured data format, ideal for developers and APIs',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    ),
  },
  pdf: {
    label: 'PDF',
    ext: '.pdf',
    description: 'Formatted report, perfect for printing or sharing',
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
};

function defaultFilename() {
  return `expenses-${new Date().toISOString().slice(0, 10)}`;
}

export function ExportModal({ expenses, onClose }: ExportModalProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState(todayISO());
  const [selectedCategories, setSelectedCategories] = useState<Set<Category>>(new Set(CATEGORIES));
  const [filename, setFilename] = useState(defaultFilename);
  const [isExporting, setIsExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (!selectedCategories.has(e.category)) return false;
      if (dateFrom && e.date < dateFrom) return false;
      if (dateTo && e.date > dateTo) return false;
      return true;
    }).sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, selectedCategories, dateFrom, dateTo]);

  const totalAmount = useMemo(
    () => filteredExpenses.reduce((s, e) => s + e.amount, 0),
    [filteredExpenses]
  );

  const toggleCategory = useCallback((cat: Category) => {
    setSelectedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const toggleAllCategories = useCallback(() => {
    setSelectedCategories((prev) =>
      prev.size === CATEGORIES.length ? new Set() : new Set(CATEGORIES)
    );
  }, []);

  async function handleExport() {
    if (filteredExpenses.length === 0) return;
    setIsExporting(true);
    setExportDone(false);
    try {
      const name = filename.trim() || defaultFilename();
      if (format === 'csv') exportAsCSV(filteredExpenses, name);
      else if (format === 'json') exportAsJSON(filteredExpenses, name);
      else await exportAsPDF(filteredExpenses, name);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 2500);
    } finally {
      setIsExporting(false);
    }
  }

  const allSelected = selectedCategories.size === CATEGORIES.length;
  const noneSelected = selectedCategories.size === 0;
  const canExport = filteredExpenses.length > 0 && !isExporting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative flex w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Export Expenses</h2>
            <p className="text-sm text-gray-500">Choose format, apply filters, and preview before downloading</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

          {/* Format selector */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Export Format
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(FORMAT_META) as [ExportFormat, typeof FORMAT_META[ExportFormat]][]).map(
                ([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setFormat(key)}
                    className={cn(
                      'flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all',
                      format === key
                        ? 'border-violet-500 bg-violet-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <div className={cn('rounded-lg p-2', format === key ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-500')}>
                      {meta.icon}
                    </div>
                    <div>
                      <div className={cn('font-semibold', format === key ? 'text-violet-700' : 'text-gray-800')}>
                        {meta.label}
                        <span className="ml-1 text-xs font-normal opacity-60">{meta.ext}</span>
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">{meta.description}</div>
                    </div>
                  </button>
                )
              )}
            </div>
          </section>

          {/* Filters */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Filters
            </h3>
            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              {/* Date range */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Date Range</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-gray-500">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      max={dateTo || todayISO()}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div className="mt-5 text-gray-400">→</div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs text-gray-500">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      min={dateFrom}
                      max={todayISO()}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  {(dateFrom || dateTo !== todayISO()) && (
                    <button
                      onClick={() => { setDateFrom(''); setDateTo(todayISO()); }}
                      className="mt-5 text-xs text-violet-600 hover:underline shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Category filter */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-700">Categories</label>
                  <button
                    onClick={toggleAllCategories}
                    className="text-xs text-violet-600 hover:underline"
                  >
                    {allSelected ? 'Deselect all' : 'Select all'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => {
                    const active = selectedCategories.has(cat);
                    return (
                      <button
                        key={cat}
                        onClick={() => toggleCategory(cat)}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                          active
                            ? CATEGORY_BG[cat]
                            : 'bg-gray-100 text-gray-400 line-through'
                        )}
                      >
                        <span>{CATEGORY_ICONS[cat]}</span>
                        {cat}
                        {active && (
                          <span className="text-current opacity-60">
                            ({expenses.filter((e) => e.category === cat).length})
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {noneSelected && (
                  <p className="mt-2 text-xs text-red-500">Select at least one category to export.</p>
                )}
              </div>
            </div>
          </section>

          {/* Filename */}
          <section>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              Filename
            </h3>
            <div className="flex items-center gap-0">
              <input
                type="text"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder={defaultFilename()}
                className="flex-1 rounded-l-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <span className="rounded-r-lg border border-l-0 border-gray-300 bg-gray-50 px-3 py-2.5 text-sm text-gray-500">
                {FORMAT_META[format].ext}
              </span>
            </div>
          </section>

          {/* Preview */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Preview
              </h3>
              <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                {filteredExpenses.length} record{filteredExpenses.length !== 1 ? 's' : ''}
              </span>
            </div>

            {filteredExpenses.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-10 text-gray-400">
                <svg className="mb-2 h-8 w-8 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm">No records match the current filters</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                <div className="max-h-52 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Date</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Category</th>
                        <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Description</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredExpenses.slice(0, 50).map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{formatDate(e.date)}</td>
                          <td className="px-4 py-2.5">
                            <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', CATEGORY_BG[e.category])}>
                              {CATEGORY_ICONS[e.category]} {e.category}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-700 max-w-[200px] truncate">{e.description}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-gray-900">{formatCurrency(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredExpenses.length > 50 && (
                    <div className="border-t border-gray-100 px-4 py-2 text-center text-xs text-gray-400">
                      Showing 50 of {filteredExpenses.length} records in preview — all will be exported
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 shrink-0">
          <div className="text-sm text-gray-600">
            {filteredExpenses.length > 0 ? (
              <>
                <span className="font-semibold text-gray-900">{filteredExpenses.length}</span> record{filteredExpenses.length !== 1 ? 's' : ''} &nbsp;·&nbsp; Total{' '}
                <span className="font-semibold text-violet-700">{formatCurrency(totalAmount)}</span>
              </>
            ) : (
              <span className="text-gray-400">No records to export</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!canExport || noneSelected}
              className={cn(
                'inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all',
                exportDone
                  ? 'bg-green-500'
                  : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isExporting ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Exporting…
                </>
              ) : exportDone ? (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Exported!
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export {FORMAT_META[format].label}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
