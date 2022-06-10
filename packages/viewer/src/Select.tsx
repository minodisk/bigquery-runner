import React, { FC, useState } from "react";
import { Rows, SerializablePage } from "core/src/types";
import cx from "classnames";
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

const Select: FC<
  Readonly<{
    focused: boolean;
    loading?: string;
    selectPayload: Rows;
    onPrevRequest: () => unknown;
    onNextRequest: () => unknown;
  }>
> = ({
  focused,
  loading,
  selectPayload: { header, rows, page, metadata, table },
  onPrevRequest,
  onNextRequest,
}) => {
  const [current, setCurrent] = useState("results");

  return (
    <Box className={cx({ focused })}>
      <Header current={current} onChange={setCurrent} loading={loading} />
      <div>
        <TabContent name="results" current={current}>
          <VStack>
            <table>
              <thead>
                <Tr>
                  <RowNumberTh>Row</RowNumberTh>
                  {header.map((head) => (
                    <Th key={head}>{head}</Th>
                  ))}
                </Tr>
              </thead>
              <tbody>
                {rows.map(({ rowNumber, rows }, i) => {
                  const lastRow = i === rows.length - 1;
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
                            {cell.value === undefined ? null : `${cell.value}`}
                          </Td>
                        );
                      })}
                    </Tr>
                  ));
                })}
              </tbody>
            </table>
            <Footer
              page={page}
              onPrevRequest={onPrevRequest}
              onNextRequest={onNextRequest}
            />
          </VStack>
        </TabContent>
        <TabContent name="jobInformation" current={current}>
          <JobInformation metadata={metadata} />
        </TabContent>
        <TabContent name="tableInformation" current={current}>
          <TableInformation table={table} />
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
          <UIText>Job</UIText>
        </Tab>
        <Tab name="tableInformation" current={current} onChange={onChange}>
          Table
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

const Footer: FC<
  Readonly<{
    page: SerializablePage;
    onPrevRequest: () => unknown;
    onNextRequest: () => unknown;
  }>
> = ({ page, onPrevRequest, onNextRequest, ...props }) => (
  <Box className="footer">
    <Flex justify="between" className="pagination" px={2}>
      <HStack gap={2} {...props}>
        {/* <StartButton onClick={() => vscode?.postMessage({ event: "start" })} /> */}
        <PrevButton disabled={!page.hasPrev} onClick={onPrevRequest} />
        <NextButton disabled={!page.hasNext} onClick={onNextRequest} />
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

export default Select;
