import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import type { Value } from "shared";
import { valueToPrimitive } from "./transform";

describe("transform", () => {
  describe("valueToPrimitive", () => {
    const cases: Array<
      Readonly<{
        message: string;
        value: Value;
        expected: null | boolean | number | string;
      }>
    > = [
      {
        message: "should return boolean when boolean is input",
        value: true,
        expected: true,
      },
      {
        message: "should return number when number is input",
        value: 123.45,
        expected: 123.45,
      },
      {
        message: "should return string when string is input",
        value: "foo",
        expected: "foo",
      },
      {
        message: "should return null when null is input",
        value: null,
        expected: null,
      },
      {
        message: "should return number when BigInt is input",
        value: BigInt("99999999999999999999"),
        expected: "99999999999999999999",
      },
      {
        message: "should return string when Buffer is input",
        value: Buffer.from("foo"),
        expected: "foo",
      },
      {
        message: "should return string when BigQueryDate is input",
        value: new Geography("POINT(-70.8754261 42.0625498)"),
        expected: "POINT(-70.8754261 42.0625498)",
      },
      {
        message: "should return string when BigQueryDate is input",
        value: new BigQueryDate("2006-01-02"),
        expected: "2006-01-02",
      },
      {
        message: "should return string when BigQueryDatetime is input",
        value: new BigQueryDatetime("2006-01-02T15:04:05Z"),
        expected: "2006-01-02 15:04:05",
      },
      {
        message: "should return string when BigQueryInt is input",
        value: new BigQueryInt(10),
        expected: "10",
      },
      {
        message: "should return string when BigQueryTime is input",
        value: new BigQueryTime("15:04:05"),
        expected: "15:04:05",
      },
      {
        message: "should return string when BigQueryTimestamp is input",
        value: new BigQueryTimestamp("2006-01-02T15:04:05Z"),
        expected: "2006-01-02T15:04:05.000Z",
      },
    ];
    cases.forEach(({ message, value, expected }) =>
      it(message, () => {
        expect(valueToPrimitive(value)).toStrictEqual(expected);
      })
    );
  });
});
