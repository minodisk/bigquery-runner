import { ChakraProvider } from "@chakra-ui/react";
import React from "react";
import { createRoot } from "react-dom/client";
import type { State } from "./App";
import App from "./App";
import { BrowserClipboardProvider } from "./context/Clipboard";
import { theme } from "./theme";
// import reportWebVitals from "./reportWebVitals";

(() => {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("root element is not found");
  }

  const webview = acquireVsCodeApi<State>();

  createRoot(root).render(
    <React.StrictMode>
      <ChakraProvider theme={theme}>
        <BrowserClipboardProvider>
          <App webview={webview} />
        </BrowserClipboardProvider>
      </ChakraProvider>
    </React.StrictMode>
  );
})();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
