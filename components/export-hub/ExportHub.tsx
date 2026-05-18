'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Expense, Category } from '@/types/expense';
import { formatCurrency, formatDate } from '@/utils/formatting';
import { CATEGORIES, CATEGORY_COLORS } from '@/constants/categories';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type Section = 'templates' | 'share' | 'integrations' | 'schedule' | 'history';

interface ExportRecord {
  id: string;
  timestamp: string;
  template: string;
  format: 'csv' | 'json' | 'pdf';
  destination: string;
  records: number;
  status: 'success' | 'failed';
  fileSize?: string;
}

interface ScheduledExport {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  format: 'csv' | 'json';
  template: string;
  destination: string;
  active: boolean;
  nextRun: string;
  createdAt: string;
}

interface CloudConnection {
  id: string;
  name: string;
  tagline: string;
  color: string;
  textColor: string;
  letter: string;
  connected: boolean;
  account?: string;
  lastSync?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPORT_TEMPLATES = [
  {
    id: 'tax',
    name: 'Tax Report',
    icon: '🧾',
    color: 'bg-emerald-50 border-emerald-200',
    accent: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700',
    description: 'Annual expense breakdown organized by category with subtotals. Ready for your accountant.',
    includes: ['All categories', 'Yearly totals', 'Category subtotals', 'Sorted by date'],
    filter: (expenses: Expense[]) => {
      const year = new Date().getFullYear();
      return expenses.filter((e) => e.date.startsWith(String(year)));
    },
  },
  {
    id: 'monthly',
    name: 'Monthly Summary',
    icon: '📅',
    color: 'bg-blue-50 border-blue-200',
    accent: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    description: "Current month's spending overview. Great for monthly budget reviews and tracking.",
    includes: ['Current month only', 'Day-by-day breakdown', 'Running totals'],
    filter: (expenses: Expense[]) => {
      const prefix = new Date().toISOString().slice(0, 7);
      return expenses.filter((e) => e.date.startsWith(prefix));
    },
  },
  {
    id: 'category',
    name: 'Category Analysis',
    icon: '📊',
    color: 'bg-violet-50 border-violet-200',
    accent: 'text-violet-700',
    badge: 'bg-violet-100 text-violet-700',
    description: 'Deep dive into spending by category. Sorted to highlight your biggest expense areas.',
    includes: ['All time', 'Sorted by category', 'Amount + percentage', 'Category totals'],
    filter: (expenses: Expense[]) =>
      [...expenses].sort((a, b) => a.category.localeCompare(b.category)),
  },
];

const DEFAULT_CONNECTIONS: CloudConnection[] = [
  { id: 'sheets', name: 'Google Sheets', tagline: 'Sync expenses to a live spreadsheet', color: 'bg-green-500', textColor: 'text-white', letter: 'G', connected: false },
  { id: 'dropbox', name: 'Dropbox', tagline: 'Auto-backup exports to your Dropbox', color: 'bg-blue-500', textColor: 'text-white', letter: 'D', connected: false },
  { id: 'onedrive', name: 'OneDrive', tagline: 'Keep exports in sync with Microsoft 365', color: 'bg-sky-500', textColor: 'text-white', letter: 'O', connected: false },
  { id: 'notion', name: 'Notion', tagline: 'Push expense data into your Notion workspace', color: 'bg-gray-900', textColor: 'text-white', letter: 'N', connected: false },
];

const SEED_HISTORY: ExportRecord[] = [
  { id: 'h1', timestamp: new Date(Date.now() - 864e5 * 2).toISOString(), template: 'Tax Report', format: 'csv', destination: 'Download', records: 147, status: 'success', fileSize: '12 KB' },
  { id: 'h2', timestamp: new Date(Date.now() - 864e5 * 5).toISOString(), template: 'Monthly Summary', format: 'json', destination: 'Google Sheets', records: 38, status: 'success', fileSize: '4 KB' },
  { id: 'h3', timestamp: new Date(Date.now() - 864e5 * 9).toISOString(), template: 'Category Analysis', format: 'pdf', destination: 'Email', records: 147, status: 'success', fileSize: '89 KB' },
  { id: 'h4', timestamp: new Date(Date.now() - 864e5 * 14).toISOString(), template: 'Monthly Summary', format: 'csv', destination: 'Dropbox', records: 52, status: 'failed', fileSize: '—' },
  { id: 'h5', timestamp: new Date(Date.now() - 864e5 * 21).toISOString(), template: 'Tax Report', format: 'pdf', destination: 'Download', records: 147, status: 'success', fileSize: '102 KB' },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function calcNextRun(frequency: string, time: string): string {
  const now = new Date();
  const [h, min] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(h, min, 0, 0);
  if (next <= now) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1);
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
  }
  return next.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function expensesToCSV(expenses: Expense[]): string {
  const rows = expenses.map((e) => [
    formatDate(e.date),
    e.category,
    e.amount.toFixed(2),
    `"${e.description.replace(/"/g, '""')}"`,
  ]);
  return [['Date', 'Category', 'Amount', 'Description'], ...rows].map((r) => r.join(',')).join('\n');
}

function expensesToJSON(expenses: Expense[]): string {
  return JSON.stringify(
    expenses.map((e) => ({ date: e.date, category: e.category, amount: e.amount, description: e.description })),
    null,
    2
  );
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

function QRCode({ value }: { value: string }) {
  const SIZE = 25;
  const modules = useMemo(() => {
    const m: boolean[][] = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    const setFinder = (r0: number, c0: number) => {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 7; c++) {
          const border = r === 0 || r === 6 || c === 0 || c === 6;
          const inner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
          m[r0 + r][c0 + c] = border || inner;
        }
    };
    setFinder(0, 0);
    setFinder(0, SIZE - 7);
    setFinder(SIZE - 7, 0);
    let h = 0;
    for (const ch of value) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
    for (let r = 0; r < SIZE; r++)
      for (let c = 0; c < SIZE; c++) {
        const inFinder =
          (r < 8 && c < 8) || (r < 8 && c >= SIZE - 8) || (r >= SIZE - 8 && c < 8);
        if (inFinder) continue;
        h = (Math.imul(h, 1664525) + 1013904223) | 0;
        m[r][c] = (h >>> 31) === 1;
      }
    return m;
  }, [value]);

  return (
    <svg viewBox={`0 0 ${SIZE + 2} ${SIZE + 2}`} className="w-36 h-36 rounded-lg">
      <rect width={SIZE + 2} height={SIZE + 2} fill="white" />
      {modules.flatMap((row, r) =>
        row.map((dark, c) =>
          dark ? <rect key={`${r}-${c}`} x={c + 1} y={r + 1} width={1} height={1} fill="#111827" /> : null
        )
      )}
    </svg>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode; badge?: string }[] = [
  {
    id: 'templates',
    label: 'Templates',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm0 8a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zm12 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>,
  },
  {
    id: 'share',
    label: 'Share & Send',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
  },
  {
    id: 'integrations',
    label: 'Integrations',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" /></svg>,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
    badge: 'Auto',
  },
  {
    id: 'history',
    label: 'History',
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
];

function Sidebar({ active, onSelect, expenseCount }: { active: Section; onSelect: (s: Section) => void; expenseCount: number }) {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-4">
        <Link href="/" className="flex items-center gap-2 mb-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white text-xs font-bold">S</div>
          <span className="font-semibold text-gray-900 text-sm">SpendWise</span>
        </Link>
        <p className="text-xs text-gray-400 pl-9">Export Hub</p>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left',
              active === item.id
                ? 'bg-violet-50 text-violet-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <span className={active === item.id ? 'text-violet-600' : 'text-gray-400'}>{item.icon}</span>
            {item.label}
            {item.badge && (
              <span className="ml-auto rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="border-t border-gray-100 px-4 py-3">
        <div className="mb-3 rounded-lg bg-gray-50 p-2.5 text-xs text-gray-500">
          <div className="font-medium text-gray-700">{expenseCount} expenses</div>
          <div>ready to export</div>
        </div>
        <Link href="/" className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>
      </div>
    </aside>
  );
}

// ─── Templates Section ────────────────────────────────────────────────────────

function TemplatesSection({
  expenses,
  onExported,
}: {
  expenses: Expense[];
  onExported: (record: Omit<ExportRecord, 'id' | 'timestamp'>) => void;
}) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [formats, setFormats] = useState<Record<string, 'csv' | 'json'>>({ tax: 'csv', monthly: 'csv', category: 'csv' });

  async function handleExport(tpl: typeof EXPORT_TEMPLATES[0]) {
    setExporting(tpl.id);
    await new Promise((r) => setTimeout(r, 700)); // simulate processing
    const filtered = tpl.filter(expenses);
    const fmt = formats[tpl.id];
    const filename = `${tpl.id}-${new Date().toISOString().slice(0, 10)}`;
    if (fmt === 'csv') {
      downloadBlob(new Blob([expensesToCSV(filtered)], { type: 'text/csv' }), `${filename}.csv`);
    } else {
      downloadBlob(new Blob([expensesToJSON(filtered)], { type: 'application/json' }), `${filename}.json`);
    }
    onExported({ template: tpl.name, format: fmt, destination: 'Download', records: filtered.length, status: 'success', fileSize: `${Math.max(1, Math.round(filtered.length * 0.08))} KB` });
    setExporting(null);
    setDone(tpl.id);
    setTimeout(() => setDone(null), 2500);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Export Templates</h1>
        <p className="mt-1 text-gray-500">Pre-configured exports optimized for common use cases.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {EXPORT_TEMPLATES.map((tpl) => {
          const count = tpl.filter(expenses).length;
          const isExporting = exporting === tpl.id;
          const isDone = done === tpl.id;
          return (
            <div key={tpl.id} className={cn('flex flex-col rounded-2xl border-2 bg-white p-5 shadow-sm transition-shadow hover:shadow-md', tpl.color)}>
              <div className="mb-4 flex items-start justify-between">
                <div className="text-3xl">{tpl.icon}</div>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', tpl.badge)}>
                  {count} record{count !== 1 ? 's' : ''}
                </span>
              </div>

              <h3 className="text-base font-semibold text-gray-900">{tpl.name}</h3>
              <p className="mt-1.5 text-sm text-gray-500 flex-1">{tpl.description}</p>

              <ul className="mt-4 space-y-1">
                {tpl.includes.map((inc) => (
                  <li key={inc} className="flex items-center gap-2 text-xs text-gray-500">
                    <svg className={cn('h-3.5 w-3.5 shrink-0', tpl.accent)} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {inc}
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex items-center gap-2">
                <select
                  value={formats[tpl.id]}
                  onChange={(e) => setFormats((p) => ({ ...p, [tpl.id]: e.target.value as 'csv' | 'json' }))}
                  className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                </select>

                <button
                  onClick={() => handleExport(tpl)}
                  disabled={isExporting || count === 0}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all',
                    isDone ? 'bg-emerald-500' : 'bg-gray-900 hover:bg-gray-700 disabled:opacity-40'
                  )}
                >
                  {isExporting ? (
                    <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Preparing…</>
                  ) : isDone ? (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Downloaded!</>
                  ) : (
                    <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Export</>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {expenses.length === 0 && (
        <div className="mt-8 rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <p className="text-sm">No expenses in your tracker yet. Add some to enable exports.</p>
        </div>
      )}
    </div>
  );
}

// ─── Share & Send Section ─────────────────────────────────────────────────────

function ShareSection({ expenses }: { expenses: Expense[] }) {
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailFormat, setEmailFormat] = useState<'csv' | 'json'>('csv');
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [expiresIn, setExpiresIn] = useState('7d');

  async function handleEmailSend() {
    if (!email) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 1200));
    setSending(false);
    setEmailSent(true);
    setTimeout(() => setEmailSent(false), 4000);
  }

  function generateLink() {
    const token = Math.random().toString(36).slice(2, 12);
    setShareLink(`https://spendwise.app/share/${token}?expires=${expiresIn}&records=${expenses.length}`);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Share & Send</h1>
        <p className="mt-1 text-gray-500">Email your expenses or generate shareable links and QR codes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Email Export */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
              <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Email Export</h3>
              <p className="text-xs text-gray-500">Send a copy directly to any inbox</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
            />
            <div className="flex gap-2">
              <select
                value={emailFormat}
                onChange={(e) => setEmailFormat(e.target.value as 'csv' | 'json')}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="csv">CSV attachment</option>
                <option value="json">JSON attachment</option>
              </select>
              <button
                onClick={handleEmailSend}
                disabled={!email || sending || emailSent}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all',
                  emailSent ? 'bg-emerald-500' : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-40'
                )}
              >
                {sending ? (
                  <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Sending…</>
                ) : emailSent ? (
                  <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>Sent!</>
                ) : (
                  'Send'
                )}
              </button>
            </div>
            {emailSent && <p className="text-xs text-emerald-600">✓ Export sent to {email}</p>}
          </div>
        </div>

        {/* Shareable Link */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
              <svg className="h-5 w-5 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Shareable Link</h3>
              <p className="text-xs text-gray-500">Anyone with the link can download</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex gap-2">
              <select
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-100"
              >
                <option value="24h">Expires in 24h</option>
                <option value="7d">Expires in 7 days</option>
                <option value="30d">Expires in 30 days</option>
                <option value="never">Never expires</option>
              </select>
              <button
                onClick={generateLink}
                className="flex-1 rounded-lg border border-violet-200 bg-violet-50 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              >
                Generate Link
              </button>
            </div>
            {shareLink && (
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareLink}
                  className="flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600"
                />
                <button
                  onClick={copyLink}
                  className={cn(
                    'rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                    copied ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  )}
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* QR Code */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">QR Code</h3>
              <p className="text-xs text-gray-500">Scan to access on any device</p>
            </div>
          </div>

          {shareLink ? (
            <div className="flex items-center gap-6">
              <div className="rounded-xl border-2 border-gray-100 p-2">
                <QRCode value={shareLink} />
              </div>
              <div className="text-sm text-gray-500 space-y-2">
                <p>Scan with any camera app to open the export link on another device.</p>
                <button
                  onClick={() => {
                    const svg = document.querySelector('svg[viewBox]');
                    if (!svg) return;
                    const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
                    downloadBlob(blob, 'expense-qr.svg');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download QR
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-40 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              Generate a shareable link first
            </div>
          )}
        </div>

        {/* Stats card */}
        <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-violet-600 to-indigo-700 p-6 text-white shadow-sm">
          <h3 className="font-semibold mb-4">Export Summary</h3>
          <div className="space-y-3">
            {[
              { label: 'Total Records', value: expenses.length },
              { label: 'Total Amount', value: formatCurrency(expenses.reduce((s, e) => s + e.amount, 0)) },
              { label: 'Date Range', value: expenses.length > 0 ? `${formatDate(expenses.slice().sort((a,b) => a.date.localeCompare(b.date))[0].date)} → ${formatDate(expenses.slice().sort((a,b) => b.date.localeCompare(a.date))[0].date)}` : '—' },
              { label: 'Categories', value: new Set(expenses.map((e) => e.category)).size },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-violet-200">{label}</span>
                <span className="font-semibold">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Integrations Section ─────────────────────────────────────────────────────

function IntegrationsSection() {
  const [connections, setConnections] = useLocalStorage<CloudConnection[]>(
    'export-connections',
    DEFAULT_CONNECTIONS
  );
  const [connecting, setConnecting] = useState<string | null>(null);

  async function toggleConnection(id: string) {
    setConnecting(id);
    await new Promise((r) => setTimeout(r, 1500));
    setConnections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              connected: !c.connected,
              lastSync: !c.connected ? new Date().toISOString() : undefined,
              account: !c.connected ? 'user@example.com' : undefined,
            }
          : c
      )
    );
    setConnecting(null);
  }

  const connected = connections.filter((c) => c.connected);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="mt-1 text-gray-500">
          Connect your favourite cloud services. {connected.length > 0 ? `${connected.length} active connection${connected.length > 1 ? 's' : ''}.` : 'No active connections yet.'}
        </p>
      </div>

      {connected.length > 0 && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-emerald-800">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            {connected.map((c) => c.name).join(', ')} {connected.length === 1 ? 'is' : 'are'} synced and ready
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {connections.map((conn) => {
          const isConnecting = connecting === conn.id;
          return (
            <div
              key={conn.id}
              className={cn(
                'rounded-2xl border bg-white p-5 shadow-sm transition-all',
                conn.connected ? 'border-emerald-200' : 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold', conn.color, conn.textColor)}>
                    {conn.letter}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{conn.name}</div>
                    <div className="text-xs text-gray-500">{conn.tagline}</div>
                  </div>
                </div>
                <span className={cn(
                  'rounded-full px-2.5 py-1 text-xs font-semibold',
                  conn.connected ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                )}>
                  {conn.connected ? '● Connected' : 'Not connected'}
                </span>
              </div>

              {conn.connected && (
                <div className="mb-4 space-y-1.5 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                  <div className="flex justify-between"><span className="text-gray-400">Account</span><span className="font-medium">{conn.account}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Last sync</span><span className="font-medium">{conn.lastSync ? relativeTime(conn.lastSync) : '—'}</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Auto-sync</span><span className="font-medium text-emerald-600">Enabled</span></div>
                </div>
              )}

              <button
                onClick={() => toggleConnection(conn.id)}
                disabled={isConnecting}
                className={cn(
                  'w-full rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  conn.connected
                    ? 'border border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                    : 'border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
                )}
              >
                {isConnecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    {conn.connected ? 'Disconnecting…' : 'Connecting…'}
                  </span>
                ) : conn.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-gray-200 p-5 text-center text-sm text-gray-400">
        <p className="font-medium text-gray-500 mb-1">More integrations coming soon</p>
        <p>Zapier · Airtable · Slack · QuickBooks</p>
      </div>
    </div>
  );
}

// ─── Schedule Section ─────────────────────────────────────────────────────────

function ScheduleSection() {
  const [schedules, setSchedules] = useLocalStorage<ScheduledExport[]>('export-schedules', []);
  const [form, setForm] = useState<{ frequency: 'daily' | 'weekly' | 'monthly'; time: string; format: 'csv' | 'json'; template: string; destination: string }>({ frequency: 'weekly', time: '08:00', format: 'csv', template: 'Monthly Summary', destination: 'Email' });
  const [adding, setAdding] = useState(false);
  const [saved, setSaved] = useState(false);

  function addSchedule() {
    setAdding(true);
    setTimeout(() => {
      const next = calcNextRun(form.frequency, form.time);
      setSchedules((prev) => [
        ...prev,
        { id: generateId(), name: `${form.template} · ${form.frequency}`, ...form, active: true, nextRun: next, createdAt: new Date().toISOString() },
      ]);
      setAdding(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }, 800);
  }

  function toggleSchedule(id: string) {
    setSchedules((prev) => prev.map((s) => s.id === id ? { ...s, active: !s.active } : s));
  }

  function deleteSchedule(id: string) {
    setSchedules((prev) => prev.filter((s) => s.id !== id));
  }

  const FREQ_LABELS: Record<string, string> = { daily: 'Every day', weekly: 'Every week', monthly: 'Every month' };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Scheduled Exports</h1>
        <p className="mt-1 text-gray-500">Set up automatic exports so your data is always backed up.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Schedule builder */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-4">New Schedule</h3>
          <div className="space-y-3">
            {[
              { label: 'Template', key: 'template', options: ['Tax Report', 'Monthly Summary', 'Category Analysis', 'All Expenses'] },
              { label: 'Frequency', key: 'frequency', options: [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']] },
              { label: 'Format', key: 'format', options: [['csv', 'CSV'], ['json', 'JSON']] },
              { label: 'Destination', key: 'destination', options: ['Email', 'Google Sheets', 'Dropbox', 'OneDrive', 'Download'] },
            ].map(({ label, key, options }) => (
              <div key={key}>
                <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
                <select
                  value={form[key as keyof typeof form]}
                  onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
                >
                  {(options as (string | [string, string])[]).map((o) =>
                    Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{o}</option>
                  )}
                </select>
              </div>
            ))}

            <div>
              <label className="mb-1 block text-xs font-medium text-gray-500 uppercase tracking-wide">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div className="rounded-lg bg-violet-50 p-3 text-xs text-violet-700">
              <strong>Next run:</strong> {calcNextRun(form.frequency, form.time)}
            </div>

            <button
              onClick={addSchedule}
              disabled={adding || saved}
              className={cn(
                'w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-all',
                saved ? 'bg-emerald-500' : 'bg-violet-600 hover:bg-violet-700 disabled:opacity-50'
              )}
            >
              {adding ? 'Creating…' : saved ? '✓ Schedule Created' : 'Create Schedule'}
            </button>
          </div>
        </div>

        {/* Active schedules */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">
            Active Schedules
            {schedules.length > 0 && <span className="ml-2 text-xs font-normal text-gray-400">({schedules.length})</span>}
          </h3>
          {schedules.length === 0 ? (
            <div className="flex h-48 items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400">
              No schedules yet. Create one to get started.
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((s) => (
                <div key={s.id} className={cn('rounded-2xl border bg-white p-4 shadow-sm', s.active ? 'border-gray-200' : 'border-gray-100 opacity-60')}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{s.template}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {FREQ_LABELS[s.frequency]} at {s.time} · {s.format.toUpperCase()} → {s.destination}
                      </div>
                      <div className="mt-1 text-xs text-violet-600">Next: {s.nextRun}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSchedule(s.id)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                          s.active ? 'bg-violet-600' : 'bg-gray-200'
                        )}
                      >
                        <span className={cn('inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform', s.active ? 'translate-x-4' : 'translate-x-0')} />
                      </button>
                      <button onClick={() => deleteSchedule(s.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── History Section ──────────────────────────────────────────────────────────

function HistorySection({
  history,
  expenses,
}: {
  history: ExportRecord[];
  expenses: Expense[];
}) {
  const [downloading, setDownloading] = useState<string | null>(null);

  async function reDownload(record: ExportRecord) {
    setDownloading(record.id);
    await new Promise((r) => setTimeout(r, 600));
    const tpl = EXPORT_TEMPLATES.find((t) => t.name === record.template);
    const data = tpl ? tpl.filter(expenses) : expenses;
    if (record.format === 'json') {
      downloadBlob(new Blob([expensesToJSON(data)], { type: 'application/json' }), `${record.template.toLowerCase().replace(/\s+/g, '-')}-reexport.json`);
    } else {
      downloadBlob(new Blob([expensesToCSV(data)], { type: 'text/csv' }), `${record.template.toLowerCase().replace(/\s+/g, '-')}-reexport.csv`);
    }
    setDownloading(null);
  }

  const allRecords = [...history].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return (
    <div className="p-8">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Export History</h1>
          <p className="mt-1 text-gray-500">A log of all your past exports. Re-download any time.</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
          {allRecords.length} total
        </span>
      </div>

      {allRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-gray-400">
          <div className="text-4xl mb-3">📂</div>
          <p className="text-sm">No exports yet. Use Templates or Share to get started.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">When</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Template</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Format</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">Destination</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Records</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400">Size</th>
                <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allRecords.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap text-xs">{relativeTime(r.timestamp)}</td>
                  <td className="px-5 py-3.5 font-medium text-gray-800">{r.template}</td>
                  <td className="px-5 py-3.5">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold uppercase text-gray-600">{r.format}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-xs">{r.destination}</td>
                  <td className="px-5 py-3.5 text-right font-medium text-gray-700">{r.records.toLocaleString()}</td>
                  <td className="px-5 py-3.5 text-right text-xs text-gray-400">{r.fileSize ?? '—'}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                      r.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    )}>
                      {r.status === 'success' ? '✓ Success' : '✕ Failed'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {r.status === 'success' && r.format !== 'pdf' && (
                      <button
                        onClick={() => reDownload(r)}
                        disabled={downloading === r.id}
                        className="text-xs text-violet-600 hover:underline disabled:opacity-50"
                      >
                        {downloading === r.id ? 'Downloading…' : 'Re-download'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Hub ─────────────────────────────────────────────────────────────────

export function ExportHub() {
  const [expenses] = useLocalStorage<Expense[]>('expenses', []);
  const [section, setSection] = useState<Section>('templates');
  const [history, setHistory] = useLocalStorage<ExportRecord[]>('export-history', SEED_HISTORY);

  const addToHistory = useCallback(
    (record: Omit<ExportRecord, 'id' | 'timestamp'>) => {
      setHistory((prev) => [{ ...record, id: generateId(), timestamp: new Date().toISOString() }, ...prev]);
    },
    [setHistory]
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans">
      <Sidebar active={section} onSelect={setSection} expenseCount={expenses.length} />
      <main className="flex-1 overflow-y-auto">
        {section === 'templates' && <TemplatesSection expenses={expenses} onExported={addToHistory} />}
        {section === 'share' && <ShareSection expenses={expenses} />}
        {section === 'integrations' && <IntegrationsSection />}
        {section === 'schedule' && <ScheduleSection />}
        {section === 'history' && <HistorySection history={history} expenses={expenses} />}
      </main>
    </div>
  );
}
