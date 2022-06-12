import React, { FC, useCallback, useEffect, useState } from "react";
import {
  isFocusedEvent,
  isCloseEvent,
  isData,
  isOpenEvent,
  isRowsEvent,
  Rows,
  ViewerEvent,
  isRoutineEvent,
  RoutinePayload,
} from "core/src/types";
// import "./App.css";
import Select from "./Select";
import Routine from "./Routine";

const w = window as unknown as {
  acquireVsCodeApi?: () => {
    getState(): Rows;
    setState(rows: Rows): void;
    postMessage(e: ViewerEvent): void;
  };
};
const vscode = w.acquireVsCodeApi
  ? w.acquireVsCodeApi()
  : {
      getState() {
        // eslint-disable-next-line
        const payload = require("../../misc/mock/payload.json");
        require("./vscode.css");
        return payload;
      },
      setState() {
        // do nothing
      },
      postMessage() {
        // do nothing
      },
    };

const App: FC = () => {
  const [focused, setFocused] = useState(false);
  const [selectPayload, setSelectPayload] = useState<Rows | undefined>(
    /*payload ?? */ vscode?.getState()
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

  const onPrevRequest = useCallback(() => {
    vscode?.postMessage({ event: "prev" });
  }, []);
  const onNextRequest = useCallback(() => {
    vscode?.postMessage({ event: "next" });
  }, []);

  useEffect(() => {
    vscode?.postMessage({ event: "loaded" });
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
          vscode?.setState(payload.payload);
        });
        return;
      }
      if (isRoutineEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setRoutinePayload(payload.payload);
          // vscode?.setState(payload.payload);
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
