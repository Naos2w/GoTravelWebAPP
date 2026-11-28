import React, { useEffect, useRef } from "react";
import { getCookieConsent } from "../services/analyticsService";

export interface AdSlotProps {
  slot: string;
  className?: string;
  language?: "zh" | "en";
}

const getAdSenseClientId = (): string => {
  const raw = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  return typeof raw === "string" ? raw.trim() : "";
};

/**
 * Non-intrusive Google AdSense container.
 * Renders `null` whenever AdSense is unconfigured or cookie consent is not `"accepted"`.
 */
export const AdSlot: React.FC<AdSlotProps> = ({
  slot,
  className = "",
  language = "zh",
}) => {
  const pushedKeyRef = useRef<string | null>(null);
  const clientId = getAdSenseClientId();
  const hasConsent = getCookieConsent() === "accepted";
  const trimmedSlot = slot.trim();
  const isActive = Boolean(clientId && trimmedSlot && hasConsent);

  useEffect(() => {
    if (!isActive || typeof window === "undefined") return;
    const renderKey = `${clientId}:${trimmedSlot}`;
    if (pushedKeyRef.current === renderKey) return;
    pushedKeyRef.current = renderKey;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch {
      // Ignore AdSense initialization errors in restricted or ad-blocked environments
    }
  }, [isActive, clientId, trimmedSlot]);

  if (!isActive) return null;

  const labelText = language === "en" ? "Sponsored" : "贊助內容";

  return (
    <aside
      aria-label="Advertisement"
      data-testid="ad-slot-container"
      className={`rounded-2xl bg-[#F0F2F5]/80 dark:bg-[#1B1F2A]/80 border border-black/[0.06] dark:border-white/[0.08] p-3 overflow-hidden ${className}`.trim()}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#68707D] dark:text-[#8B93A1]">
          {labelText}
        </span>
      </div>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={clientId}
        data-ad-slot={trimmedSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
};
