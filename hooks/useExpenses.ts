'use client';

import { useCallback } from 'react';
import { v4 as uuidv4 } from 'crypto';
import { Expense, ExpenseFormData } from '@/types/expense';
import { useLocalStorage } from './useLocalStorage';
import { todayISO } from '@/utils/formatting';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function useExpenses() {
  const [expenses, setExpenses, loaded] = useLocalStorage<Expense[]>('expenses', []);

  const addExpense = useCallback(
    (data: ExpenseFormData) => {
      const expense: Expense = {
        id: generateId(),
        amount: parseFloat(data.amount),
        category: data.category,
        description: data.description.trim(),
        date: data.date,
        createdAt: new Date().toISOString(),
      };
      setExpenses((prev) => [expense, ...prev]);
      return expense;
    },
    [setExpenses]
  );

  const updateExpense = useCallback(
    (id: string, data: ExpenseFormData) => {
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                ...e,
                amount: parseFloat(data.amount),
                category: data.category,
                description: data.description.trim(),
                date: data.date,
              }
            : e
        )
      );
    },
    [setExpenses]
  );

  const deleteExpense = useCallback(
    (id: string) => {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
    },
    [setExpenses]
  );

  const deleteAll = useCallback(() => {
    setExpenses([]);
  }, [setExpenses]);

  return { expenses, addExpense, updateExpense, deleteExpense, deleteAll, loaded };
}
