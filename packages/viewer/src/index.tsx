import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
// import reportWebVitals from "./reportWebVitals";
import "./index.css";

(
  ReactDOM as unknown as {
    createRoot: (el: HTMLElement | null) => {
      render: (node: JSX.Element) => void;
    };
  }
)
  .createRoot(document.getElementById("root"))
  .render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
