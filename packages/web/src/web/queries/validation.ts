import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";

export function useTestCases() {
  return useQuery(orpc.validation.cases.queryOptions({ staleTime: 10_000 }));
}

export function useRuns() {
  return useQuery(orpc.validation.runs.queryOptions({ staleTime: 10_000 }));
}

export function useFieldAgreement() {
  return useQuery(orpc.validation.fieldAgreement.queryOptions({ staleTime: 30_000 }));
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: orpc.validation.key() });
}

export function useAddCase() {
  const invalidate = useInvalidate();
  return useMutation(orpc.validation.addCase.mutationOptions({ onSuccess: invalidate }));
}

export function useAddCaseFromUrl() {
  const invalidate = useInvalidate();
  return useMutation(orpc.validation.addCaseFromUrl.mutationOptions({ onSuccess: invalidate }));
}

export function useRemoveCase() {
  const invalidate = useInvalidate();
  return useMutation(orpc.validation.removeCase.mutationOptions({ onSuccess: invalidate }));
}

export function useExecuteValidation() {
  const qc = useQueryClient();
  return useMutation(
    orpc.validation.execute.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.validation.key() });
        qc.invalidateQueries({ queryKey: orpc.scans.key() });
      },
    }),
  );
}

/** Sube una imagen etiquetada al set de prueba. */
export async function uploadTestImage(file: File) {
  const { url, key } = await client.validation.presignCase({
    filename: file.name,
    contentType: file.type,
  });
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) throw new Error("No se pudo subir la imagen de prueba");
  return key;
}
