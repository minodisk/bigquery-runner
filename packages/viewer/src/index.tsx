import { ChakraProvider, extendTheme } from "@chakra-ui/react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
// import reportWebVitals from "./reportWebVitals";
// import "./index.css";

(() => {
  const root = document.getElementById("root");
  if (!root) {
    throw new Error("root element is not found");
  }

  const theme = extendTheme({
    styles: {
      global: {
        html: {
          WebkitFontSmoothing: "unset",
        },
        body: {
          fontFamily: "var(--vscode-font-family)",
          fontSize: "var(--vscode-font-size)",
          color: "var(--vscode-descriptionForeground)",
          backgroundColor: "var(--vscode-editor-background)",
          padding: 0,
        },
      },
    },
    components: {
      Text: {
        baseStyle: {},
      },
      Button: {
        baseStyle: {},
      },
      Tabs: {
        baseStyle: {
          tabpanel: {
            p: 0,
          },
        },
        variants: {
          line: {
            tab: {
              fontSize: "var(--vscode-font-size)",
              color: "var(--vscode-descriptionForeground)",
              _selected: {
                color: "var(--vscode-descriptionForeground)",
              },
            },
          },
        },
      },
      Table: {
        variants: {
          simple: {
            table: {
              borderCollapse: "separate",
              borderSpacing: 0,
            },
            th: {
              color: "var(--vscode-descriptionForeground)",
              borderColor: "var(--vscode-terminal-border)",
              backgroundColor: "var(--vscode-editor-background)",
              textTransform: "unset",
            },
            thead: {
              th: {},
            },
            tbody: {
              th: {},
            },
            td: {
              fontFamily: "var(--vscode-editor-font-family)",
              fontSize: "var(--vscode-editor-font-size)",
              color: "var(--vscode-editor-foreground)",
              borderColor: "var(--vscode-terminal-border)",
            },
          },
        },
      },
    },
  });

  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ChakraProvider theme={theme}>
        <App />
      </ChakraProvider>
    </React.StrictMode>
  );
})();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
