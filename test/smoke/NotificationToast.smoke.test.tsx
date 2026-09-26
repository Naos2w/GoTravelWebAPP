import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen, act } from "@testing-library/react";
import { NotificationToast } from "../../components/NotificationToast";

describe("NotificationToast (Smoke Test)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should render message text properly", () => {
    render(
      <NotificationToast
        message="這是一則重要提示訊息"
        type="info"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("這是一則重要提示訊息")).toBeInTheDocument();
  });

  it("should automatically invoke onClose after 4000ms", () => {
    const handleClose = vi.fn();
    render(
      <NotificationToast
        message="操作成功完成"
        type="success"
        onClose={handleClose}
      />
    );

    expect(handleClose).not.toHaveBeenCalled();

    // Advance timers by 4000ms
    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
