import { Tab, TabList, TabPanel, TabPanels, Tabs } from "@chakra-ui/react";
import deepmerge from "deepmerge";
import React, { FC, useCallback, useEffect, useState } from "react";
import {
  isFocusedEvent,
  isCloseEvent,
  isData,
  isOpenEvent,
  isRowsEvent,
  RowsPayload,
  isRoutineEvent,
  RoutinePayload,
  isMetadataEvent,
  MetadataPayload,
  TablePayload,
  isTableEvent,
  Format,
} from "types";
import { Header } from "./domain/Header";
import { Job } from "./domain/Job";
import { Routine } from "./domain/Routine";
import { Rows } from "./domain/Rows";
import { Table } from "./domain/Table";

type State = Partial<
  Readonly<{
    tabIndex: number;
    metadataPayload: MetadataPayload;
    tablePayload: TablePayload;
    rowsPayload: RowsPayload;
    routinePayload: RoutinePayload;
  }>
>;

const vscode = acquireVsCodeApi<State>(); // window["acquireVsCodeApi"] ?
// : {
//     getState(): State {
//       // eslint-disable-next-line
//       const rowsPayload = require("../../misc/mock/rows.json");
//       require("../../misc/mock/vscode.css");
//       // return payload;
//       return { rowsPayload };
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
  const [metadataPayload, setMetadataPayload] = useState<
    MetadataPayload | undefined
  >(vscode.getState()?.metadataPayload);
  const [tablePayload, setTablePayload] = useState<TablePayload | undefined>(
    vscode.getState()?.tablePayload
  );
  const [routinePayload, setRoutinePayload] = useState<
    RoutinePayload | undefined
  >(vscode.getState()?.routinePayload);
  const [rowsPayload, setRowsPayload] = useState<RowsPayload | undefined>(
    vscode.getState()?.rowsPayload
  );
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
  const [tabIndex, setTabIndex] = useState(vscode.getState()?.tabIndex ?? 0);

  const setState = useCallback((state: State) => {
    vscode.setState(deepmerge(vscode.getState() ?? {}, state));
  }, []);

  const onPrevRequest = useCallback(() => {
    vscode.postMessage({ event: "prev" });
  }, []);
  const onNextRequest = useCallback(() => {
    vscode.postMessage({ event: "next" });
  }, []);
  const onDownloadRequest = useCallback((format: Format) => {
    vscode.postMessage({ event: "download", format });
  }, []);
  const onPreviewRequest = useCallback(() => {
    vscode.postMessage({ event: "preview" });
  }, []);

  const onTabChange = useCallback(
    (tabIndex: number) => {
      setTabIndex(tabIndex);
      setState({ tabIndex });
    },
    [setState]
  );

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
      if (isMetadataEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setMetadataPayload(payload.payload);
          setState({ metadataPayload: payload.payload });
        });
        return;
      }
      if (isTableEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setTablePayload(payload.payload);
          setState({ tablePayload: payload.payload });
        });
        return;
      }
      if (isRowsEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setRowsPayload(payload.payload);
          setState({ rowsPayload: payload.payload });
        });
        return;
      }
      if (isRoutineEvent(payload)) {
        setLoading(undefined);
        startTransition(() => {
          setRoutinePayload(payload.payload);
          setState({ routinePayload: payload.payload });
        });
        return;
      }
      if (isCloseEvent(payload)) {
        setLoading(undefined);
        return;
      }
      throw new Error(`undefined data payload:\n'${JSON.stringify(payload)}'`);
    });
  }, [setState, startTransition]);

  useEffect(() => {
    if (isPending) {
      setLoading("Rendering");
    } else {
      setLoading(undefined);
    }
  }, [isPending]);

  return (
    <Tabs index={tabIndex} onChange={onTabChange}>
      <Header loading={loading}>
        <TabList>
          {rowsPayload ? <Tab>Results</Tab> : null}
          {tablePayload ? <Tab>Table</Tab> : null}
          {routinePayload ? <Tab>Routine</Tab> : null}
          {metadataPayload ? <Tab>Job</Tab> : null}
        </TabList>
      </Header>
      <TabPanels>
        {rowsPayload ? (
          <TabPanel>
            <Rows
              rowsPayload={rowsPayload}
              onPrevRequest={onPrevRequest}
              onNextRequest={onNextRequest}
              onDownloadRequest={onDownloadRequest}
            />
          </TabPanel>
        ) : null}
        {tablePayload ? (
          <TabPanel>
            <Table
              table={tablePayload.table}
              onPreviewRequest={onPreviewRequest}
            />
          </TabPanel>
        ) : null}
        {routinePayload ? (
          <TabPanel>
            <Routine routine={routinePayload.routine} />
          </TabPanel>
        ) : null}
        {metadataPayload ? (
          <TabPanel>
            <Job metadata={metadataPayload.metadata} />
          </TabPanel>
        ) : null}
      </TabPanels>
    </Tabs>
  );
};

export default App;
