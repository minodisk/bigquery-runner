import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { JobInformation } from "./JobInformation";

describe("JobInformation", () => {
  describe("metadata", () => {
    it("should be rendered", async () => {
      render(
        <JobInformation
          metadata={{
            kind: "bigquery#job",
            etag: "XXXXXXXXXXXXXXXXXXXXXX==",
            id: "project-id-for-test:location-for-test.job-id-for-test",
            selfLink: "https://example.com",
            user_email: "user@example.iam.gserviceaccount.com",
            configuration: {
              query: {
                query: "",
                destinationTable: {
                  projectId: "",
                  datasetId: "",
                  tableId: "",
                },
                writeDisposition: "WRITE_TRUNCATE",
                priority: "INTERACTIVE",
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
              query: {
                totalBytesProcessed: "2048",
                totalBytesBilled: "1024",
                cacheHit: true,
                statementType: "SELECT",
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
  });
});
