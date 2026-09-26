import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { LoginModal } from "../../components/LoginModal";
import { LocalizationProvider, translations } from "../../contexts/LocalizationContext";

const renderWithContext = (ui: React.ReactElement) => {
  return render(
    <LocalizationProvider
      value={{
        t: (k: any) => translations.zh[k as keyof typeof translations.zh] || k,
        language: "zh",
        setLanguage: vi.fn(),
      }}
    >
      {ui}
    </LocalizationProvider>
  );
};

describe("LoginModal (Smoke Test)", () => {
  it("should not render when isOpen is false", () => {
    const { container } = renderWithContext(
      <LoginModal isOpen={false} onClose={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("should render standard login modal when open without special reason", () => {
    renderWithContext(
      <LoginModal isOpen={true} onClose={vi.fn()} />
    );

    expect(screen.getByText("登入 Go Travel")).toBeInTheDocument();
    expect(screen.getByText("使用 Google 帳號快速登入")).toBeInTheDocument();
  });

  it("should render '登入階段已逾時' when reason is session_expired", () => {
    renderWithContext(
      <LoginModal
        isOpen={true}
        onClose={vi.fn()}
        reason="session_expired"
        redirectTripId="trip-123"
      />
    );

    expect(screen.getByText("登入階段已逾時")).toBeInTheDocument();
    expect(screen.getByText("重新登入並返回行程")).toBeInTheDocument();
    expect(screen.getByText("目標行程已暫存，登入後立即開啟")).toBeInTheDocument();
  });

  it("should render '需要登入以存取行程' when reason is trip_access", () => {
    renderWithContext(
      <LoginModal
        isOpen={true}
        onClose={vi.fn()}
        reason="trip_access"
        redirectTripId="trip-456"
      />
    );

    expect(screen.getByText("需要登入以存取行程")).toBeInTheDocument();
    expect(screen.getByText("登入並開啟行程")).toBeInTheDocument();
  });

  it("should trigger onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    renderWithContext(
      <LoginModal isOpen={true} onClose={handleClose} />
    );

    // Click the top right close button
    const closeButtons = screen.getAllByRole("button");
    fireEvent.click(closeButtons[0]);
    expect(handleClose).toHaveBeenCalled();
  });
});
