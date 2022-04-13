import bytes from "bytes";
import { Metadata } from "core/src/types";
import formatDuration from "date-fns/formatDuration";
import formatISO from "date-fns/formatISO";
import React from "react";
import { CopyButton, Flex, HStack, RowNumberTd, Td, Text, Tr } from "./ui";

export const JobInformation = ({ metadata }: { metadata: Metadata }) => {
  const jobId = `${metadata.jobReference.projectId}:${metadata.jobReference.location}.${metadata.jobReference.jobId}`;

  return (
    <table>
      <tbody>
        <Tr>
          <RowNumberTd>Job ID</RowNumberTd>
          <Td>
            <HStack gap={2}>
              <Text className="breakable">{jobId}</Text>
              <Flex align="center">
                <CopyButton
                  disabled={!jobId}
                  onClick={() => {
                    if (jobId) {
                      navigator.clipboard.writeText(jobId);
                    }
                  }}
                />
              </Flex>
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>User</RowNumberTd>
          <Td>{metadata.user_email}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Location</RowNumberTd>
          <Td>{metadata.jobReference.location}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Creation time</RowNumberTd>
          <Td>
            {formatISO(Number(metadata.statistics.creationTime)).toString()}
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Start time</RowNumberTd>
          <Td>{formatISO(Number(metadata.statistics.startTime)).toString()}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>End time</RowNumberTd>
          <Td>{formatISO(Number(metadata.statistics.endTime)).toString()}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Duration</RowNumberTd>
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
          <RowNumberTd>Bytes processed</RowNumberTd>
          <Td>
            <HStack gap={1}>
              <Text>
                {bytes(Number(metadata.statistics.query.totalBytesProcessed))}
              </Text>
              {metadata.statistics.query.cacheHit ? (
                <Text>(results cached)</Text>
              ) : null}
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Bytes billed</RowNumberTd>
          <Td>{bytes(Number(metadata.statistics.query.totalBytesBilled))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Use legacy SQL</RowNumberTd>
          <Td>{`${metadata.configuration.query.useLegacySql}`}</Td>
        </Tr>
      </tbody>
    </table>
  );
};
