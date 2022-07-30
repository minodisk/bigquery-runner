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
          <Th>Column</Th>
          <Th>Type</Th>
          <Th>Mode</Th>
        </Tr>
      </Thead>
      <Tbody>
        {heads.map(({ id, type, mode }) => (
          <Tr key={id}>
            <Th>{id}</Th>
            <Th>{type}</Th>
            <Th>{mode}</Th>
          </Tr>
        ))}
      </Tbody>
    </TableComponent>
  );
};
