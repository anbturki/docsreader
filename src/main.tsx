import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// A first guess at the scheme before the stored one has loaded, so the window
// does not flash the wrong background. It is not kept in step with the system:
// once mounted the app owns the scheme, and the reader may have chosen one that
// disagrees with it.
document.documentElement.classList.toggle(
  "dark",
  window.matchMedia("(prefers-color-scheme: dark)").matches
);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
