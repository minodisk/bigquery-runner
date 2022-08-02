import { ViewIcon } from "@chakra-ui/icons";
import {
  Heading,
  HStack,
  IconButton,
  Table as TableComponent,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  VStack,
} from "@chakra-ui/react";
import bytes from "bytes";
import formatISO from "date-fns/formatISO";
import type { FC } from "react";
import React from "react";
import type { Accessor, Table as TableData, TableReference } from "shared";
import { commas, getTableName } from "shared";
import { Breakable } from "../ui/Breakable";
import { CopyButton } from "../ui/CopyButton";

export const Table: FC<{
  heads: ReadonlyArray<Accessor>;
  table: TableData;
  onPreviewRequest: (tableReference: TableReference) => unknown;
}> = ({ heads, table, onPreviewRequest }) => {
  const id = getTableName(table.tableReference);

  return (
    <VStack gap={4} align="stretch">
      <TableComponent>
        <Tbody>
          <Tr>
            <Th>Table ID</Th>
            <Td>
              <HStack gap={2}>
                <Breakable>{id}</Breakable>
                <CopyButton text={id} />
                <IconButton
                  aria-label="Preview"
                  icon={<ViewIcon />}
                  size="xs"
                  onClick={() => onPreviewRequest(table.tableReference)}
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
            <Td>{commas(table.numRows)}</Td>
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

      <VStack align="stretch">
        <Heading px={6} size="md">
          Schema
        </Heading>
        <TableComponent>
          <Thead>
            <Tr>
              <Th>Field name</Th>
              <Th>Type</Th>
              <Th>Mode</Th>
            </Tr>
          </Thead>
          <Tbody>
            {heads.map(({ id, type, mode }) => (
              <Tr key={id}>
                <Td>{id}</Td>
                <Td>{type}</Td>
                <Td>{mode}</Td>
              </Tr>
            ))}
          </Tbody>
        </TableComponent>
      </VStack>
    </VStack>
  );
};
