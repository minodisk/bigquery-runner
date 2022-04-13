import bytes from "bytes";
import { Table } from "core/src/types";
import formatISO from "date-fns/formatISO";
import React from "react";
import { CopyButton, Flex, HStack, RowNumberTd, Td, Text, Tr } from "./ui";

export const TableInformation = ({ table }: { table: Table }) => {
  const tableId = `${table.tableReference.projectId}.${table.tableReference.datasetId}.${table.tableReference.tableId}`;
  return (
    <table>
      <tbody>
        <Tr>
          <RowNumberTd>Table ID</RowNumberTd>
          <Td>
            <HStack gap={2}>
              <Text className="breakable">{tableId}</Text>
              <Flex align="center">
                <CopyButton
                  disabled={!tableId}
                  onClick={() => {
                    if (tableId) {
                      navigator.clipboard.writeText(tableId);
                    }
                  }}
                />
              </Flex>
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Table size</RowNumberTd>
          <Td>{bytes(Number(table.numBytes))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Long-term storage size</RowNumberTd>
          <Td>{bytes(Number(table.numLongTermBytes))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Number of rows</RowNumberTd>
          <Td>{table.numRows}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Created</RowNumberTd>
          <Td>{formatISO(Number(table.creationTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Last modified</RowNumberTd>
          <Td>{formatISO(Number(table.lastModifiedTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Table expiration</RowNumberTd>
          <Td>{formatISO(Number(table.expirationTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Data location</RowNumberTd>
          <Td>{table.location}</Td>
        </Tr>
      </tbody>
    </table>
  );
};
