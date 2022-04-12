import bytes from "bytes";
import { TableInfo } from "core/src/types";
import formatISO from "date-fns/formatISO";
import React from "react";
import { CopyButton, Flex, HStack, RowNumberTd, Td, Text, Tr } from "./ui";

export const TableInformation = ({ tableInfo }: { tableInfo: TableInfo }) => {
  const tableId = `${tableInfo.tableReference.projectId}.${tableInfo.tableReference.datasetId}.${tableInfo.tableReference.tableId}`;
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
          <Td>{bytes(Number(tableInfo.numBytes))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Long-term storage size</RowNumberTd>
          <Td>{bytes(Number(tableInfo.numLongTermBytes))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Number of rows</RowNumberTd>
          <Td>{tableInfo.numRows}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Created</RowNumberTd>
          <Td>{formatISO(Number(tableInfo.creationTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Last modified</RowNumberTd>
          <Td>{formatISO(Number(tableInfo.lastModifiedTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Table expiration</RowNumberTd>
          <Td>{formatISO(Number(tableInfo.expirationTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Data location</RowNumberTd>
          <Td>{tableInfo.location}</Td>
        </Tr>
      </tbody>
    </table>
  );
};
