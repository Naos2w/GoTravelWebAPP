import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InfoTip } from "../../src/shared/components/InfoTip";

describe("InfoTip", () => {
  it("renders a compact ? button and toggles the popover on click", () => {
    render(<InfoTip text="這是一段詳細說明文字" testId="sample-tip" />);

    const trigger = screen.getByTestId("sample-tip-trigger");
    expect(trigger).toHaveAttribute("type", "button");
    expect(trigger).toHaveAttribute("aria-label", "查看說明");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("sample-tip-popover")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const popover = screen.getByTestId("sample-tip-popover");
    expect(popover).toHaveTextContent("這是一段詳細說明文字");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("sample-tip-popover")).not.toBeInTheDocument();
  });

  it("stops click propagation when placed inside a clickable parent card or button", () => {
    const onParentClick = vi.fn();

    render(
      <div role="button" tabIndex={0} onClick={onParentClick}>
        <span>卡片標題</span>
        <InfoTip text="不應觸發父層點擊" testId="nested-tip" />
      </div>
    );

    const trigger = screen.getByTestId("nested-tip-trigger");
    fireEvent.click(trigger);

    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByTestId("nested-tip-popover")).toBeInTheDocument();

    // Clicking inside the popover should also not trigger the parent card
    fireEvent.click(screen.getByTestId("nested-tip-popover"));
    expect(onParentClick).not.toHaveBeenCalled();
  });

  it("closes on Escape key (without leaking to window) and on outside click", () => {
    const windowEscapeListener = vi.fn();
    window.addEventListener("keydown", windowEscapeListener);

    try {
      render(
        <div>
          <InfoTip text="按 Escape 或點擊外部關閉" testId="dismiss-tip" />
          <div data-testid="outside-area">外部區域</div>
        </div>
      );

      const trigger = screen.getByTestId("dismiss-tip-trigger");
      fireEvent.click(trigger);
      expect(screen.getByTestId("dismiss-tip-popover")).toBeInTheDocument();

      // Dismiss via Escape
      fireEvent.keyDown(document, { key: "Escape" });
      expect(screen.queryByTestId("dismiss-tip-popover")).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(windowEscapeListener).not.toHaveBeenCalled();

      // Re-open and dismiss via outside click
      fireEvent.click(trigger);
      expect(screen.getByTestId("dismiss-tip-popover")).toBeInTheDocument();
      fireEvent.mouseDown(screen.getByTestId("outside-area"));
      expect(screen.queryByTestId("dismiss-tip-popover")).not.toBeInTheDocument();
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    } finally {
      window.removeEventListener("keydown", windowEscapeListener);
    }
  });
});
