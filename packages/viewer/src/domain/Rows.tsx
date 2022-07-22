import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "@chakra-ui/icons";
import {
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tooltip,
  Tr,
} from "@chakra-ui/react";
import type { FC } from "react";
import React from "react";
import type { Format, RowsPayload } from "shared";
import { commas } from "shared";
import { Footer } from "./Footer";

export const Rows: FC<
  Readonly<{
    rowsPayload: RowsPayload;
    onPrevRequest: () => unknown;
    onNextRequest: () => unknown;
    onDownloadRequest: (format: Format) => unknown;
  }>
> = ({
  rowsPayload: { heads, rows, page },
  onPrevRequest,
  onNextRequest,
  onDownloadRequest,
}) => {
  return (
    <>
      <Table>
        <Thead position="sticky" top="36px">
          <Tr>
            <Th isNumeric />
            {heads.map((head) => (
              <Th key={head.id}>
                <Tooltip label={`${head.type}(${head.mode})`}>
                  {head.id}
                </Tooltip>
              </Th>
            ))}
          </Tr>
        </Thead>
        <Tbody>
          {rows.map(({ rowNumber, rows }) => {
            return rows.map((row, j) => (
              <Tr key={j}>
                {j === 0 ? (
                  <Th rowSpan={rows.length} isNumeric>{`${rowNumber}`}</Th>
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
          <HStack>
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
          </HStack>
          <HStack>
            <Text>{`${commas(page.startRowNumber)}`}</Text>
            <Text>-</Text>
            <Text>{`${commas(page.endRowNumber)}`}</Text>
            <Text>of</Text>
            <Text>{commas(page.totalRows)}</Text>
          </HStack>
        </HStack>
        <HStack>
          <Menu>
            <MenuButton
              aria-label="download"
              as={IconButton}
              icon={<DownloadIcon />}
              size="xs"
            />
            <MenuList>
              <MenuItem onClick={() => onDownloadRequest("jsonl")}>
                JSON Lines
              </MenuItem>
              <MenuItem onClick={() => onDownloadRequest("json")}>
                JSON
              </MenuItem>
              <MenuItem onClick={() => onDownloadRequest("csv")}>CSV</MenuItem>
              <MenuItem onClick={() => onDownloadRequest("md")}>
                Markdown
              </MenuItem>
              <MenuItem onClick={() => onDownloadRequest("txt")}>
                Plain Text
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      </Footer>
    </>
  );
};
