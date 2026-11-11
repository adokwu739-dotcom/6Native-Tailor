import { useEffect, useState } from "react";

export type MediaAsset = {
  id: string;
  filename: string;
  url: string;
  alt: string;
  slot: string;
  uploaded_at: string;
};

export const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    credentials: "include",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export function useManagedMedia() {
  const [assets, setAssets] = useState<MediaAsset[]>([]);

  useEffect(() => {
    let active = true;
    apiRequest<MediaAsset[]>("/api/media")
      .then((result) => {
        if (active) setAssets(result);
      })
      .catch(() => {
        if (active) setAssets([]);
      });
    return () => {
      active = false;
    };
  }, []);

  return assets;
}

export function imageForSlot(assets: MediaAsset[], slot: string, fallback: string) {
  return assets.find((asset) => asset.slot === slot)?.url ?? fallback;
}
