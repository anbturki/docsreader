import "@testing-library/jest-dom/vitest";

// jsdom implements neither ResizeObserver nor scrollIntoView.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;
Element.prototype.scrollIntoView ??= () => {};
