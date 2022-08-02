import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { Job } from "./Job";

describe("Job", () => {
  describe("metadata", () => {
    it("should be rendered with cache", async () => {
      render(
        <Job
          metadata={{
            kind: "bigquery#job",
            etag: "XXXXXXXXXXXXXXXXXXXXXX==",
            id: "project-id-for-test:location-for-test.job-id-for-test",
            selfLink: "https://example.com",
            user_email: "user@example.iam.gserviceaccount.com",
            configuration: {
              query: {
                defaultDataset: {
                  projectId: "",
                  datasetId: "",
                },
                destinationTable: {
                  projectId: "",
                  datasetId: "",
                  tableId: "",
                },
                priority: "INTERACTIVE",
                query: "",
                writeDisposition: "WRITE_TRUNCATE",
                useLegacySql: false,
              },
              jobType: "QUERY",
            },
            jobReference: {
              projectId: "project-id-for-test",
              jobId: "job-id-for-test",
              location: "location-for-test",
            },
            statistics: {
              creationTime: "1649770220681",
              endTime: "1649770222887",
              startTime: "1649770221849",
              totalBytesProcessed: "4096",
              totalSlotMs: "",
              query: {
                billingTier: 1,
                cacheHit: true,
                estimatedBytesProcessed: "",
                statementType: "SELECT",
                totalBytesBilled: "1024",
                totalBytesProcessed: "2048",
                totalPartitionsProcessed: "",
                totalSlotMs: "",
              },
            },
            status: { state: "DONE" },
          }}
        />
      );
      await waitFor(() => {
        expect(
          screen.getByText(
            "project-id-for-test:location-for-test.job-id-for-test"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText("user@example.iam.gserviceaccount.com")
        ).toBeInTheDocument();
        expect(screen.getByText("1KB")).toBeInTheDocument();
        expect(screen.getByText("2KB")).toBeInTheDocument();
        expect(screen.getByText("(results cached)")).toBeInTheDocument();
        expect(screen.getByText("2.206 seconds")).toBeInTheDocument();
        expect(screen.getByText("false")).toBeInTheDocument();
      });
    });

    it("should be rendered without cache", async () => {
      render(
        <Job
          metadata={{
            kind: "bigquery#job",
            etag: "XXXXXXXXXXXXXXXXXXXXXX==",
            id: "project-id-for-test:location-for-test.job-id-for-test",
            selfLink: "https://example.com",
            user_email: "user@example.iam.gserviceaccount.com",
            configuration: {
              query: {
                defaultDataset: {
                  projectId: "",
                  datasetId: "",
                },
                destinationTable: {
                  projectId: "",
                  datasetId: "",
                  tableId: "",
                },
                priority: "INTERACTIVE",
                query: "",
                writeDisposition: "WRITE_TRUNCATE",
                useLegacySql: false,
              },
              jobType: "QUERY",
            },
            jobReference: {
              projectId: "project-id-for-test",
              jobId: "job-id-for-test",
              location: "location-for-test",
            },
            statistics: {
              creationTime: "1649770220681",
              startTime: "1649770221849",
              endTime: "1649770222887",
              totalBytesProcessed: "4096",
              totalSlotMs: "",
              numChildJobs: "1",
              query: {
                totalBytesProcessed: "2048",
                totalBytesBilled: "1024",
                cacheHit: false,
                statementType: "SELECT",
                totalSlotMs: "",
              },
            },
            status: { state: "DONE" },
          }}
        />
      );
      await waitFor(() => {
        expect(
          screen.getByText(
            "project-id-for-test:location-for-test.job-id-for-test"
          )
        ).toBeInTheDocument();
        expect(
          screen.getByText("user@example.iam.gserviceaccount.com")
        ).toBeInTheDocument();
        expect(screen.getByText("1KB")).toBeInTheDocument();
        expect(screen.getByText("2KB")).toBeInTheDocument();
        expect(screen.queryByText("(results cached)")).toBeNull();
        expect(screen.getByText("2.206 seconds")).toBeInTheDocument();
        expect(screen.getByText("false")).toBeInTheDocument();
      });
    });
  });
});
