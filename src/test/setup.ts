import "@testing-library/jest-dom/vitest";

// Mock BroadcastChannel if unavailable in test environment
if (typeof window !== "undefined" && !window.BroadcastChannel) {
  class MockBroadcastChannel {
    name: string;
    onmessage: ((ev: MessageEvent) => void) | null = null;
    constructor(name: string) {
      this.name = name;
    }
    postMessage(_data: unknown) {}
    close() {}
    addEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}
    removeEventListener(_type: string, _listener: EventListenerOrEventListenerObject) {}
    dispatchEvent(_event: Event) {
      return true;
    }
  }
  // @ts-expect-error mock assignment for testing
  window.BroadcastChannel = MockBroadcastChannel;
  // @ts-expect-error mock assignment for testing
  globalThis.BroadcastChannel = MockBroadcastChannel;
}
