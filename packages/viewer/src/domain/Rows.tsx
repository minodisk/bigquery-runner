import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
} from "@chakra-ui/icons";
import {
  HStack,
  IconButton,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import React, { FC } from "react";
import { RowsPayload } from "types";
import { Footer } from "./Footer";

export const Rows: FC<
  Readonly<{
    rowsPayload: RowsPayload;
    onPrevRequest: () => unknown;
    onNextRequest: () => unknown;
    onDownloadRequest: () => unknown;
  }>
> = ({
  rowsPayload: { header, rows, page },
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
            {header.map((head) => (
              <Th key={head}>{head}</Th>
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
            size="xs"
            onClick={onDownloadRequest}
          />
        </HStack>
      </Footer>
    </>
  );
};
