import React, { useEffect, useState } from "react";
import logo from "./logo.svg";
import "./App.css";

type Data = {
  source: "bigquery-runner";
  payload: Event;
};

function isData(data: any): data is Data {
  return data.source === "bigquery-runner";
}

type Event = Clear | Header | Row;

type Clear = {
  event: "clear";
  payload: undefined;
};

function isClear(e: Event): e is Clear {
  return e.event === "clear";
}

type Header = {
  event: "header";
  payload: Array<string>;
};

function isHeader(e: Event): e is Header {
  return e.event === "header";
}

type Row = {
  event: "rows";
  payload: Array<Array<any>>;
};

function isRow(e: Event): e is Row {
  return e.event === "rows";
}

function App() {
  const [header, setHeader] = useState<Array<string>>([]);
  const [rows, setRows] = useState<Array<{ [key: string]: any }>>([]);
  useEffect(() => {
    window.addEventListener("message", (e: MessageEvent) => {
      if (!isData(e.data)) {
        return;
      }
      const {
        data: { payload },
      } = e;
      console.log(payload);
      if (isClear(payload)) {
        setHeader([]);
        setRows([]);
        return;
      }
      if (isHeader(payload)) {
        setHeader(payload.payload);
        return;
      }
      if (isRow(payload)) {
        setRows((rows) => [...rows, ...payload.payload]);
        return;
      }
      throw new Error(`undefined data payload '${payload}'`);
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
        <table>
          <thead>
            <tr>
              {header.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`row-${i}`}>
                {header.map((h) => (
                  <td key={`row-${i}-value-${h}`}>{row[h]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </header>
    </div>
  );
}

export default App;
