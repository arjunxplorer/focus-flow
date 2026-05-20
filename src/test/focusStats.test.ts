import { describe, expect, it } from "vitest";
import {
  buildTaskSectionMap,
  countTasksDoneToday,
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

describe("sumTodayFocusSeconds", () => {
  const sessions: FocusSessionSlice[] = [
    session({ id: "s1", task_id: "t-work", duration_seconds: 600 }),
    session({ id: "s2", task_id: "t-personal", duration_seconds: 300 }),
  ];

  const taskSection = buildTaskSectionMap([
    { id: "t-work", section_id: "sec-work" },
    { id: "t-personal", section_id: "sec-personal" },
  ]);

  it("counts session seconds only", () => {
    expect(sumTodayFocusSeconds(sessions, { taskSection })).toBe(900);
  });

  it("filters by section", () => {
    expect(
      sumTodayFocusSeconds(sessions, {
        sectionId: "sec-work",
        taskSection,
      }),
    ).toBe(600);
  });
});

describe("countTasksDoneToday", () => {
  const tasks: CompletedTaskSlice[] = [
    {
      id: "t1",
      duration_minutes: 25,
      completed: true,
      completed_at: `${day}T12:00:00.000Z`,
      section_id: "sec-work",
    },
    {
      id: "t2",
      duration_minutes: 15,
      completed: true,
      completed_at: `${day}T13:00:00.000Z`,
      section_id: "sec-personal",
    },
    {
      id: "t3",
      duration_minutes: 10,
      completed: false,
      completed_at: null,
      section_id: "sec-work",
    },
  ];

  it("counts completed tasks today", () => {
    expect(countTasksDoneToday(tasks)).toBe(2);
  });

  it("filters by section", () => {
    expect(countTasksDoneToday(tasks, { sectionId: "sec-work" })).toBe(1);
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
