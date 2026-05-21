import { supabase } from "@/integrations/supabase/client";
import type { TaskWithSection } from "./types";

export async function fetchTaskWithSection(taskId: string): Promise<TaskWithSection | null> {
  const { data, error } = await supabase
    .from("tasks")
    .select("id,title,duration_minutes,section_id, sections(name)")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const sectionJoin = data.sections as { name: string } | { name: string }[] | null;
  const sectionName = Array.isArray(sectionJoin)
    ? sectionJoin[0]?.name ?? null
    : sectionJoin?.name ?? null;

  return {
    id: data.id,
    title: data.title,
    duration_minutes: data.duration_minutes,
    section_id: data.section_id,
    section_name: sectionName,
  };
}
