import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function useDevices() {
  return useQuery(orpc.devices.list.queryOptions({ refetchInterval: 20_000 }));
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.devices.key() });
}

export function useCreateDevice() {
  const invalidate = useInvalidate();
  return useMutation(orpc.devices.create.mutationOptions({ onSuccess: invalidate }));
}

export function useRotateToken() {
  const invalidate = useInvalidate();
  return useMutation(orpc.devices.rotateToken.mutationOptions({ onSuccess: invalidate }));
}

export function useSetDeviceActive() {
  const invalidate = useInvalidate();
  return useMutation(orpc.devices.setActive.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteDevice() {
  const invalidate = useInvalidate();
  return useMutation(orpc.devices.remove.mutationOptions({ onSuccess: invalidate }));
}
