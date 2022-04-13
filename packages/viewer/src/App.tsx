import React, { FC, useEffect, useState } from "react";
import {
  isFocusedEvent,
  isCloseEvent,
  isData,
  isOpenEvent,
  isRowsEvent,
  Rows,
  ViewerEvent,
  SerializablePage,
} from "core/src/types";
import cx from "classnames";
import "./App.css";
import { JobInformation } from "./JobInformation";
import {
  Box,
  Flex,
  HStack,
  NextButton,
  PrevButton,
  RowNumberTd,
  RowNumberTh,
  Spinner,
  Tab,
  TabContent,
  Td,
  Th,
  Tr,
  UIText,
  VStack,
} from "./ui";
import { TableInformation } from "./TableInformation";
// import * as payload from "../../misc/mock/payload.json";

const w = window as unknown as {
  acquireVsCodeApi?: () => {
    getState(): Rows;
    setState(rows: Rows): void;
    postMessage(e: ViewerEvent): void;
  };
};
const vscode = w.acquireVsCodeApi ? w.acquireVsCodeApi() : undefined;

const App: FC = () => {
  const [focused, setFocused] = useState(false);
  const [data, setData] = useState<Rows | undefined>(
    /*payload ?? */ vscode?.getState()
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
  const [current, setCurrent] = useState("results");

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
          setData(payload.payload);
          vscode?.setState(payload.payload);
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

  return (
    <Box className={cx({ focused })}>
      <Header current={current} loading={loading} onChange={setCurrent} />
      <div>
        <TabContent name="results" current={current}>
          {data ? (
            <VStack>
              <table>
                <thead>
                  <Tr>
                    <RowNumberTh>Row</RowNumberTh>
                    {data.header.map((head) => (
                      <Th key={head}>{head}</Th>
                    ))}
                  </Tr>
                </thead>
                <tbody>
                  {data.rows.map(({ rowNumber, rows }, i) => {
                    const lastRow = i === data.rows.length - 1;
                    return rows.map((row, j) => (
                      <Tr
                        key={j}
                        className={cx({
                          lastOfRowNumber: lastRow && j === 0,
                        })}
                      >
                        {j === 0 ? (
                          <RowNumberTd rowSpan={rows.length}>
                            {`${rowNumber}`}
                          </RowNumberTd>
                        ) : null}
                        {row.map((cell) => {
                          return (
                            <Td key={cell.id}>
                              {cell.value === undefined
                                ? null
                                : `${cell.value}`}
                            </Td>
                          );
                        })}
                      </Tr>
                    ));
                  })}
                </tbody>
              </table>
              <Footer page={data.page} />
            </VStack>
          ) : null}
        </TabContent>
        <TabContent name="jobInformation" current={current}>
          {data ? <JobInformation metadata={data.metadata} /> : null}
        </TabContent>
        <TabContent name="tableInformation" current={current}>
          {data ? <TableInformation table={data.table} /> : null}
        </TabContent>
      </div>
    </Box>
  );
};

const Header: FC<{
  readonly current: string;
  readonly loading?: string;
  readonly onChange: (current: string) => void;
}> = ({ current, loading, onChange }) => (
  <Box className="header">
    <Flex justify="between" className="nav">
      <HStack>
        <Tab name="results" current={current} onChange={onChange}>
          <UIText>Results</UIText>
        </Tab>
        <Tab name="jobInformation" current={current} onChange={onChange}>
          <UIText>Job Information</UIText>
        </Tab>
        <Tab name="tableInformation" current={current} onChange={onChange}>
          Table Information
        </Tab>
      </HStack>
      {loading ? (
        <HStack reverse align="center" gap={1} px={2}>
          <Spinner />
          <UIText color="weak">{loading}</UIText>
        </HStack>
      ) : null}
    </Flex>
  </Box>
);

const Footer: FC<{
  readonly page: SerializablePage;
}> = ({ page, ...props }) => (
  <Box className="footer">
    <Flex justify="between" className="pagination" px={2}>
      <HStack gap={2} {...props}>
        {/* <StartButton onClick={() => vscode?.postMessage({ event: "start" })} /> */}
        <PrevButton
          disabled={!page.hasPrev}
          onClick={() => vscode?.postMessage({ event: "prev" })}
        />
        <NextButton
          disabled={!page.hasNext}
          onClick={() => vscode?.postMessage({ event: "next" })}
        />
        {/* <EndButton onClick={() => vscode?.postMessage({ event: "end" })} /> */}
      </HStack>
      <HStack gap={2} {...props}>
        <UIText color="weak">{`${page.rowNumberStart}`}</UIText>
        <UIText color="weak">-</UIText>
        <UIText color="weak">{`${page.rowNumberEnd}`}</UIText>
        <UIText color="weak">of</UIText>
        <UIText color="weak">{page.numRows}</UIText>
      </HStack>
    </Flex>
  </Box>
);

export default App;
