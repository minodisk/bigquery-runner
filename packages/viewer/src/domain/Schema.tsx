import {
  Table as TableComponent,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@chakra-ui/react";
import type { FC } from "react";
import React from "react";
import type { Accessor } from "shared";

export const Schema: FC<{
  heads: ReadonlyArray<Accessor>;
}> = ({ heads }) => {
  return (
    <TableComponent>
      <Thead>
        <Tr>
          <Th />
          {heads.map(({ id }) => (
            <Th key={id}>{id}</Th>
          ))}
        </Tr>
      </Thead>
      <Tbody>
        <Tr>
          <Th>Type</Th>
          {heads.map(({ id, type }) => (
            <Td key={id}>{type}</Td>
          ))}
        </Tr>
        <Tr>
          <Th>Mode</Th>
          {heads.map(({ id, mode }) => (
            <Td key={id}>{mode}</Td>
          ))}
        </Tr>
      </Tbody>
    </TableComponent>
  );
};
