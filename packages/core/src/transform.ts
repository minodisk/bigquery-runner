import {
  BigQueryDate,
  BigQueryDatetime,
  BigQueryInt,
  BigQueryTime,
  BigQueryTimestamp,
  Geography,
} from "@google-cloud/bigquery";
import type { Primitive, Value } from "shared";

export function valueToPrimitive(value: Value): Primitive {
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (
    value instanceof BigQueryDate ||
    value instanceof BigQueryDatetime ||
    value instanceof BigQueryInt ||
    value instanceof BigQueryTime ||
    value instanceof BigQueryTimestamp ||
    value instanceof Geography
  ) {
    return value.value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  return `${value}`;
}
