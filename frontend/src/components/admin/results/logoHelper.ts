import schoolLogoUrl from "@/assets/logo.png";
import fudmaLogoUrl from "@/assets/fudma_logo.png";

export interface LoadedLogos {
  schoolBase64: string;
  schoolBuffer: ArrayBuffer;
  fudmaBase64: string;
  fudmaBuffer: ArrayBuffer;
}

let cachedLogos: LoadedLogos | null = null;

async function fetchAssetData(url: string): Promise<{ base64: string; buffer: ArrayBuffer }> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    return { base64, buffer };
  } catch (err) {
    console.warn("Failed to load asset from:", url, err);
    return { base64: "", buffer: new ArrayBuffer(0) };
  }
}

export async function getLoadedLogos(): Promise<LoadedLogos> {
  if (cachedLogos && cachedLogos.schoolBase64 && cachedLogos.fudmaBase64) {
    return cachedLogos;
  }

  const [school, fudma] = await Promise.all([
    fetchAssetData(schoolLogoUrl),
    fetchAssetData(fudmaLogoUrl),
  ]);

  cachedLogos = {
    schoolBase64: school.base64,
    schoolBuffer: school.buffer,
    fudmaBase64: fudma.base64,
    fudmaBuffer: fudma.buffer,
  };

  return cachedLogos;
}

export { schoolLogoUrl, fudmaLogoUrl };

