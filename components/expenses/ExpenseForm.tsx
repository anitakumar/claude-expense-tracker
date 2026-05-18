'use client';

import { useState, useEffect } from 'react';
import { ExpenseFormData, Expense, Category } from '@/types/expense';
import { CATEGORIES, CATEGORY_ICONS } from '@/constants/categories';
import { todayISO } from '@/utils/formatting';
import { Button } from '@/components/ui/Button';

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData) => void;
  onCancel: () => void;
  initialData?: Expense;
}

const EMPTY: ExpenseFormData = {
  amount: '',
  category: 'Food',
  description: '',
  date: todayISO(),
};

interface Errors {
  amount?: string;
  description?: string;
  date?: string;
}

export function ExpenseForm({ onSubmit, onCancel, initialData }: ExpenseFormProps) {
  const [form, setForm] = useState<ExpenseFormData>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setForm({
        amount: initialData.amount.toString(),
        category: initialData.category,
        description: initialData.description,
        date: initialData.date,
      });
    } else {
      setForm({ ...EMPTY, date: todayISO() });
    }
  }, [initialData]);

  function validate(): boolean {
    const e: Errors = {};
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) e.amount = 'Enter a valid positive amount';
    if (amount > 1_000_000) e.amount = 'Amount seems too large';
    if (!form.description.trim()) e.description = 'Description is required';
    if (form.description.trim().length > 200) e.description = 'Max 200 characters';
    if (!form.date) e.date = 'Date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    onSubmit(form);
    setSubmitting(false);
  }

  function field(key: keyof ExpenseFormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Amount */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Amount</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={form.amount}
            onChange={(e) => field('amount', e.target.value)}
            className={`w-full rounded-lg border pl-8 pr-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-violet-500 ${
              errors.amount ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white focus:border-violet-400'
            }`}
          />
        </div>
        {errors.amount && <p className="mt-1 text-xs text-red-500">{errors.amount}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => field('category', cat)}
              className={`flex flex-col items-center gap-1 rounded-lg border p-2.5 text-xs font-medium transition-colors ${
                form.category === cat
                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Description</label>
        <input
          type="text"
          placeholder="What did you spend on?"
          value={form.description}
          onChange={(e) => field('description', e.target.value)}
          maxLength={200}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-violet-500 ${
            errors.description ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white focus:border-violet-400'
          }`}
        />
        {errors.description && <p className="mt-1 text-xs text-red-500">{errors.description}</p>}
      </div>

      {/* Date */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Date</label>
        <input
          type="date"
          value={form.date}
          max={todayISO()}
          onChange={(e) => field('date', e.target.value)}
          className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-violet-500 ${
            errors.date ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white focus:border-violet-400'
          }`}
        />
        {errors.date && <p className="mt-1 text-xs text-red-500">{errors.date}</p>}
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting} className="flex-1">
          {initialData ? 'Save Changes' : 'Add Expense'}
        </Button>
      </div>
    </form>
  );
}
