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
      <Tbody>
        <Thead>
          <Tr>
            <Tr>
              <Th>Column</Th>
              <Th>Type</Th>
              <Th>Mode</Th>
            </Tr>
            {heads.map(({ id, type, mode }) => (
              <Tr><Th key={id}>{id}</Th>
              <Th key={id}>{type}</Th>
              <Th key={id}>{mode}</Th></Tr>
            ))}
          </Tr>
        </Thead>
      </Tbody>
    </TableComponent>
  );
};
