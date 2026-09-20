import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { client, orpc } from "../lib/api";

export function useDashboard() {
  return useQuery(orpc.scans.dashboard.queryOptions({ staleTime: 15_000 }));
}

export function useScans(filters?: { triage?: string; source?: string }) {
  return useQuery(orpc.scans.list.queryOptions({ input: filters ?? {}, staleTime: 10_000 }));
}

export function useScan(id: number) {
  return useQuery(orpc.scans.get.queryOptions({ input: { id }, staleTime: 30_000 }));
}

export function useTaxonomy() {
  return useQuery(orpc.scans.taxonomy.queryOptions({ staleTime: 300_000 }));
}

export function useDeviceFeed(enabled: boolean) {
  return useQuery(
    orpc.scans.pending.queryOptions({ refetchInterval: enabled ? 4000 : false, enabled }),
  );
}

export function useAnalyze() {
  const qc = useQueryClient();
  return useMutation(
    orpc.scans.analyze.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.scans.key() });
        qc.invalidateQueries({ queryKey: orpc.patients.key() });
      },
    }),
  );
}

export function useAnalyzeCamera() {
  const qc = useQueryClient();
  return useMutation(
    orpc.scans.analyzeBase64.mutationOptions({
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: orpc.scans.key() });
        qc.invalidateQueries({ queryKey: orpc.patients.key() });
      },
    }),
  );
}

export function useReviewScan() {
  const qc = useQueryClient();
  return useMutation(
    orpc.scans.review.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.scans.key() }),
    }),
  );
}

export function useDeleteScan() {
  const qc = useQueryClient();
  return useMutation(
    orpc.scans.remove.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.scans.key() }),
    }),
  );
}

/** Sube el archivo al almacenamiento y devuelve su clave. */
export async function uploadImage(file: File) {
  const { url, key } = await client.upload.presign({ filename: file.name, contentType: file.type });
  const res = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
  if (!res.ok) throw new Error("No se pudo subir la imagen");
  return key;
}

export async function downloadCsv() {
  const { csv, count } = await client.scans.exportCsv({});
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `detcut-diagnosticos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  return count;
}
