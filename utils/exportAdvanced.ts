import { Expense } from '@/types/expense';
import { formatDate, formatCurrency } from './formatting';

function buildRows(expenses: Expense[]) {
  return expenses.map((e) => [
    formatDate(e.date),
    e.category,
    e.description,
    formatCurrency(e.amount),
  ]);
}

export function exportAsCSV(expenses: Expense[], filename: string): void {
  const headers = ['Date', 'Category', 'Description', 'Amount'];
  const rows = expenses.map((e) => [
    formatDate(e.date),
    e.category,
    `"${e.description.replace(/"/g, '""')}"`,
    e.amount.toFixed(2),
  ]);
  const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `${filename}.csv`);
}

export function exportAsJSON(expenses: Expense[], filename: string): void {
  const data = expenses.map((e) => ({
    date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
  }));
  const json = JSON.stringify(data, null, 2);
  triggerDownload(new Blob([json], { type: 'application/json' }), `${filename}.json`);
}

export async function exportAsPDF(expenses: Expense[], filename: string): Promise<void> {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(20);
  doc.setTextColor(109, 40, 217); // violet-700
  doc.text('SpendWise', 14, 18);

  doc.setFontSize(12);
  doc.setTextColor(55, 65, 81); // gray-700
  doc.text('Expense Report', 14, 26);

  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128); // gray-500
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 14, 32);
  doc.text(`${expenses.length} record${expenses.length !== 1 ? 's' : ''}`, 14, 38);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  doc.setFontSize(10);
  doc.setTextColor(55, 65, 81);
  doc.text(`Total: ${formatCurrency(total)}`, doc.internal.pageSize.width - 14, 38, { align: 'right' });

  autoTable(doc, {
    head: [['Date', 'Category', 'Description', 'Amount']],
    body: buildRows(expenses),
    startY: 44,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: {
      fillColor: [109, 40, 217],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [245, 243, 255] }, // violet-50
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 32 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 35, halign: 'right' },
    },
  });

  doc.save(`${filename}.pdf`);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
