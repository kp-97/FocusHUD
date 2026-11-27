import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatQueueBar } from "./ChatQueueBar";

describe("ChatQueueBar Component", () => {
  it("renders nothing when queuedMessages is empty", () => {
    const { container } = render(
      <ChatQueueBar queuedMessages={[]} onDismiss={vi.fn()} onClearAll={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders queued messages stack with single message without clear-all button", () => {
    const handleDismiss = vi.fn();
    render(
      <ChatQueueBar
        queuedMessages={["Review draft PR"]}
        onDismiss={handleDismiss}
        onClearAll={vi.fn()}
      />
    );

    expect(screen.getByTestId("queued-messages-bar")).toBeInTheDocument();
    expect(screen.getByText(/QUEUED \(1\):/i)).toBeInTheDocument();
    expect(screen.getByText(/"Review draft PR"/i)).toBeInTheDocument();
    expect(screen.queryByText(/CLEAR ALL/i)).not.toBeInTheDocument();

    const dismissBtn = screen.getByLabelText(/Remove queued message #1/i);
    fireEvent.click(dismissBtn);
    expect(handleDismiss).toHaveBeenCalledWith(0);
  });

  it("renders multiple queued messages with clear-all button", () => {
    const handleClearAll = vi.fn();
    const handleDismiss = vi.fn();
    render(
      <ChatQueueBar
        queuedMessages={["Task 1", "Task 2", "Task 3"]}
        onDismiss={handleDismiss}
        onClearAll={handleClearAll}
      />
    );

    expect(screen.getByText(/QUEUED \(3\):/i)).toBeInTheDocument();
    const clearBtn = screen.getByText(/CLEAR ALL/i);
    fireEvent.click(clearBtn);
    expect(handleClearAll).toHaveBeenCalledTimes(1);

    const dismissBtn3 = screen.getByLabelText(/Remove queued message #3/i);
    fireEvent.click(dismissBtn3);
    expect(handleDismiss).toHaveBeenCalledWith(2);
  });
});
