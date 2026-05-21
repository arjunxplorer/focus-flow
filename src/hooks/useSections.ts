import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/queries/keys";
import { fetchSections } from "@/lib/queries/sections";

export function useSections() {
  const { user } = useAuth();
  const userId = user?.id;

  return useQuery({
    queryKey: queryKeys.sections(userId),
    queryFn: fetchSections,
    enabled: !!userId,
  });
}
