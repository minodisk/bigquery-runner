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
          <Th />
          <Th>Type</Th>
          <Th>Mode</Th>
        </Tr>
        <Tr>
          <Th>
            {heads.map(({ id }) => (
              <Tr><Th key={id}>{id}</Th></Tr>
            ))}
          </Th>
          <Th>
            {heads.map(({ id, type }) => (
              <Tr><Th key={id}>{type}</Th></Tr>
            ))}
          </Th>
          <Th>
            {heads.map(({ id, mode }) => (
              <Tr><Th key={id}>{mode}</Th></Tr>
            ))}
          </Th>
        </Tr>
      </Thead>
        {/* <Th>Type</Th>
        {/* <Tr>
          <Th>Mode</Th>
          {heads.map(({ id, mode }) => (
            <td key={id}>{mode}</td>
          ))}
        </Tr> */}
      </Tbody>
    </TableComponent>
  );
};
