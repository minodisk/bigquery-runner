import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "@chakra-ui/icons";
import {
  Box,
  HStack,
  IconButton,
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
import React, { FC } from "react";
import { Rows } from "types";
import { Footer } from "../domain/Footer";
import { Header } from "../domain/Header";
import { Job } from "../domain/Job";
import { Table as TableTabContent } from "../domain/Table";

export const Select: FC<
  Readonly<{
    focused: boolean;
    loading?: string;
    selectPayload: Rows;
    onPrevRequest: () => unknown;
    onNextRequest: () => unknown;
    onDownloadRequest: () => unknown;
    onPreviewRequest: () => unknown;
  }>
> = ({
  focused,
  loading,
  selectPayload: { header, rows, page, metadata, table },
  onPrevRequest,
  onNextRequest,
  onDownloadRequest,
  onPreviewRequest,
}) => {
  return (
    <Tabs>
      <Header loading={loading}>
        <TabList>
          <Tab>Results</Tab>
          <Tab>Table</Tab>
          <Tab>Job</Tab>
        </TabList>
      </Header>
      <TabPanels>
        <TabPanel>
          <Box>
            <Table>
              <Thead position="sticky" top="36px">
                <Tr>
                  <Th isNumeric />
                  {header.map((head) => (
                    <Th key={head}>{head}</Th>
                  ))}
                </Tr>
              </Thead>
              <Tbody>
                {rows.map(({ rowNumber, rows }, i) => {
                  // const lastRow = i === rows.length - 1;
                  return rows.map((row, j) => (
                    <Tr key={j}>
                      {j === 0 ? (
                        <Th
                          rowSpan={rows.length}
                          isNumeric
                        >{`${rowNumber}`}</Th>
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
              </Tbody>
            </Table>
            <Footer>
              <HStack px={2} gap={1}>
                <IconButton
                  aria-label="prev page"
                  icon={<ChevronLeftIcon />}
                  size="xs"
                  disabled={!page.hasPrev}
                  onClick={onPrevRequest}
                />
                <IconButton
                  aria-label="next page"
                  icon={<ChevronRightIcon />}
                  size="xs"
                  disabled={!page.hasNext}
                  onClick={onNextRequest}
                />
                <Text>{`${page.rowNumberStart}`}</Text>
                <Text>-</Text>
                <Text>{`${page.rowNumberEnd}`}</Text>
                <Text>of</Text>
                <Text>{page.numRows}</Text>
              </HStack>
              <HStack>
                <IconButton
                  aria-label="download"
                  icon={<DownloadIcon />}
                  onClick={onDownloadRequest}
                />
              </HStack>
            </Footer>
          </Box>
        </TabPanel>
        <TabPanel>
          <Job metadata={metadata} />
        </TabPanel>
        <TabPanel>
          <TableTabContent table={table} onPreviewRequest={onPreviewRequest} />
        </TabPanel>
      </TabPanels>
    </Tabs>
  );
};
