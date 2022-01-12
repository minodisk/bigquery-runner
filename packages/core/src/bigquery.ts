import { BigQuery, Job } from "@google-cloud/bigquery";
import { Field } from "./flat";

export type JobInfo = {
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  // user_email: string;
  configuration: {
    query: {
      query: string;
      destinationTable: TableReference;
      writeDisposition: string;
      priority: string;
      useLegacySql: boolean;
    };
    jobType: string;
  };
  jobReference: {
    projectId: string;
    jobId: string;
    location: string;
  };
  statistics: {
    creationTime: string;
    startTime: string;
    endTime: string;
    totalBytesProcessed: string;
    query: {
      totalBytesProcessed: string;
      totalBytesBilled: string;
      cacheHit: boolean;
      statementType: string;
    };
  };
  status: {
    state: string;
  };
};

export type Table = {
  kind: string;
  etag: string;
  id: string;
  selfLink: string;
  tableReference: TableReference;
  schema: Schema;
  numBytes: string;
  numLongTermBytes: string;
  numRows: string;
  creationTime: string;
  expirationTime: string;
  lastModifiedTime: string;
  type: "TABLE";
  location: string;
};

export type Schema = {
  fields?: Array<Field>;
};

export type TableReference = {
  projectId: string;
  datasetId: string;
  tableId: string;
};

export async function getJobInfo({ job }: { job: Job }): Promise<JobInfo> {
  const metadata = await job.getMetadata();
  const jobInfo: JobInfo | undefined = metadata.find(
    ({ kind }) => kind === "bigquery#job"
  );
  if (!jobInfo) {
    throw new Error(`no job info: ${job.id}`);
  }
  return jobInfo;
}

export async function getTableInfo({
  keyFilename,
  tableReference: { projectId, datasetId, tableId },
}: {
  readonly keyFilename: string;
  readonly tableReference: TableReference;
}): Promise<Table> {
  const bigQuery = new BigQuery({
    keyFilename,
    projectId: projectId,
  });
  const res = await bigQuery.dataset(datasetId).table(tableId).get();
  const table: Table = res.find(({ kind }) => kind === "bigquery#table");
  if (!table) {
    throw new Error(`no table info: ${projectId}.${datasetId}.${tableId}`);
  }
  return table;
}
