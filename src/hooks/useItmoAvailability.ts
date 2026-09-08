import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useItmoAvailability() {
  const query = useQuery({
    queryKey: ["itmo-availability"],
    queryFn: async () => (await api.get<{ enabled: boolean }>("/auth/itmo/config")).data.enabled,
    staleTime: 60_000,
    retry: false,
  });
  return { enabled: query.data === true, pending: query.isPending };
}
