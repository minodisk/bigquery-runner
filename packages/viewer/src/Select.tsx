import { ChevronLeftIcon, ChevronRightIcon } from "@chakra-ui/icons";
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
import { JobInformation } from "./JobInformation";
import { TableInformation } from "./TableInformation";
import { Footer, Header } from "./ui";

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
    <Tabs>
      <Header loading={loading}>
        <TabList>
          <Tab>Results</Tab>
          <Tab>Job</Tab>
          <Tab>Table</Tab>
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
              </HStack>
              <HStack px={2}>
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
  );
};

export default Select;
