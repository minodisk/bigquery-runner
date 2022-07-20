import {
  comma,
  getJobName,
  getRoutineName,
  getTableName,
  isData,
} from "./funcs";

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

  describe(comma.name, () => {
    it("should add comma every three digits", () => {
      expect(comma("0")).toBe("0");
      expect(comma("10")).toBe("10");
      expect(comma("100")).toBe("100");
      expect(comma("1000")).toBe("1,000");
      expect(comma("10000")).toBe("10,000");
      expect(comma("100000")).toBe("100,000");
      expect(comma("1000000")).toBe("1,000,000");
    });
  });
});
