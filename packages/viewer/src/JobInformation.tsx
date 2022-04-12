import bytes from "bytes";
import { JobInfo } from "core/src/types";
import formatDuration from "date-fns/formatDuration";
import formatISO from "date-fns/formatISO";
import React from "react";
import { CopyButton, Flex, HStack, RowNumberTd, Td, Text, Tr } from "./ui";

export const JobInformation = ({ jobInfo }: { jobInfo: JobInfo }) => {
  const jobId = `${jobInfo.jobReference.projectId}:${jobInfo.jobReference.location}.${jobInfo.jobReference.jobId}`;

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
          <Td>{jobInfo.user_email}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Location</RowNumberTd>
          <Td>{jobInfo.jobReference.location}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Creation time</RowNumberTd>
          <Td>
            {formatISO(Number(jobInfo.statistics.creationTime)).toString()}
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Start time</RowNumberTd>
          <Td>{formatISO(Number(jobInfo.statistics.startTime)).toString()}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>End time</RowNumberTd>
          <Td>{formatISO(Number(jobInfo.statistics.endTime)).toString()}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Duration</RowNumberTd>
          <Td>
            {formatDuration({
              seconds:
                (Number(jobInfo.statistics.endTime) -
                  Number(jobInfo.statistics.creationTime)) /
                1000,
            })}
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Bytes processed</RowNumberTd>
          <Td>
            <HStack gap={1}>
              <Text>
                {bytes(Number(jobInfo.statistics.query.totalBytesProcessed))}
              </Text>
              {jobInfo.statistics.query.cacheHit ? (
                <Text>(results cached)</Text>
              ) : null}
            </HStack>
          </Td>
        </Tr>
        <Tr>
          <RowNumberTd>Bytes billed</RowNumberTd>
          <Td>{bytes(Number(jobInfo.statistics.query.totalBytesBilled))}</Td>
        </Tr>
        <Tr>
          <RowNumberTd>Use legacy SQL</RowNumberTd>
          <Td>{`${jobInfo.configuration.query.useLegacySql}`}</Td>
        </Tr>
      </tbody>
    </table>
  );
};
