import {
  checkAuthentication,
  createQueryJob,
  getPage,
  toSerializablePage,
} from "./bigquery";

describe("bigquery", () => {
  describe("checkAuthentication", () => {
    it("should pass with valid setting", async () => {
      const getProjectId = jest.fn(() => Promise.resolve("PROJECT ID"));
      const result = await checkAuthentication({
        keyFilename: "XXXXX",
        getProjectId,
      });
      expect(result.success).toBeTruthy();
      expect(result.value).toEqual("PROJECT ID");
    });

    it("should fail invalid keyFilename", async () => {
      const getProjectId = jest.fn(() =>
        Promise.reject(
          new Error("Unable to detect a Project ID in the current environment.")
        )
      );
      const result = await checkAuthentication({
        keyFilename: "XXXXX",
        getProjectId,
      });
      expect(result.success).toBeFalsy();
      expect(result.value).toEqual({
        type: "Authentication",
        reason: `Bad authentication: Make sure that "XXXXX", which is set in bigqueryRunner.keyFilename of setting.json, is the valid path to service account key file`,
      });
    });

    it("should fail without keyFilename", async () => {
      const getProjectId = jest.fn(() =>
        Promise.reject(
          new Error("Unable to detect a Project ID in the current environment.")
        )
      );
      const result = await checkAuthentication({
        getProjectId,
      });
      expect(result.success).toBeFalsy();
      expect(result.value).toEqual({
        type: "Authentication",
        reason: `Bad authentication: Set bigqueryRunner.keyFilename of your setting.json to the valid path to service account key file`,
      });
    });

    it("should fail with unknown error", async () => {
      const getProjectId = jest.fn(() => Promise.reject(new Error("foo")));
      const result = await checkAuthentication({
        getProjectId,
      });
      expect(result.success).toBeFalsy();
      expect(result.value).toEqual({
        type: "Unknown",
        reason: `foo`,
      });
    });
  });

  describe("createQueryJob", () => {
    it("should return job", async () => {
      const options = { dryRun: false };
      const job = {};
      const createQueryJobMock = jest.fn(() => Promise.resolve([job] as any));
      const result = await createQueryJob({
        createQueryJob: createQueryJobMock,
        options,
      });
      expect(createQueryJobMock).toBeCalledWith(options);
      expect(result.success).toBeTruthy();
      expect(result.value).toStrictEqual(job);
    });

    it("should fail with no position error", async () => {
      const options = { dryRun: false };
      const createQueryJobMock = jest.fn(() =>
        Promise.reject(new Error("foo"))
      );
      const result = await createQueryJob({
        createQueryJob: createQueryJobMock,
        options,
      });
      expect(createQueryJobMock).toBeCalledWith(options);
      expect(result.success).toBeFalsy();
      expect(result.value).toStrictEqual({
        type: "Query",
        reason: "foo",
      });
    });

    it("should fail with a position but no suggestion error", async () => {
      const options = { dryRun: false };
      const createQueryJobMock = jest.fn(() =>
        Promise.reject(new Error("foo bar baz at [3:40]"))
      );
      const result = await createQueryJob({
        createQueryJob: createQueryJobMock,
        options,
      });
      expect(createQueryJobMock).toBeCalledWith(options);
      expect(result.success).toBeFalsy();
      expect(result.value).toStrictEqual({
        type: "QueryWithPosition",
        reason: "foo bar baz",
        position: { line: 2, character: 39 },
      });
    });

    it("should fail with a position and a suggestion error", async () => {
      const options = { dryRun: false };
      const createQueryJobMock = jest.fn(() =>
        Promise.reject(
          new Error("Unrecognized name: foo; Did you mean bar? at [3:40]")
        )
      );
      const result = await createQueryJob({
        createQueryJob: createQueryJobMock,
        options,
      });
      expect(createQueryJobMock).toBeCalledWith(options);
      expect(result.success).toBeFalsy();
      expect(result.value).toStrictEqual({
        type: "QueryWithPosition",
        reason: "Unrecognized name: foo; Did you mean bar?",
        position: { line: 2, character: 39 },
        suggestion: {
          before: "foo",
          after: "bar",
        },
      });
    });
  });

  // Since just-worker uses JSON in its messaging interface,
  // it must be asserted in a serializable state.
  // Therefore, not only getPage but also toSerializablePage is tested.
  describe("getPage and toSerializablePage", () => {
    it("should return 1st page without prevPage", () => {
      expect(
        toSerializablePage(
          getPage({
            totalRows: "99999",
            rows: 100,
          })
        )
      ).toStrictEqual({
        hasPrev: false,
        hasNext: false,
        startRowNumber: "1",
        endRowNumber: "100",
        totalRows: "99999",
      });
    });

    it("should return n-th page with prevPage", () => {
      expect(
        toSerializablePage(
          getPage({
            totalRows: "99999",
            rows: 100,
            prevPage: { endRowNumber: 831n },
          })
        )
      ).toStrictEqual({
        hasPrev: true,
        hasNext: false,
        startRowNumber: "832",
        endRowNumber: "931",
        totalRows: "99999",
      });
    });

    it("should return hasNext true with nextPageToken", () => {
      expect(
        toSerializablePage(
          getPage({
            totalRows: "99999",
            rows: 100,
            nextPageToken: "XXXXXXXXXX",
          })
        )
      ).toStrictEqual({
        hasPrev: false,
        hasNext: true,
        startRowNumber: "1",
        endRowNumber: "100",
        totalRows: "99999",
      });
    });
  });
});
