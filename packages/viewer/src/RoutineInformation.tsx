import { Routine } from "core/src/types";
import formatISO from "date-fns/formatISO";
import React from "react";
import { CopyButton, Flex, HStack, Pre, RowNumberTd, Td, Text, Tr } from "./ui";

export const RoutineInformation = ({ routine }: { routine: Routine }) => {
  const { projectId, datasetId, routineId } = routine.metadata.routineReference;
  const id = [projectId, datasetId, routineId].join(".");
  return (
    <table>
      <tbody>
        <Tr>
          <RowNumberTd>Routine ID</RowNumberTd>
          <Td>
            <HStack gap={2}>
              <Text className="breakable">{id}</Text>
              <Flex align="center">
                <CopyButton text={id} />
              </Flex>
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Created</RowNumberTd>
          <Td>{formatISO(Number(routine.metadata.creationTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Last modified</RowNumberTd>
          <Td>{formatISO(Number(routine.metadata.lastModifiedTime))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Language</RowNumberTd>
          <Td>{routine.metadata.language}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Definition</RowNumberTd>
          <Td>
            <Pre>{routine.metadata.definitionBody}</Pre>
          </Td>
        </Tr>
      </tbody>
    </table>
  );
};
