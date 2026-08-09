---
applyTo: "components/**/*.tsx, App.tsx"
---
# Skill Mapping: react-conventions

All React components and pages in the `go-travel` project must follow these rules.

## React Component Structure
Every React component file should follow this order:
1. Imports (React, icons, custom components, types, services, contexts).
2. Interface/Type definitions for Props (if any).
3. Component definition using functional component syntax (`React.FC<Props>` or standard function).
4. Hooks invocation (useState, useEffect, useMemo, custom hooks).
5. Helper functions (internal logic, formatting).
6. JSX return block.

Example:
```tsx
import React, { useState, useMemo } from 'react';
import { Tag } from 'lucide-react';
import { Expense } from '../types';

interface Props {
  expenses: Expense[];
  onAdd: (expense: Expense) => void;
}

export const ExpenseTracker: React.FC<Props> = ({ expenses, onAdd }) => {
  const [amount, setAmount] = useState('');

  const total = useMemo(() => {
    return expenses.reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm">
      <div className="flex items-center gap-2">
        <Tag className="text-primary" size={20} />
        <span className="font-bold text-slate-800 dark:text-white">Total: {total}</span>
      </div>
    </div>
  );
};
```

## Naming Conventions
- **Components**: PascalCase (e.g. `Expenses.tsx`, `MapView.tsx`).
- **Hooks & Utility Files**: camelCase (e.g. `useTranslation`, `dateTimeUtils.ts`).
- **Variables & Functions**: camelCase (e.g. `isFormOpen`, `saveExpense`).
- **Interfaces / Types**: PascalCase (e.g. `Expense`, `Trip`).
- **Constants**: UPPER_SNAKE_CASE (e.g. `CATEGORY_UI`).

## Tailwind CSS Guidelines
- **Responsive Layouts**: Use prefix-modifiers (`sm:`, `md:`, `lg:`) to structure layouts. Ensure dropdowns and absolute components do not get clipped by `overflow-hidden` or `overflow-x-auto` on small viewports.
- **Dark Mode**: Add `dark:` variant styling for backgrounds, text, and borders to ensure the application adapts to the user's system preferences.
- **Interactivity**: Add micro-interactions (e.g. `hover:bg-slate-100`, `transition-all`, `active:scale-[0.98]`) to interactive elements.
