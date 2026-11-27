import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import {
  InstallPwaPromptModal,
  usePwaInstall,
} from "../../src/shared/components/InstallPwaPrompt";
import { ShareTargetModal } from "../../src/shared/components/ShareTargetModal";
import { ExportModal } from "../../src/features/trips/ExportModal";
import { ProfileMenuContent } from "../../src/app/components/TripHeader";
import { LocalizationProvider } from "../../src/shared/contexts/LocalizationContext";
import { PwaEnvironment } from "../../src/shared/services/pwaService";
import { Trip } from "../../src/types";

const makeEnv = (overrides: Partial<PwaEnvironment>): PwaEnvironment => ({
  isStandalone: false,
  isIos: false,
  isAndroid: false,
  isInAppBrowser: false,
  inAppBrowserName: null,
  isSafari: false,
  ...overrides,
});

const mockTrips: Trip[] = [
  {
    id: "trip-tokyo",
    user_id: "user-1",
    name: "Tokyo Spring",
    destination: "Tokyo, Japan",
    startDate: "2026-04-01",
    endDate: "2026-04-03",
    flights: [],
    expenses: [],
    checklist: [],
    itinerary: [
      { date: "2026-04-01", items: [] },
      { date: "2026-04-02", items: [] },
    ],
  },
  {
    id: "trip-kyoto",
    user_id: "user-1",
    name: "Kyoto Autumn",
    destination: "Kyoto, Japan",
    startDate: "2026-11-10",
    endDate: "2026-11-12",
    flights: [],
    expenses: [],
    checklist: [],
    itinerary: [
      { date: "2026-11-10", items: [] },
      { date: "2026-11-11", items: [] },
    ],
  },
];

describe("InstallPwaPrompt & ShareTargetModal (Smoke Tests)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders iOS Safari 2-step guide in a document.body portal and closes on Escape / backdrop", () => {
    const onClose = vi.fn();
    render(
      <LocalizationProvider>
        <InstallPwaPromptModal
          isOpen={true}
          onClose={onClose}
          envOverride={makeEnv({ isIos: true, isSafari: true })}
        />
      </LocalizationProvider>
    );

    const modal = screen.getByTestId("install-pwa-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByTestId("pwa-ios-guide")).toBeInTheDocument();
    expect(screen.getByText(/點擊 Safari 底部工具列的「分享」按鈕/)).toBeInTheDocument();
    expect(screen.getByText(/向下滑動並選擇「加入主畫面」/)).toBeInTheDocument();

    // Verify backdrop uses z-[9999] portal directly inside document.body
    const backdrop = screen.getByTestId("install-pwa-backdrop");
    expect(backdrop.className).toContain("z-[9999]");
    expect(backdrop.parentElement).toBe(document.body);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("renders LINE in-app browser guard instructing user to open in external browser", () => {
    render(
      <LocalizationProvider>
        <InstallPwaPromptModal
          isOpen={true}
          onClose={vi.fn()}
          envOverride={makeEnv({
            isIos: true,
            isInAppBrowser: true,
            inAppBrowserName: "LINE",
          })}
        />
      </LocalizationProvider>
    );

    expect(screen.getByTestId("pwa-inapp-guard")).toBeInTheDocument();
    expect(screen.getByText("偵測到 LINE 內建瀏覽器")).toBeInTheDocument();
    expect(
      screen.getByText(/在 Safari \/ 外部瀏覽器開啟/)
    ).toBeInTheDocument();
    expect(screen.queryByTestId("pwa-ios-guide")).not.toBeInTheDocument();
  });

  it("renders Android 1-tap native install CTA and triggers native install callback", async () => {
    const onNativeInstall = vi.fn().mockResolvedValue("accepted");
    const onClose = vi.fn();

    render(
      <LocalizationProvider>
        <InstallPwaPromptModal
          isOpen={true}
          onClose={onClose}
          canNativeInstall={true}
          onNativeInstall={onNativeInstall}
          envOverride={makeEnv({ isAndroid: true })}
        />
      </LocalizationProvider>
    );

    const btn = screen.getByTestId("pwa-native-install-btn");
    expect(btn).toHaveTextContent("立即安裝 App");

    fireEvent.click(btn);
    await waitFor(() => {
      expect(onNativeInstall).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it("hides InstallPwaPromptModal automatically in standalone mode", () => {
    render(
      <LocalizationProvider>
        <InstallPwaPromptModal
          isOpen={true}
          onClose={vi.fn()}
          envOverride={makeEnv({ isStandalone: true, isIos: true })}
        />
      </LocalizationProvider>
    );

    expect(screen.queryByTestId("install-pwa-modal")).not.toBeInTheDocument();
  });

  it("captures beforeinstallprompt in usePwaInstall and triggers prompt()", async () => {
    const promptSpy = vi.fn().mockResolvedValue(undefined);
    const HookHarness: React.FC = () => {
      const { canNativeInstall, triggerNativeInstall } = usePwaInstall();
      return (
        <div>
          <span data-testid="can-install">{String(canNativeInstall)}</span>
          <button
            type="button"
            data-testid="trigger-install"
            onClick={() => void triggerNativeInstall()}
          >
            Trigger
          </button>
        </div>
      );
    };

    render(<HookHarness />);
    expect(screen.getByTestId("can-install")).toHaveTextContent("false");

    const event = new Event("beforeinstallprompt") as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: "accepted"; platform: string }>;
      platforms: string[];
    };
    event.prompt = promptSpy;
    event.userChoice = Promise.resolve({ outcome: "accepted", platform: "web" });
    event.platforms = ["web"];

    fireEvent(window, event);
    await waitFor(() => {
      expect(screen.getByTestId("can-install")).toHaveTextContent("true");
    });

    fireEvent.click(screen.getByTestId("trigger-install"));
    await waitFor(() => {
      expect(promptSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("can-install")).toHaveTextContent("false");
    });
  });

  it("saves a shared Google Maps place into the selected trip & day via ShareTargetModal", () => {
    const onSave = vi.fn();
    const sharedUrl =
      "https://www.google.com/maps/place/Kiyomizu-dera/@34.9948561,135.7850463,17z";

    render(
      <LocalizationProvider>
        <ShareTargetModal
          isOpen={true}
          initialTitle="Kiyomizu-dera - Google Maps"
          initialUrl={sharedUrl}
          trips={mockTrips}
          defaultTripId="trip-tokyo"
          currentUserId="user-1"
          onSave={onSave}
          onClose={vi.fn()}
        />
      </LocalizationProvider>
    );

    // Pre-filled clean place name & URL preview
    const nameInput = screen.getByTestId(
      "share-place-name-input"
    ) as HTMLInputElement;
    expect(nameInput.value).toBe("Kiyomizu-dera");
    expect(screen.getByTestId("share-url-preview")).toHaveTextContent(sharedUrl);

    // Edit place name, switch to Kyoto trip & Day 2, pick Food category
    fireEvent.change(nameInput, { target: { value: "清水寺本堂" } });
    fireEvent.change(screen.getByTestId("share-trip-select"), {
      target: { value: "trip-kyoto" },
    });
    fireEvent.click(screen.getByTestId("share-day-pill-1"));
    fireEvent.click(screen.getByTestId("share-type-food"));
    fireEvent.change(screen.getByTestId("share-time-input"), {
      target: { value: "15:30" },
    });

    fireEvent.click(screen.getByTestId("share-target-save-btn"));

    expect(onSave).toHaveBeenCalledTimes(1);
    const [updatedTrip, savedItem] = onSave.mock.calls[0];
    expect(updatedTrip.id).toBe("trip-kyoto");
    expect(savedItem.placeName).toBe("清水寺本堂");
    expect(savedItem.date).toBe("2026-11-11");
    expect(savedItem.time).toBe("15:30");
    expect(savedItem.type).toBe("Food");
    expect(savedItem.googleMapsUrl).toBe(sharedUrl);
    expect(savedItem.lat).toBeCloseTo(34.9948561, 4);
    expect(savedItem.lng).toBeCloseTo(135.7850463, 4);
    expect(updatedTrip.itinerary[1].items).toHaveLength(1);
    expect(updatedTrip.itinerary[1].items[0].placeName).toBe("清水寺本堂");
  });

  it("renders Apple Shortcuts deep-link card in PrintExportStudio Tab 3 and copies URLs", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onNotify = vi.fn();

    render(
      <LocalizationProvider>
        <ExportModal
          trip={mockTrips[0]}
          isOpen={true}
          onClose={vi.fn()}
          onNotify={onNotify}
        />
      </LocalizationProvider>
    );

    fireEvent.click(screen.getByTestId("studio-tab-sync"));
    expect(screen.getByTestId("apple-shortcuts-card")).toBeInTheDocument();
    expect(screen.getByTestId("infotip-apple-shortcuts-trigger")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("copy-shortcut-today"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/?shortcut=today")
      );
      expect(onNotify).toHaveBeenCalledWith(expect.any(String), "success");
    });

    fireEvent.click(screen.getByTestId("copy-shortcut-quickSavePlace"));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        expect.stringContaining("/share-target?url=")
      );
    });
  });

  it("shows '加入主畫面' menu item in ProfileMenuContent only when not standalone", () => {
    const onOpenInstallPwa = vi.fn();
    const onCloseMenu = vi.fn();

    const { rerender } = render(
      <LocalizationProvider>
        <ProfileMenuContent
          user={null}
          showDetailOptions={false}
          isCreator={false}
          theme="light"
          language="zh"
          onToggleTheme={vi.fn()}
          onToggleLanguage={vi.fn()}
          onOpenExport={vi.fn()}
          onLogout={vi.fn()}
          onOpenLogin={vi.fn()}
          onCloseMenu={onCloseMenu}
          onOpenInstallPwa={onOpenInstallPwa}
          isPwaStandalone={false}
        />
      </LocalizationProvider>
    );

    const installBtn = screen.getByTestId("menu-install-pwa-btn");
    expect(installBtn).toHaveTextContent("加入主畫面");
    fireEvent.click(installBtn);
    expect(onCloseMenu).toHaveBeenCalledTimes(1);
    expect(onOpenInstallPwa).toHaveBeenCalledTimes(1);

    rerender(
      <LocalizationProvider>
        <ProfileMenuContent
          user={null}
          showDetailOptions={false}
          isCreator={false}
          theme="light"
          language="zh"
          onToggleTheme={vi.fn()}
          onToggleLanguage={vi.fn()}
          onOpenExport={vi.fn()}
          onLogout={vi.fn()}
          onOpenLogin={vi.fn()}
          onCloseMenu={onCloseMenu}
          onOpenInstallPwa={onOpenInstallPwa}
          isPwaStandalone={true}
        />
      </LocalizationProvider>
    );

    expect(screen.queryByTestId("menu-install-pwa-btn")).not.toBeInTheDocument();
  });
});
