// TODO: [Refactored] Extract inline NotificationToast component from App.tsx into standalone file to improve code organization
import React, { useEffect } from "react";
import { AlertCircle, Check } from "lucide-react";

interface NotificationToastProps {
  message: string;
  type?: "success" | "error" | "info";
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  message,
  type = "info",
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColors = {
    success: "bg-green-500",
    error: "bg-red-500",
    info: "bg-slate-900 dark:bg-white",
  };

  const textColors = {
    success: "text-white",
    error: "text-white",
    info: "text-white dark:text-slate-900",
  };

  return (
    <div
      className={`fixed top-6 left-1/2 -translate-x-1/2 z-[200] ${bgColors[type]} ${textColors[type]} px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-top-4 fade-in duration-300`}
    >
      {type === "error" ? <AlertCircle size={18} /> : <Check size={18} />}
      <span className="text-sm font-black tracking-wide">{message}</span>
    </div>
  );
};
