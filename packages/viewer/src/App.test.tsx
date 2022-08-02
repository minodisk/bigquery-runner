import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import type {
  Data,
  MetadataEvent,
  RoutinesEvent,
  RowsEvent,
  StartProcessingEvent,
  SuccessProcessingEvent,
} from "shared";
import type { WebviewApi } from "vscode-webview";
import type { State } from "./App";
import App from "./App";
import { ClipboardProvider } from "./context/Clipboard";
import jobEvent from "./jobEvent.json";
import routinesEvent from "./routineEvent.json";

const mockWebview = ({
  postMessage,
}: {
  postMessage: jest.Mock;
}): WebviewApi<State> => {
  let state: State | undefined;
  return {
    postMessage(message: unknown) {
      postMessage(message);
    },
    getState(): State | undefined {
      return state;
    },
    setState<T extends State | undefined>(newState: T): T {
      state = newState;
      return newState;
    },
  };
};

describe("App", () => {
  describe("with Rows", () => {
    it("should render null, boolean, number and string", async () => {
      const postMessage = jest.fn();
      const webview = mockWebview({ postMessage });

      render(<App webview={webview} />);
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "startProcessing",
          },
        } as Data<StartProcessingEvent>,
        "*"
      );
      window.postMessage(
        JSON.stringify({
          source: "bigquery-runner",
          payload: {
            event: "rows",
            payload: {
              heads: [
                {
                  id: "column1",
                  name: "column1",
                  type: "STRING",
                  mode: "NULLABLE",
                },
                {
                  id: "column2",
                  name: "column2",
                  type: "BOOLEAN",
                  mode: "NULLABLE",
                },
                {
                  id: "column3",
                  name: "column3",
                  type: "FLOAT",
                  mode: "NULLABLE",
                },
                {
                  id: "column4",
                  name: "column4",
                  type: "STRING",
                  mode: "NULLABLE",
                },
              ],
              rows: [
                {
                  rowNumber: "234",
                  rows: [
                    [
                      { id: "column1", value: null },
                      { id: "column2", value: true },
                      { id: "column3", value: 3.14 },
                      { id: "column4", value: "foo" },
                    ],
                  ],
                },
              ],
              page: {
                hasPrev: false,
                hasNext: false,
                startRowNumber: "123",
                endRowNumber: "456",
                totalRows: "123000",
              },
            },
          },
        } as Data<RowsEvent>),
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "successProcessing",
          },
        } as Data<SuccessProcessingEvent>,
        "*"
      );
      await waitFor(() => {
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith({ event: "loaded" });

        expect(screen.getByText("column1")).toBeInTheDocument();
        expect(screen.getByText("column2")).toBeInTheDocument();
        expect(screen.getByText("column3")).toBeInTheDocument();
        expect(screen.getByText("column4")).toBeInTheDocument();
        expect(screen.getByText("234")).toBeInTheDocument();
        expect(screen.getByText("null")).toBeInTheDocument();
        expect(screen.getByText("true")).toBeInTheDocument();
        expect(screen.getByText("3.14")).toBeInTheDocument();
        expect(screen.getByText("foo")).toBeInTheDocument();
        expect(screen.getByText("123")).toBeInTheDocument();
        expect(screen.getByText("456")).toBeInTheDocument();
        expect(screen.getByText("123,000")).toBeInTheDocument();

        const jsonl = screen.getByText("JSON Lines");
        expect(jsonl).toBeInTheDocument();
        fireEvent.click(jsonl);
        expect(postMessage).toHaveBeenCalledTimes(2);
        expect(postMessage).toHaveBeenCalledWith({
          event: "download",
          format: "jsonl",
        });

        const json = screen.getByText("JSON");
        expect(json).toBeInTheDocument();
        fireEvent.click(json);
        expect(postMessage).toHaveBeenCalledTimes(3);
        expect(postMessage).toHaveBeenCalledWith({
          event: "download",
          format: "json",
        });

        const csv = screen.getByText("CSV");
        expect(csv).toBeInTheDocument();
        fireEvent.click(csv);
        expect(postMessage).toHaveBeenCalledTimes(4);
        expect(postMessage).toHaveBeenCalledWith({
          event: "download",
          format: "csv",
        });

        const md = screen.getByText("Markdown");
        expect(md).toBeInTheDocument();
        fireEvent.click(md);
        expect(postMessage).toHaveBeenCalledTimes(5);
        expect(postMessage).toHaveBeenCalledWith({
          event: "download",
          format: "md",
        });

        const txt = screen.getByText("Plain Text");
        expect(txt).toBeInTheDocument();
        fireEvent.click(txt);
        expect(postMessage).toHaveBeenCalledTimes(6);
        expect(postMessage).toHaveBeenCalledWith({
          event: "download",
          format: "txt",
        });
      });
    });
  });

  describe("JobEvent", () => {
    it("should render Job tab", async () => {
      const writeText = jest.fn();

      const postMessage = jest.fn();
      const webview = mockWebview({ postMessage });

      render(
        <ClipboardProvider writeText={writeText}>
          <App webview={webview} />
        </ClipboardProvider>
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "startProcessing",
          },
        } as Data<StartProcessingEvent>,
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: jobEvent,
        } as Data<MetadataEvent>,
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "successProcessing",
          },
        } as Data<SuccessProcessingEvent>,
        "*"
      );
      await waitFor(() => {
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith({ event: "loaded" });

        expect(screen.getByText("Job ID")).toBeInTheDocument();
        expect(screen.getByText("User")).toBeInTheDocument();
        expect(screen.getByText("Location")).toBeInTheDocument();
        expect(screen.getByText("Creation time")).toBeInTheDocument();
        expect(screen.getByText("Start time")).toBeInTheDocument();
        expect(screen.getByText("End time")).toBeInTheDocument();
        expect(screen.getByText("Duration")).toBeInTheDocument();
        expect(screen.getByText("Bytes processed")).toBeInTheDocument();
        expect(screen.getByText("Bytes billed")).toBeInTheDocument();
        expect(screen.getByText("Use legacy SQL")).toBeInTheDocument();

        expect(writeText).toBeCalledTimes(0);
        const copy = screen.getByLabelText("Copy");
        expect(copy).toBeInTheDocument();
        fireEvent.click(copy);
        expect(writeText).toBeCalledTimes(1);
        expect(writeText).toBeCalledWith(
          "minodisk-api:US.6654cc27-8a00-464c-b9d6-4df155a9b66d"
        );
      });
    });
  });

  describe("RoutineEvent", () => {
    it("should render Routine tab", async () => {
      const writeText = jest.fn();

      const postMessage = jest.fn();
      const webview = mockWebview({ postMessage });

      render(
        <ClipboardProvider writeText={writeText}>
          <App webview={webview} />
        </ClipboardProvider>
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "startProcessing",
          },
        } as Data<StartProcessingEvent>,
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: routinesEvent,
        } as Data<RoutinesEvent>,
        "*"
      );
      window.postMessage(
        {
          source: "bigquery-runner",
          payload: {
            event: "successProcessing",
          },
        } as Data<SuccessProcessingEvent>,
        "*"
      );
      await waitFor(() => {
        expect(postMessage).toHaveBeenCalledTimes(1);
        expect(postMessage).toHaveBeenCalledWith({ event: "loaded" });

        expect(screen.getByText("Routine ID")).toBeInTheDocument();
        expect(screen.getByText("Created")).toBeInTheDocument();
        expect(screen.getByText("Last modified")).toBeInTheDocument();
        expect(screen.getByText("Language")).toBeInTheDocument();
        expect(screen.getByText("Definition")).toBeInTheDocument();

        expect(writeText).toBeCalledTimes(0);
        const copy = screen.getByLabelText("Copy");
        expect(copy).toBeInTheDocument();
        fireEvent.click(copy);
        expect(writeText).toBeCalledTimes(1);
        expect(writeText).toBeCalledWith("minodisk-api.testing.procedure");
      });
    });
  });
});
