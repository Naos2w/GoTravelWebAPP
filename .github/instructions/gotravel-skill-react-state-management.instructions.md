---
applyTo: "components/**/*.tsx, App.tsx"
---
# Skill Mapping: react-state-management

The `go-travel` application coordinates state across multiple views (Itinerary, Expenses, Checklist, Map). Use these guidelines to keep state flow consistent.

## State Organization
- **Local View State**: Keep UI toggles, draft inputs, and error states local to their components using React hooks (`useState`, `useRef`).
- **Shared Application State**: Lift state up to the nearest common ancestor (e.g. `App.tsx` or `Itinerary.tsx`) or utilize React Context for global structures like Localization.
- **Asynchronous Sync**: Handle state sync with Supabase by calling storage service methods, catching errors, and setting loading indicators.

## Optimistic Updates Pattern
To provide a fast and modern UX, implement optimistic updates when saving, updating, or deleting items:
1. Update the local component/page state instantly.
2. Trigger the asynchronous Supabase background sync.
3. If the background call fails, revert the local state back to the previous snapshot and display a toast notification or warning.

Example of optimistic delete:
```typescript
const deleteExpense = (id: string) => {
  // 1. Snapshot previous state
  const previousExpenses = [...trip.expenses];

  // 2. Optimistic update (remove instantly)
  const updatedExpenses = trip.expenses.filter(e => e.id !== id);
  onUpdate({ ...trip, expenses: updatedExpenses }, "DELETE_EXPENSE", id);

  // 3. Trigger remote database sync
  storageService.deleteExpense(id)
    .catch((error) => {
      console.error("Failed to delete remote expense:", error);
      // 4. Revert state on failure
      onUpdate({ ...trip, expenses: previousExpenses }, "REVERT_EXPENSES");
      showToast("Failed to delete expense");
    });
};
```
