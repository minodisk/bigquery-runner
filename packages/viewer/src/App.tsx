import {
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
} from "@chakra-ui/react";
import deepmerge from "deepmerge";
import React, { FC, useCallback, useEffect, useState } from "react";
import {
  isData,
  isRowsEvent,
  RowsPayload,
  isRoutineEvent,
  RoutinePayload,
  isMetadataEvent,
  MetadataPayload,
  TablePayload,
  isTableEvent,
  Format,
  isStartProcessingEvent,
  isSuccessLoadingEvent,
  isFailProcessingEvent,
  type Error,
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
  // const [focused, setFocused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Error<string> | undefined>(undefined);
  const toast = useToast();
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
      // if (isFocusedEvent(payload)) {
      //   setFocused(payload.payload.focused);
      //   return;
      // }
      if (isStartProcessingEvent(payload)) {
        setProcessing(true);
        setError(undefined);
        return;
      }
      if (isMetadataEvent(payload)) {
        setMetadataPayload(payload.payload);
        setState({ metadataPayload: payload.payload });
        return;
      }
      if (isTableEvent(payload)) {
        setTablePayload(payload.payload);
        setState({ tablePayload: payload.payload });
        return;
      }
      if (isRowsEvent(payload)) {
        setRowsPayload(payload.payload);
        setState({ rowsPayload: payload.payload });
        return;
      }
      if (isRoutineEvent(payload)) {
        setRoutinePayload(payload.payload);
        setState({ routinePayload: payload.payload });
        return;
      }
      if (isSuccessLoadingEvent(payload)) {
        setProcessing(false);
        setError(undefined);
        return;
      }
      if (isFailProcessingEvent(payload)) {
        setProcessing(false);
        setError(payload.payload);
        return;
      }
      throw new Error(`undefined data payload:\n'${JSON.stringify(payload)}'`);
    });
  }, [setState]);

  useEffect(() => {
    if (error) {
      toast({
        title: error.type,
        description: error.reason,
        status: "error",
        position: "bottom-right",
        duration: 8000,
      });
    } else {
      toast.closeAll();
    }
  }, [error, toast]);

  return (
    <Tabs index={tabIndex} onChange={onTabChange}>
      <Header processing={processing}>
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
