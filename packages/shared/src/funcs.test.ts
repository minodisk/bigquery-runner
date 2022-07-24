import {
  commas,
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

  describe(commas.name, () => {
    it("should add comma every three digits", () => {
      expect(commas("1")).toBe("1");
      expect(commas("12")).toBe("12");
      expect(commas("123")).toBe("123");
      expect(commas("1234")).toBe("1,234");
      expect(commas("12345")).toBe("12,345");
      expect(commas("123456")).toBe("123,456");
      expect(commas("1234567")).toBe("1,234,567");
      expect(commas("123000")).toBe("123,000");
    });
  });
});
