import { describe, expect, it } from "vitest";
import {
  buildTaskSectionMap,
  getLiveFocusElapsedForScope,
  sumTodayFocusSeconds,
  type CompletedTaskSlice,
  type FocusSessionSlice,
} from "@/lib/focusStats";
import { todayKey } from "@/lib/dates";

const day = todayKey();

function session(
  partial: Partial<FocusSessionSlice> & { duration_seconds: number },
): FocusSessionSlice {
  const started = `${day}T10:00:00.000Z`;
  return {
    id: partial.id ?? "s1",
    task_id: partial.task_id ?? "t1",
    started_at: partial.started_at ?? started,
    ended_at: partial.ended_at ?? started,
    duration_seconds: partial.duration_seconds,
  };
}

describe("sumTodayFocusSeconds section scope", () => {
  const tasks: CompletedTaskSlice[] = [
    {
      id: "t-work",
      duration_minutes: 25,
      completed: true,
      completed_at: `${day}T12:00:00.000Z`,
      section_id: "sec-work",
    },
    {
      id: "t-work-check",
      duration_minutes: 10,
      completed: true,
      completed_at: `${day}T12:30:00.000Z`,
      section_id: "sec-work",
    },
    {
      id: "t-personal",
      duration_minutes: 15,
      completed: true,
      completed_at: `${day}T13:00:00.000Z`,
      section_id: "sec-personal",
    },
    {
      id: "t-none",
      duration_minutes: 10,
      completed: true,
      completed_at: `${day}T14:00:00.000Z`,
      section_id: null,
    },
  ];

  const sessions: FocusSessionSlice[] = [
    session({ id: "s1", task_id: "t-work", duration_seconds: 600 }),
    session({ id: "s2", task_id: "t-personal", duration_seconds: 300 }),
  ];

  const taskSection = buildTaskSectionMap(tasks);

  it("sums all sections when no filter", () => {
    // Timed tasks use session seconds only; checkmark-only adds planned duration.
    expect(sumTodayFocusSeconds(sessions, tasks)).toBe(600 + 300 + 10 * 60 + 10 * 60);
  });

  it("sums only the requested section", () => {
    expect(
      sumTodayFocusSeconds(sessions, tasks, {
        sectionId: "sec-work",
        taskSection,
      }),
    ).toBe(600 + 10 * 60);
  });

  it("excludes unsectioned tasks from a named section", () => {
    expect(
      sumTodayFocusSeconds(sessions, tasks, {
        sectionId: "sec-personal",
        taskSection,
      }),
    ).toBe(300);
  });
});

describe("getLiveFocusElapsedForScope", () => {
  const taskSection = buildTaskSectionMap([
    { id: "t1", section_id: "sec-a" },
    { id: "t2", section_id: "sec-b" },
  ]);

  it("returns elapsed when no section filter", () => {
    expect(
      getLiveFocusElapsedForScope(
        { taskId: "t1", durationSeconds: 1500 },
        1200,
        undefined,
        taskSection,
      ),
    ).toBe(300);
  });

  it("returns zero when timer task is outside viewed section", () => {
    expect(
      getLiveFocusElapsedForScope(
        { taskId: "t2", durationSeconds: 1500 },
        1200,
        "sec-a",
        taskSection,
      ),
    ).toBe(0);
  });
});
