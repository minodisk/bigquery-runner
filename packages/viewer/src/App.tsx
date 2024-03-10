import {
  Tab,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  useToast,
} from "@chakra-ui/react";
import type { FC } from "react";
import React, { useCallback, useEffect, useState } from "react";
import type {
  RowsPayload,
  RoutinePayload,
  MetadataPayload,
  TablePayload,
  Err,
  Format,
  Tab as TabName,
  TableReference,
} from "shared";
import {
  isMoveTabFocusEvent,
  isFocusOnTabEvent,
  isData,
  isRowsEvent,
  isRoutinesEvent,
  isMetadataEvent,
  isTablesEvent,
  isStartProcessingEvent,
  isSuccessLoadingEvent,
  isFailProcessingEvent,
} from "shared";
import type { WebviewApi } from "vscode-webview";
import { Header } from "./domain/Header";
import { Job } from "./domain/Job";
import { Routine } from "./domain/Routine";
import { Rows } from "./domain/Rows";
import { Table } from "./domain/Table";

export type State = Partial<
  Readonly<{
    tabIndex: number;
    tabs: ReadonlyArray<TabName>;
    metadataPayload: MetadataPayload;
    tablePayloads: ReadonlyArray<TablePayload>;
    routinePayloads: ReadonlyArray<RoutinePayload>;
    rowsPayload: RowsPayload;
  }>
>;

const App: FC<{ webview: WebviewApi<State> }> = ({ webview: vscode }) => {
  // const [focused, setFocused] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<Err<string> | undefined>(undefined);
  const toast = useToast();
  const [metadataPayload, setMetadataPayload] = useState<
    MetadataPayload | undefined
  >(vscode.getState()?.metadataPayload);
  const [tablePayloads, setTablesPayloads] = useState<
    ReadonlyArray<TablePayload>
  >(vscode.getState()?.tablePayloads ?? []);
  const [routinePayloads, setRoutinePayloads] = useState<
    ReadonlyArray<RoutinePayload>
  >(vscode.getState()?.routinePayloads ?? []);
  const [rowsPayload, setRowsPayload] = useState<RowsPayload | undefined>(
    vscode.getState()?.rowsPayload
  );
  const [tabIndex, setTabIndex] = useState(vscode.getState()?.tabIndex ?? 0);
  const [tabs, setTabs] = useState<ReadonlyArray<TabName>>(
    vscode.getState()?.tabs ?? []
  );

  const setState = useCallback(
    (state: State) => {
      const old = vscode.getState() ?? {};
      vscode.setState({ ...old, ...state });
    },
    [vscode]
  );

  const onPrevRequest = useCallback(() => {
    vscode.postMessage({ event: "prev" });
  }, [vscode]);
  const onNextRequest = useCallback(() => {
    vscode.postMessage({ event: "next" });
  }, [vscode]);
  const onDownloadRequest = useCallback(
    (format: Format) => {
      vscode.postMessage({ event: "download", format });
    },
    [vscode]
  );
  const onPreviewRequest = useCallback(
    (tableReference: TableReference) => {
      vscode.postMessage({
        event: "preview",
        payload: {
          tableReference,
        },
      });
    },
    [vscode]
  );

  const onTabChange = useCallback((tabIndex: number) => {
    setTabIndex(tabIndex);
  }, []);

  const onMessage = useCallback(
    (e: MessageEvent) => {
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
      if (isTablesEvent(payload)) {
        const tablePayloads = payload.payload;
        setTablesPayloads(tablePayloads);
        setState({ tablePayloads });
        return;
      }
      if (isRoutinesEvent(payload)) {
        const routinePayloads = payload.payload;
        setRoutinePayloads(routinePayloads);
        setState({ routinePayloads });
        return;
      }
      if (isRowsEvent(payload)) {
        setRowsPayload(payload.payload);
        setState({ rowsPayload: payload.payload });
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
      if (isMoveTabFocusEvent(payload)) {
        setTabIndex((index) => {
          const i = index + payload.payload.diff;
          const min = 0;
          if (i < min) {
            return min;
          }
          const max = tabs.length - 1;
          if (i > max) {
            return max;
          }
          return i;
        });
        return;
      }
      if (isFocusOnTabEvent(payload)) {
        const index = tabs.indexOf(payload.payload.tab);
        if (index < 0 || tabs.length - 1 < index) {
          return;
        }
        setTabIndex(index);
        return;
      }
      throw new Error(`undefined data payload:\n'${JSON.stringify(payload)}'`);
    },
    [setState, tabs]
  );

  useEffect(() => {
    setState({ tabIndex });
  }, [setState, tabIndex]);

  useEffect(() => {
    const tabs = [
      ...(rowsPayload ? ["Rows" as const] : []),
      ...tablePayloads.map(() => "Table" as const),
      ...routinePayloads.map(() => "Routine" as const),
      ...(metadataPayload ? ["Job" as const] : []),
    ];
    setTabs(tabs);
    setState({ tabs });
  }, [metadataPayload, routinePayloads, rowsPayload, setState, tablePayloads]);

  useEffect(() => {
    vscode.postMessage({ event: "loaded" });
  }, [vscode]);

  useEffect(() => {
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
    };
  }, [onMessage]);

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
          {rowsPayload ? <Tab px={6}>Rows</Tab> : null}
          {tablePayloads.map(({ id }) => (
            <Tab key={id} px={6}>
              Table
            </Tab>
          ))}
          {routinePayloads.map(({ id }) => (
            <Tab key={id} px={6}>
              Routine
            </Tab>
          ))}
          {metadataPayload ? <Tab px={6}>Job</Tab> : null}
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
        {tablePayloads.map((tablePayload) => (
          <TabPanel key={tablePayload.id}>
            <Table
              heads={tablePayload.heads}
              table={tablePayload.table}
              onPreviewRequest={onPreviewRequest}
            />
          </TabPanel>
        ))}
        {routinePayloads.map((routinePayload) => (
          <TabPanel key={routinePayload.id}>
            <Routine routine={routinePayload.routine} />
          </TabPanel>
        ))}
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
