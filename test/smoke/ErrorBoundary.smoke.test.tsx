import { describe, it, expect, vi } from "vitest";
import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBoundary } from "../../components/ErrorBoundary";

const ThrowingChild: React.FC<{ shouldThrow: boolean; message?: string }> = ({
  shouldThrow,
  message = "Simulated Leaflet crash",
}) => {
  if (shouldThrow) {
    throw new Error(message);
  }
  return <div data-testid="healthy-child">Healthy Content</div>;
};

describe("ErrorBoundary (Smoke Test)", () => {
  it("renders children normally when no error is thrown", () => {
    render(
      <ErrorBoundary>
        <div data-testid="ok-content">All Good</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId("ok-content")).toHaveTextContent("All Good");
    expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
  });

  it("catches a thrown child error without crashing sibling UI and renders Liquid Glass fallback", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onError = vi.fn();

    try {
      render(
        <div>
          <header data-testid="shell-header">Go Travel Header</header>
          <ErrorBoundary
            scope="tab"
            title="此區塊暫時無法顯示"
            retryLabel="重試"
            onError={onError}
          >
            <ThrowingChild shouldThrow={true} message="Map canvas failed" />
          </ErrorBoundary>
        </div>
      );

      // Outer app shell must remain intact
      expect(screen.getByTestId("shell-header")).toBeInTheDocument();

      // Fallback alert card renders with error details and Retry button
      const fallback = screen.getByTestId("error-boundary-fallback");
      expect(fallback).toHaveAttribute("role", "alert");
      expect(screen.getByText("此區塊暫時無法顯示")).toBeInTheDocument();
      expect(screen.getByText("Map canvas failed")).toBeInTheDocument();
      expect(screen.getByTestId("error-boundary-retry-btn")).toHaveTextContent("重試");
      expect(onError).toHaveBeenCalledTimes(1);
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("recovers cleanly when the user clicks the Retry button", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const onReset = vi.fn();

    const RecoverableHost: React.FC = () => {
      const [broken, setBroken] = useState(true);
      return (
        <ErrorBoundary
          retryLabel="Try Again"
          onReset={() => {
            onReset();
            setBroken(false);
          }}
        >
          <ThrowingChild shouldThrow={broken} />
        </ErrorBoundary>
      );
    };

    try {
      render(<RecoverableHost />);

      expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();
      fireEvent.click(screen.getByTestId("error-boundary-retry-btn"));

      expect(onReset).toHaveBeenCalledTimes(1);
      expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
      expect(screen.getByTestId("healthy-child")).toHaveTextContent("Healthy Content");
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("resets error state automatically when resetKey changes (e.g. switching tabs)", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { rerender } = render(
        <ErrorBoundary resetKey="trip-1-itinerary">
          <ThrowingChild shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId("error-boundary-fallback")).toBeInTheDocument();

      rerender(
        <ErrorBoundary resetKey="trip-1-expenses">
          <ThrowingChild shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.queryByTestId("error-boundary-fallback")).not.toBeInTheDocument();
      expect(screen.getByTestId("healthy-child")).toBeInTheDocument();
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
