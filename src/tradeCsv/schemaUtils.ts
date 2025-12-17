import { FieldIndexMap } from "./schemaTypes";

export function readField(
  row: string[],
  fieldIndices: FieldIndexMap,
  field: string,
): string | undefined {
  const index = fieldIndices[field];
  return typeof index === "number" ? row[index] : undefined;
}

export function readTrimmedField(
  row: string[],
  fieldIndices: FieldIndexMap,
  field: string,
): string {
  const value = readField(row, fieldIndices, field);
  return value ? value.trim() : "";
}
