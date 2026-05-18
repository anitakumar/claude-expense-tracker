import { Category } from '@/types/expense';
import { CATEGORY_BG, CATEGORY_ICONS } from '@/constants/categories';
import { cn } from '@/utils/cn';

interface BadgeProps {
  category: Category;
  className?: string;
  showIcon?: boolean;
}

export function Badge({ category, className, showIcon = true }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
        CATEGORY_BG[category],
        className
      )}
    >
      {showIcon && <span>{CATEGORY_ICONS[category]}</span>}
      {category}
    </span>
  );
}
