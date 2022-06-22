import React, { FC, useCallback, useEffect, useState } from "react";
import {
  isFocusedEvent,
  isCloseEvent,
  isData,
  isOpenEvent,
  isRowsEvent,
  Rows,
  isRoutineEvent,
  RoutinePayload,
} from "types";
import { Routine } from "./pages/Routine";
import { Select } from "./pages/Select";

const vscode = acquireVsCodeApi<Rows>();
// : // mock
//   {
//     getState() {
//       // eslint-disable-next-line
//       // const payload = require("../../misc/mock/rows.json");
//       // require("../../misc/mock/vscode.css");
//       // return payload;
//       return {};
//     },
//     setState() {
//       // do nothing
//     },
//     postMessage() {
//       // do nothing
//     },
//   };

const App: FC = () => {
  const [focused, setFocused] = useState(false);
  const [selectPayload, setSelectPayload] = useState<Rows | undefined>(
    vscode.getState()
  );
  const [routinePayload, setRoutinePayload] = useState<
    RoutinePayload | undefined
  >();
  const [loading, setLoading] = useState<string | undefined>("Initializing");
  const [isPending, startTransition] = (
    React as unknown as {
      useTransition: (props: {
        timeoutMs: number;
      }) => [
        isPending: boolean,
        startTransition: (callback: () => unknown) => void
      ];
    }
  ).useTransition({
    timeoutMs: 5000,
  });

  const onDownloadRequest = useCallback(() => {
    vscode.postMessage({ event: "download" });
  }, []);
  const onPrevRequest = useCallback(() => {
    vscode.postMessage({ event: "prev" });
  }, []);
  const onNextRequest = useCallback(() => {
    vscode.postMessage({ event: "next" });
  }, []);

  useEffect(() => {
    vscode.postMessage({ event: "loaded" });
  }, []);

  useEffect(() => {
    window.addEventListener("message", (e: MessageEvent) => {
      // When postMessage from a test, this value becomes a JSON string, so parse it.
      const data =
        typeof e.data === "string" && e.data ? JSON.parse(e.data) : e.data;
      if (!isData(data)) {
        return;
      }
      const { payload } = data;
      if (isFocusedEvent(payload)) {
        setFocused(payload.payload.focused);
        return;
      }
      if (isOpenEvent(payload)) {
        setLoading("Fetching");
        return;
      }
      if (isRowsEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setSelectPayload(payload.payload);
          vscode.setState(payload.payload);
        });
        return;
      }
      if (isRoutineEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setRoutinePayload(payload.payload);
          // vscode.setState(payload.payload);
        });
        return;
      }
      if (isCloseEvent(payload)) {
        setLoading(undefined);
        return;
      }
      throw new Error(`undefined data payload '${payload}'`);
    });
  }, [startTransition]);

  useEffect(() => {
    if (isPending) {
      setLoading("Rendering");
    } else {
      setLoading(undefined);
    }
  }, [isPending]);

  if (selectPayload) {
    return (
      <Select
        focused={focused}
        loading={loading}
        selectPayload={selectPayload}
        onDownloadRequest={onDownloadRequest}
        onPrevRequest={onPrevRequest}
        onNextRequest={onNextRequest}
      />
    );
  }
  if (routinePayload) {
    return (
      <Routine
        focused={focused}
        loading={loading}
        routinePayload={routinePayload}
      />
    );
  }
  return null;
};

export default App;
