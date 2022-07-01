import { ViewIcon } from "@chakra-ui/icons";
import {
  HStack,
  IconButton,
  Table as TableComponent,
  Tbody,
  Td,
  Th,
  Tr,
} from "@chakra-ui/react";
import bytes from "bytes";
import formatISO from "date-fns/formatISO";
import React, { FC } from "react";
import { Table as TableData } from "types";
import { Breakable } from "../ui/Breakable";
import { CopyButton } from "../ui/CopyButton";

export const Table: FC<{
  table: TableData;
  onPreviewRequest: () => unknown;
}> = ({ table, onPreviewRequest }) => {
  const tableId = `${table.tableReference.projectId}.${table.tableReference.datasetId}.${table.tableReference.tableId}`;

  return (
    <TableComponent>
      <Tbody>
        <Tr>
          <Th>Table ID</Th>
          <Td>
            <HStack gap={2}>
              <Breakable>{tableId}</Breakable>
              <CopyButton text={tableId} />
              <IconButton
                aria-label="preview"
                icon={<ViewIcon />}
                size="xs"
                onClick={onPreviewRequest}
              />
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <Th>Table size</Th>
          <Td>{bytes(Number(table.numBytes))}</Td>
        </Tr>
        <Tr>
          <Th>Long-term storage size</Th>
          <Td>{bytes(Number(table.numLongTermBytes))}</Td>
        </Tr>
        <Tr>
          <Th>Number of rows</Th>
          <Td>{table.numRows}</Td>
        </Tr>
        <Tr>
          <Th>Created</Th>
          <Td>{formatISO(Number(table.creationTime))}</Td>
        </Tr>
        <Tr>
          <Th>Last modified</Th>
          <Td>{formatISO(Number(table.lastModifiedTime))}</Td>
        </Tr>
        {table.expirationTime ? (
          <Tr>
            <Th>Table expiration</Th>
            <Td>{formatISO(Number(table.expirationTime))}</Td>
          </Tr>
        ) : null}
        <Tr>
          <Th>Data location</Th>
          <Td>{table.location}</Td>
        </Tr>
      </Tbody>
    </TableComponent>
  );
};
