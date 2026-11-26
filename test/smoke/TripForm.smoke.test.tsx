import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react";
import { TripForm } from "../../components/TripForm";
import { LocalizationProvider } from "../../contexts/LocalizationContext";
import { fetchTdxFlights } from "../../services/tdxService";

vi.mock("../../services/tdxService", () => ({
  fetchTdxFlights: vi.fn(),
}));

const mockedFetch = vi.mocked(fetchTdxFlights);

const renderForm = () => {
  const onClose = vi.fn();
  const onSubmit = vi.fn();
  const utils = render(
    <LocalizationProvider>
      <TripForm onClose={onClose} onSubmit={onSubmit} />
    </LocalizationProvider>
  );
  return { onClose, onSubmit, ...utils };
};

const byId = (container: HTMLElement, id: string) => container.querySelector(`#${id}`) as HTMLInputElement;

const typeDates = (start: string, end: string) => {
  const [startInput, endInput] = screen.getAllByPlaceholderText("YYYY/MM/DD");
  fireEvent.change(startInput, { target: { value: start } });
  fireEvent.change(endInput, { target: { value: end } });
};

const openFlightMode = () => fireEvent.click(screen.getByRole("tab", { name: /航班匯入/ }));

const fillOutboundSearch = (container: HTMLElement) => {
  fireEvent.click(screen.getAllByRole("button", { name: "KIX" })[1]);
  fireEvent.change(screen.getByPlaceholderText("YYYY/MM/DD"), { target: { value: "20260301" } });
  fireEvent.change(byId(container, "outbound-flight-number"), { target: { value: "ci100" } });
  fireEvent.click(screen.getByRole("button", { name: /^搜尋$/ }));
};

const addManualOutbound = (container: HTMLElement) => {
  fireEvent.click(screen.getByRole("button", { name: /改為手動輸入航班/ }));
  fireEvent.change(byId(container, "manual-airline"), { target: { value: "China Airlines" } });
  fireEvent.change(byId(container, "manual-flight-number"), { target: { value: "ci100" } });
  fireEvent.change(byId(container, "manual-dep-time"), { target: { value: "2026-03-01T09:00" } });
  fireEvent.change(byId(container, "manual-arr-time"), { target: { value: "2026-03-01T13:00" } });
  fireEvent.click(screen.getByRole("button", { name: /加入航段/ }));
};

describe("TripForm UX upgrade", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  describe("Quick Create mode (default)", () => {
    it("defaults to quick mode and shows day/night preview", () => {
      renderForm();
      expect(screen.getByRole("tab", { name: /快速建立/ })).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("tab", { name: /航班匯入/ })).toHaveAttribute("aria-selected", "false");

      typeDates("20260301", "20260305");
      expect(screen.getByTestId("duration-badge")).toHaveTextContent("5 天 4 夜");
    });

    it("rejects end date before start date and missing name", () => {
      const { onSubmit } = renderForm();
      typeDates("20260305", "20260301");
      fireEvent.click(screen.getByRole("button", { name: /建立旅程/ }));

      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText("回程日期不可早於出發日期")).toBeInTheDocument();
      expect(screen.getByText("必填")).toBeInTheDocument();
      expect(screen.queryByTestId("duration-badge")).not.toBeInTheDocument();
    });

    it("submits a trip with a full day plan and no flights", () => {
      const { onSubmit } = renderForm();
      fireEvent.change(screen.getByPlaceholderText("例如：東京 5 日遊"), { target: { value: "東京 5 日遊" } });
      typeDates("20260228", "20260304"); // crosses a month boundary
      fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "80000" } });
      fireEvent.click(screen.getByRole("button", { name: /建立旅程/ }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const trip = onSubmit.mock.calls[0][0];
      expect(trip.name).toBe("東京 5 日遊");
      expect(trip.destination).toBe("東京 5 日遊");
      expect(trip.flights).toEqual([]);
      expect(trip.budget).toBe(80000);
      expect(trip.startDate).toBe("2026-02-28");
      expect(trip.endDate).toBe("2026-03-04");
      expect(trip.itinerary.map((d: { date: string }) => d.date)).toEqual([
        "2026-02-28", "2026-03-01", "2026-03-02", "2026-03-03", "2026-03-04",
      ]);
      expect(trip.checklist.length).toBeGreaterThan(0);
    });

    it("falls back to the default budget when the field is cleared", () => {
      const { onSubmit } = renderForm();
      fireEvent.change(screen.getByPlaceholderText("例如：東京 5 日遊"), { target: { value: "Tokyo" } });
      typeDates("20260301", "20260301");
      expect(screen.getByTestId("duration-badge")).toHaveTextContent("當日來回");
      fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "" } });
      fireEvent.click(screen.getByRole("button", { name: /建立旅程/ }));
      expect(onSubmit.mock.calls[0][0].budget).toBe(50000);
    });
  });

  describe("Flight import mode", () => {
    it("shows the 3-step indicator and popular airport chips", () => {
      const { container } = renderForm();
      openFlightMode();

      const steps = within(screen.getByRole("list", { name: "建立步驟" })).getAllByRole("listitem");
      expect(steps).toHaveLength(3);
      expect(steps[0]).toHaveAttribute("aria-current", "step");
      expect(steps[0]).toHaveTextContent("去程");
      expect(steps[1]).toHaveTextContent("回程");
      expect(steps[2]).toHaveTextContent("確認");

      for (const code of ["TPE", "TSA", "KHH", "NRT", "HND", "KIX", "ICN", "HKG"]) {
        expect(screen.getAllByRole("button", { name: code })).toHaveLength(2); // origin + destination
      }
      fireEvent.click(screen.getAllByRole("button", { name: "HND" })[0]);
      expect(byId(container, "outbound-origin").value).toBe("HND");
      fireEvent.click(screen.getAllByRole("button", { name: "KIX" })[1]);
      expect(byId(container, "outbound-destination").value).toBe("KIX");
    });

    it("shows a friendly alert when no flights are found and supports manual entry", async () => {
      mockedFetch.mockResolvedValue([]);
      const { container } = renderForm();
      openFlightMode();
      fillOutboundSearch(container);

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("找不到符合的航班");
      expect(screen.getByRole("button", { name: /跳過航班直接建立旅程/ })).toBeInTheDocument();

      addManualOutbound(container);

      expect(screen.getByText("CI100")).toBeInTheDocument();
      expect(screen.getByText("TPE → KIX")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /下一步：設定回程/ })).toBeInTheDocument();
      // layover entry is a secondary action, search form is hidden
      expect(screen.getByRole("button", { name: /新增轉機航段/ })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("BR198")).not.toBeInTheDocument();
    });

    it("shows an error alert when the flight API throws", async () => {
      mockedFetch.mockRejectedValue(new Error("network down"));
      vi.spyOn(console, "error").mockImplementation(() => {});
      const { container } = renderForm();
      openFlightMode();
      fillOutboundSearch(container);

      expect(await screen.findByRole("alert")).toHaveTextContent("航班查詢暫時無法使用");
      expect(screen.getByRole("button", { name: /改為手動輸入航班/ })).toBeInTheDocument();
    });

    it("validates the manual flight form", async () => {
      mockedFetch.mockResolvedValue([]);
      const { container } = renderForm();
      openFlightMode();
      fillOutboundSearch(container);
      await screen.findByRole("alert");

      fireEvent.click(screen.getByRole("button", { name: /改為手動輸入航班/ }));
      fireEvent.click(screen.getByRole("button", { name: /加入航段/ }));
      expect(screen.getByText("請填寫完整資訊，且抵達時間需晚於出發時間")).toBeInTheDocument();
    });

    it("skip-to-quick keeps the entered destination and dates", async () => {
      mockedFetch.mockResolvedValue([]);
      const { container } = renderForm();
      openFlightMode();
      fillOutboundSearch(container);
      await screen.findByRole("alert");

      fireEvent.click(screen.getByRole("button", { name: /跳過航班直接建立旅程/ }));

      expect(screen.getByRole("tab", { name: /快速建立/ })).toHaveAttribute("aria-selected", "true");
      expect(byId(container, "trip-name").value).toBe("KIX");
      expect(screen.getAllByPlaceholderText("YYYY/MM/DD")[0]).toHaveValue("2026/03/01");
    });

    it("walks outbound -> inbound -> review, back navigation works, and review is customizable", async () => {
      mockedFetch.mockResolvedValueOnce([]).mockResolvedValueOnce([
        {
          airline: "China Airlines",
          flightNumber: "CI101",
          departureTime: "2026-03-05T14:00",
          arrivalTime: "2026-03-05T16:30",
          departureAirport: "KIX",
          arrivalAirport: "TPE",
        },
      ]);
      const { container, onSubmit } = renderForm();
      openFlightMode();
      fillOutboundSearch(container);
      await screen.findByRole("alert");
      addManualOutbound(container);

      fireEvent.click(screen.getByRole("button", { name: /下一步：設定回程/ }));
      expect(byId(container, "inbound-origin").value).toBe("KIX");
      expect(byId(container, "inbound-destination").value).toBe("TPE");

      fireEvent.change(byId(container, "inbound-flight-number"), { target: { value: "ci101" } });
      fireEvent.click(screen.getByRole("button", { name: /^搜尋$/ }));
      fireEvent.click(await screen.findByRole("button", { name: /CI101/ }));

      // Summary view with primary CTA, search form hidden
      expect(await screen.findByRole("button", { name: /前往確認/ })).toBeInTheDocument();
      expect(screen.queryByPlaceholderText("BR197")).not.toBeInTheDocument();

      // Back from inbound summary goes to the outbound summary (previously stuck on inbound)
      fireEvent.click(screen.getByRole("button", { name: /返回/ }));
      expect(screen.getByRole("button", { name: /下一步：設定回程/ })).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /下一步：設定回程/ }));
      fireEvent.click(screen.getByRole("button", { name: /前往確認/ }));

      const nameInput = byId(container, "review-trip-name");
      expect(nameInput.placeholder).toBe("KIX");
      fireEvent.change(nameInput, { target: { value: "大阪美食行" } });
      fireEvent.change(byId(container, "review-budget"), { target: { value: "65000" } });
      fireEvent.click(screen.getByRole("button", { name: /^確認$/ }));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const trip = onSubmit.mock.calls[0][0];
      expect(trip.name).toBe("大阪美食行");
      expect(trip.flights).toHaveLength(1);
      expect(trip.flights[0].budget).toBe(65000);
      expect(trip.startDate).toBe("2026-03-01");
      expect(trip.endDate).toBe("2026-03-05");
      expect(trip.itinerary).toHaveLength(5);
    });
  });

  describe("Modal dismissal", () => {
    it("closes on Escape", async () => {
      const { onClose } = renderForm();
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    });

    it("closes on backdrop click but not on dialog click", () => {
      const { onClose } = renderForm();
      fireEvent.click(screen.getByRole("dialog"));
      expect(onClose).not.toHaveBeenCalled();
      fireEvent.click(screen.getByTestId("trip-form-backdrop"));
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
