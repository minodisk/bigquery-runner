import { getJobName, getRoutineName, getTableName, isData } from "./funcs";

describe("funcs", () => {
  describe(getJobName.name, () => {
    it("should return job name", () => {
      expect(
        getJobName({
          projectId: "foo",
          location: "bar",
          jobId: "baz",
        })
      ).toStrictEqual(`foo:bar.baz`);
    });
  });

  describe(getTableName.name, () => {
    it("should return table name", () => {
      expect(
        getTableName({
          projectId: "foo",
          datasetId: "bar",
          tableId: "baz",
        })
      ).toStrictEqual(`foo.bar.baz`);
    });
  });

  describe(getRoutineName.name, () => {
    it("should return routine name", () => {
      expect(
        getRoutineName({
          projectId: "foo",
          datasetId: "bar",
          routineId: "baz",
        })
      ).toStrictEqual(`foo.bar.baz`);
    });
  });

  describe(isData.name, () => {
    it("should return detailed type", () => {
      const data = { source: "" };
      if (isData(data)) {
        // No type error
        data.payload.event;
      }

      expect(isData({})).toBeFalsy();
      expect(isData({ source: "foo" })).toBeFalsy();
      expect(isData({ source: "bigquery-runner" })).toBeTruthy();
    });
  });
});
