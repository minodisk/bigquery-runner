import { HStack, Table, Tbody, Td, Th, Tr } from "@chakra-ui/react";
import bytes from "bytes";
import formatISO from "date-fns/formatISO";
import React from "react";
import { Table as TableInfo } from "types";
import { Breakable, CopyButton } from "./ui";

export const TableInformation = ({ table }: { table: TableInfo }) => {
  const tableId = `${table.tableReference.projectId}.${table.tableReference.datasetId}.${table.tableReference.tableId}`;
  return (
    <Table>
      <Tbody>
        <Tr>
          <Th>Table ID</Th>
          <Td>
            <HStack gap={2}>
              <Breakable>{tableId}</Breakable>
              <CopyButton text={tableId} />
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
        <Tr>
          <Th>Table expiration</Th>
          <Td>{formatISO(Number(table.expirationTime))}</Td>
        </Tr>
        <Tr>
          <Th>Data location</Th>
          <Td>{table.location}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
};
