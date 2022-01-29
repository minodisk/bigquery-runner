import { Value } from "./types";

export function valueToPrimitive(
  value: Value
): null | number | string | boolean {
  // console.log(
  //   primitive,
  //   primitive?.toString(),
  //   Object.prototype.toString.call(primitive)
  // );
  // console.log(value.toJSON());
  if (
    value === null ||
    typeof value === "number" ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Buffer.isBuffer(value)) {
    return value.toString();
  }
  if (typeof value === "bigint" || value instanceof BigInt) {
    return `${value}`;
  }
  if (value.value) {
    return `${value.value}`;
  }
  return `${value}`;
}
