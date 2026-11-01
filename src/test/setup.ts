import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock HTMLCanvasElement.getContext if unavailable or unimplemented in jsdom
if (typeof HTMLCanvasElement !== "undefined") {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId: string) => {
    if (contextId === "2d") {
      return {
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Array(4) })),
        putImageData: vi.fn(),
        createImageData: vi.fn(() => []),
        setTransform: vi.fn(),
        drawImage: vi.fn(),
        save: vi.fn(),
        fillText: vi.fn(),
        restore: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        closePath: vi.fn(),
        stroke: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        rotate: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        measureText: vi.fn(() => ({ width: 0 })),
        transform: vi.fn(),
        rect: vi.fn(),
        clip: vi.fn(),
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// Mock BroadcastChannel in test environment with multi-instance peer dispatch
class MockBroadcastChannel {
  name: string;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  private listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map();
  private static channelsByName: Map<string, Set<MockBroadcastChannel>> = new Map();

  constructor(name: string) {
    this.name = name;
    if (!MockBroadcastChannel.channelsByName.has(name)) {
      MockBroadcastChannel.channelsByName.set(name, new Set());
    }
    MockBroadcastChannel.channelsByName.get(name)!.add(this);
  }

  postMessage(data: unknown) {
    const peers = MockBroadcastChannel.channelsByName.get(this.name);
    if (peers) {
      peers.forEach((peer) => {
        if (peer !== this) {
          const event = new MessageEvent("message", { data });
          if (peer.onmessage) peer.onmessage(event);
          const listeners = peer.listeners.get("message");
          if (listeners) {
            listeners.forEach((listener) => {
              if (typeof listener === "function") {
                listener(event);
              } else if (listener && typeof listener.handleEvent === "function") {
                listener.handleEvent(event);
              }
            });
          }
        }
      });
    }
  }

  close() {
    this.listeners.clear();
    MockBroadcastChannel.channelsByName.get(this.name)?.delete(this);
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    this.listeners.get(type)?.delete(listener);
  }

  dispatchEvent(_event: Event) {
    return true;
  }
}

// @ts-expect-error mock assignment for testing
window.BroadcastChannel = MockBroadcastChannel;
// @ts-expect-error mock assignment for testing
globalThis.BroadcastChannel = MockBroadcastChannel;
