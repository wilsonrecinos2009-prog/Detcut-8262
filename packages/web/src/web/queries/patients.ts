import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

export function usePatients(q?: string) {
  return useQuery(orpc.patients.list.queryOptions({ input: { q }, staleTime: 10_000 }));
}

export function usePatient(id: number) {
  return useQuery(orpc.patients.get.queryOptions({ input: { id }, staleTime: 5_000 }));
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: orpc.patients.key() });
    qc.invalidateQueries({ queryKey: orpc.scans.key() });
  };
}

export function useCreatePatient() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.create.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdatePatient() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.update.mutationOptions({ onSuccess: invalidate }));
}

export function useCreateLesion() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.createLesion.mutationOptions({ onSuccess: invalidate }));
}

export function useUpdateLesionStatus() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.updateLesionStatus.mutationOptions({ onSuccess: invalidate }));
}

export function useAssignScan() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.assignScan.mutationOptions({ onSuccess: invalidate }));
}

export function useDeletePatient() {
  const invalidate = useInvalidate();
  return useMutation(orpc.patients.remove.mutationOptions({ onSuccess: invalidate }));
}
