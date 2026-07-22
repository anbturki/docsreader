// navigator.platform is deprecated, but navigator.userAgentData is Chromium-only
// and the macOS WKWebView does not implement it, so this stays the only check
// that answers correctly in every webview the app runs in.
export const isMac =
  typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform);
