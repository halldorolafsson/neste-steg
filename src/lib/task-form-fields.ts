export const optionalTaskFields = ["description", "assetId", "priority", "energyLevel", "estimatedMinutes", "locationType", "dueDate"] as const;
export type OptionalTaskField = typeof optionalTaskFields[number];
export const defaultTaskFields: OptionalTaskField[] = ["description", "priority", "dueDate"];
export const taskFieldLabels = {
  description: "description", assetId: "asset", priority: "priority", energyLevel: "energy",
  estimatedMinutes: "estimatedTime", locationType: "location", dueDate: "dueDate",
} as const;

export function resolveTaskFields(value: string | null | undefined): OptionalTaskField[] {
  if (value == null) return [...defaultTaskFields];
  try {
    const fields: unknown = JSON.parse(value);
    if (!Array.isArray(fields)) return [...defaultTaskFields];
    return optionalTaskFields.filter((field) => fields.includes(field));
  } catch {
    return [...defaultTaskFields];
  }
}
