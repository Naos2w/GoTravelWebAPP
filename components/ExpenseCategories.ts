import { 
  Plane, Coffee, Home, Car, Ticket, ShoppingBag, Tag 
} from "lucide-react";

// TODO: [Refactored] Extracted CATEGORY_UI and getCategoryName to separate file to allow code splitting for Expenses.tsx

export const CATEGORY_UI: Record<string, { icon: any, color: string, hexColor: string, bgColor: string, darkBgColor: string, textColor: string }> = {
  Flight: { icon: Plane, color: 'bg-sky-500', hexColor: '#0ea5e9', bgColor: 'bg-sky-50', darkBgColor: 'dark:bg-sky-900', textColor: 'text-sky-600' },
  Food: { icon: Coffee, color: 'bg-orange-500', hexColor: '#f97316', bgColor: 'bg-orange-50', darkBgColor: 'dark:bg-orange-900', textColor: 'text-orange-600' },
  Accommodation: { icon: Home, color: 'bg-indigo-500', hexColor: '#6366f1', bgColor: 'bg-indigo-50', darkBgColor: 'dark:bg-indigo-900', textColor: 'text-indigo-600' },
  Transport: { icon: Car, color: 'bg-teal-500', hexColor: '#14b8a6', bgColor: 'bg-teal-50', darkBgColor: 'dark:bg-teal-900', textColor: 'text-teal-600' },
  Tickets: { icon: Ticket, color: 'bg-emerald-500', hexColor: '#10b981', bgColor: 'bg-emerald-50', darkBgColor: 'dark:bg-emerald-900', textColor: 'text-emerald-600' },
  Shopping: { icon: ShoppingBag, color: 'bg-pink-500', hexColor: '#ec4899', bgColor: 'bg-pink-50', darkBgColor: 'dark:bg-pink-900', textColor: 'text-pink-600' },
  Other: { icon: Tag, color: 'bg-slate-400', hexColor: '#94a3b8', bgColor: 'bg-slate-100', darkBgColor: 'dark:bg-slate-800', textColor: 'text-slate-500' }
};

export const getCategoryName = (cat: string, t: (key: string) => string) => {
  switch(cat) {
      case 'Flight': return t('catFlight');
      case 'Food': return t('catFood');
      case 'Accommodation': return t('catAccom');
      case 'Transport': return t('catTransport');
      case 'Tickets': return t('catTickets');
      case 'Shopping': return t('catShopping');
      case 'Other': return t('catOther');
      default: return cat;
  }
};
