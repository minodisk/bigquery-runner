import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import "./index.css";
// import { ChakraProvider, extendTheme } from "@chakra-ui/react";

(ReactDOM as any).createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* <ChakraProvider
      theme={extendTheme({
        styles: {
          global: {
            html: {
              "-webkit-font-smoothing": "initial",
            },
            body: {
              backgroundColor: "var(--vscode-terminal-background)",
              color: "var(--vscode-terminal-foreground)",

              fontFamily: "var(--vscode-editor-font-family)",
              fontSize: "var(--vscode-editor-font-size)",
            },
          },
        },
      })}
    > */}
    <App />
    {/* </ChakraProvider> */}
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
