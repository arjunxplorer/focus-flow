import { supabase } from "@/integrations/supabase/client";
import type { Section } from "./types";

export async function fetchSections(): Promise<Section[]> {
  const { data, error } = await supabase
    .from("sections")
    .select("id,name")
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}
