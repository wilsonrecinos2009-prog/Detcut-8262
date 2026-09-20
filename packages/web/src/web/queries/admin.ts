import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useMe(enabled = true) {
  return useQuery(orpc.admin.me.queryOptions({ enabled, staleTime: 60_000, retry: false }));
}

export function useSettings() {
  return useQuery(orpc.admin.settings.queryOptions({ staleTime: 60_000 }));
}

export function useUsers(enabled: boolean) {
  return useQuery(orpc.admin.users.queryOptions({ enabled, retry: false }));
}

export function useAudit(enabled: boolean) {
  return useQuery(orpc.admin.audit.queryOptions({ enabled, retry: false }));
}

export function useSetRole() {
  const qc = useQueryClient();
  return useMutation(
    orpc.admin.setRole.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.admin.key() }),
    }),
  );
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation(
    orpc.admin.updateSettings.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.admin.key() }),
    }),
  );
}
