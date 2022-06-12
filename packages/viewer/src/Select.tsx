import React, { FC } from "react";
import { Rows } from "core/src/types";
import cx from "classnames";
import { JobInformation } from "./JobInformation";
import { Footer, Header } from "./ui";
import { TableInformation } from "./TableInformation";
import {
  Box,
  HStack,
  IconButton,
  Spinner,
  Tab,
  Table,
  TabList,
  TabPanel,
  TabPanels,
  Tabs,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";

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
  return (
    <Box className={cx({ focused })}>
      <Tabs>
        <Header>
          <TabList>
            <Tab>Results</Tab>
            <Tab>Job</Tab>
            <Tab>Table</Tab>
          </TabList>
          {loading ? (
            <HStack gap={1} px={2}>
              <Text>{loading}</Text>
              <Spinner size="sm" />
            </HStack>
          ) : null}
        </Header>
        <TabPanels>
          <TabPanel>
            <Box>
              <Table>
                <Thead position="sticky" top={38.5}>
                  <Tr>
                    <Th isNumeric />
                    {header.map((head) => (
                      <Th key={head}>{head}</Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
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
                          <Th
                            rowSpan={rows.length}
                            isNumeric
                          >{`${rowNumber}`}</Th>
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
                </Tbody>
              </Table>
              <Footer>
                <HStack gap={1}>
                  {/* <StartButton onClick={() => vscode?.postMessage({ event: "start" })} /> */}
                  <IconButton
                    aria-label="prev page"
                    icon={<ChevronLeftIcon />}
                    size="xs"
                    variant="ghost"
                    disabled={!page.hasPrev}
                    onClick={onPrevRequest}
                  />
                  <IconButton
                    aria-label="next page"
                    icon={<ChevronRightIcon />}
                    size="xs"
                    variant="ghost"
                    disabled={!page.hasNext}
                    onClick={onNextRequest}
                  />
                  {/* <EndButton onClick={() => vscode?.postMessage({ event: "end" })} /> */}
                </HStack>
                <HStack gap={1} px={1}>
                  <Text>{`${page.rowNumberStart}`}</Text>
                  <Text>-</Text>
                  <Text>{`${page.rowNumberEnd}`}</Text>
                  <Text>of</Text>
                  <Text>{page.numRows}</Text>
                </HStack>
              </Footer>
            </Box>
          </TabPanel>
          <TabPanel>
            <JobInformation metadata={metadata} />
          </TabPanel>
          <TabPanel>
            <TableInformation table={table} />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </Box>
  );
};

export default Select;
