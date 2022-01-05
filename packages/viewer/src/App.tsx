import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";

function App() {
  const [lines, setLines] = useState<Array<string>>([]);
  useEffect(() => {
    window.addEventListener("message", (e: MessageEvent<string>) => {
      console.log(e);
      setLines((ls) => [...ls, e.data]);
    });
  }, []);
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <ul>
          {lines.map((line) => (
            <li>{line}</li>
          ))}
        </ul>
      </header>
    </div>
  );
}

export default App;
