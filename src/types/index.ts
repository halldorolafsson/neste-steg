export type EnergyLevel = "LOW" | "MEDIUM" | "HIGH";
export type LocationType = string;
export type Priority = "LOW" | "MEDIUM" | "HIGH";
export type TaskStatus = "INBOX" | "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED";

export interface UserContext {
  availableMinutes: number;
  energyLevel: EnergyLevel;
  locationType: LocationType;
}

export interface TaskScore {
  taskId: string;
  score: number;
  reasons: string[];
}
