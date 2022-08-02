import { HStack, Table, Tbody, Td, Text, Th, Tr } from "@chakra-ui/react";
import bytes from "bytes";
import formatDuration from "date-fns/formatDuration";
import formatISO from "date-fns/formatISO";
import React from "react";
import type { Metadata } from "shared";
import { isStandaloneStatistics, getJobName } from "shared";
import { Breakable } from "../ui/Breakable";
import { CopyButton } from "../ui/CopyButton";

export const Job = ({ metadata }: { metadata: Metadata }) => {
  const id = getJobName(metadata.jobReference);

  return (
    <Table>
      <Tbody>
        <Tr>
          <Th>Job ID</Th>
          <Td>
            <HStack gap={2}>
              <Breakable>{id}</Breakable>
              <CopyButton text={id} />
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <Th>User</Th>
          <Td>{metadata.user_email}</Td>
        </Tr>
        <Tr>
          <Th>Location</Th>
          <Td>{metadata.jobReference.location}</Td>
        </Tr>
        <Tr>
          <Th>Creation time</Th>
          <Td>
            {formatISO(Number(metadata.statistics.creationTime)).toString()}
          </Td>
        </Tr>
        <Tr>
          <Th>Start time</Th>
          <Td>{formatISO(Number(metadata.statistics.startTime)).toString()}</Td>
        </Tr>
        <Tr>
          <Th>End time</Th>
          <Td>{formatISO(Number(metadata.statistics.endTime)).toString()}</Td>
        </Tr>
        <Tr>
          <Th>Duration</Th>
          <Td>
            {formatDuration({
              seconds:
                (Number(metadata.statistics.endTime) -
                  Number(metadata.statistics.creationTime)) /
                1000,
            })}
          </Td>
        </Tr>
        <Tr>
          <Th>Bytes processed</Th>
          <Td>
            <HStack gap={1}>
              <Text>
                {bytes(Number(metadata.statistics.query.totalBytesProcessed))}
              </Text>
              {isStandaloneStatistics(metadata.statistics) &&
              metadata.statistics.query.cacheHit ? (
                <Text>(results cached)</Text>
              ) : null}
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <Th>Bytes billed</Th>
          <Td>{bytes(Number(metadata.statistics.query.totalBytesBilled))}</Td>
        </Tr>
        <Tr>
          <Th>Use legacy SQL</Th>
          <Td>{`${metadata.configuration.query.useLegacySql}`}</Td>
        </Tr>
      </Tbody>
    </Table>
  );
};
