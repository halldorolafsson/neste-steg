import { Task } from "@prisma/client";
import { UserContext, TaskScore } from "@/types";
import { differenceInDays } from "date-fns";

export function scoreTask(task: Task, context: UserContext): TaskScore {
  let score = 0;
  const reasons: string[] = [];

  // Time match: task fits within available time
  if (task.estimatedMinutes) {
    if (task.estimatedMinutes <= context.availableMinutes) {
      score += 20;
      reasons.push("Passer i tilgjengelig tid");
    } else if (task.estimatedMinutes > context.availableMinutes * 1.5) {
      score -= 15;
      reasons.push("Tar mye lengre tid enn tilgjengelig");
    }
  } else {
    score += 5; // Unknown duration gets slight boost
  }

  // Energy match
  if (task.energyLevel === context.energyLevel) {
    score += 20;
    reasons.push("Matcher energinivå");
  } else if (
    (task.energyLevel === "HIGH" && context.energyLevel === "LOW") ||
    (task.energyLevel === "LOW" && context.energyLevel === "HIGH")
  ) {
    score -= 10;
    reasons.push("Mismatch på energi");
  }

  // Location match
  if (task.locationType === "ANYWHERE" || task.locationType === context.locationType) {
    score += 20;
    reasons.push("Matcher sted");
  } else {
    score -= 15;
    reasons.push("Feil sted for oppgaven");
  }

  // Priority
  if (task.priority === "HIGH") {
    score += 15;
    reasons.push("Høy prioritet");
  } else if (task.priority === "MEDIUM") {
    score += 5;
  }

  // Due date proximity
  if (task.dueDate) {
    const daysUntilDue = differenceInDays(task.dueDate, new Date());
    if (daysUntilDue <= 1) {
      score += 20;
      reasons.push("Frist i dag/i morgen");
    } else if (daysUntilDue <= 3) {
      score += 15;
      reasons.push("Frist snart");
    } else if (daysUntilDue <= 7) {
      score += 5;
    }
  }

  // Age: how long the task has been sitting
  const daysOld = differenceInDays(new Date(), task.createdAt);
  if (daysOld > 14) {
    score += 10;
    reasons.push("Har ligget lenge");
  } else if (daysOld > 7) {
    score += 5;
  }

  // Snooze penalty
  if (task.snoozeCount >= 3) {
    score += 10;
    reasons.push("Utsatt flere ganger");
  } else if (task.snoozeCount >= 1) {
    score += 5;
  }

  // Quick win bonus
  if (task.estimatedMinutes && task.estimatedMinutes <= 15) {
    score += 5;
    reasons.push("Rask oppgave");
  }

  return { taskId: task.id, score, reasons };
}

export function getRecommendations<T extends Task>(tasks: T[], context: UserContext) {
  const scored = tasks
    .filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS")
    .filter((t) => !t.snoozedUntil || new Date(t.snoozedUntil) <= new Date())
    .map((t) => ({ task: t, ...scoreTask(t, context) }))
    .sort((a, b) => b.score - a.score);

  const top3 = scored.slice(0, 3);

  const quickTasks = scored
    .filter((s) => s.task.estimatedMinutes && s.task.estimatedMinutes <= 15)
    .slice(0, 5);

  const neglected = scored
    .filter((s) => differenceInDays(new Date(), s.task.createdAt) > 14)
    .sort((a, b) => differenceInDays(new Date(), b.task.createdAt) - differenceInDays(new Date(), a.task.createdAt))[0];

  return { top3, quickTasks, neglected };
}
