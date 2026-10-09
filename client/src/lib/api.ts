const API_BASE = "/api";

type ErrorBody = {
  detail?: unknown;
  message?: string;
  answer?: unknown;
};

function errorMessage(data: ErrorBody, status: number): string {
  const detail = data.detail;
  let message = "";
  if (typeof detail === "string") {
    message = detail;
  } else if (Array.isArray(detail)) {
    message = detail
      .map((item) => {
        if (item && typeof item === "object" && "msg" in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join(" ");
  } else if (detail != null) {
    message = JSON.stringify(detail);
  }
  return message || data.message || `Request failed (${status}).`;
}

async function fetchPdfBlob(urls: string[], label: string): Promise<Blob> {
  let lastError: unknown = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) {
        lastError = new Error(`${label} fetch failed (${response.status}) at ${url}`);
        continue;
      }
      const blob = await response.blob();
      if (!blob || blob.size < 100) {
        lastError = new Error(`${label} empty/too small at ${url}`);
        continue;
      }
      return new Blob([blob], { type: "application/pdf" });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} fetch failed`);
}

export function fetchExamplePdfBlob(): Promise<Blob> {
  return fetchPdfBlob([`${API_BASE}/example-pdf`, "ExamplePDF.pdf"], "Example PDF");
}

export function fetchExampleSimplifiedPdfBlob(): Promise<Blob> {
  return fetchPdfBlob(
    [`${API_BASE}/example-pdf-simplified`, "ExamplePDF-simplified.pdf"],
    "Simplified example PDF",
  );
}

export async function deleteLibraryDocument(stem: string): Promise<void> {
  await fetch(`${API_BASE}/library-document/${encodeURIComponent(stem)}`, { method: "DELETE" });
}

export async function inquire(segment: string, question: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/inquire/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segment, question }),
    });
  } catch (error) {
    console.error(error);
    throw new Error("Could not reach the API. Is the server running?");
  }

  const data = (await response.json().catch(() => ({}))) as ErrorBody;
  if (!response.ok) {
    throw new Error(errorMessage(data, response.status));
  }
  return typeof data.answer === "string" ? data.answer : "";
}

export async function simplifyPdf(file: Blob): Promise<{ blob: Blob; stem: string | null }> {
  const formData = new FormData();
  const filename = file instanceof File && file.name ? file.name : "upload.pdf";
  formData.append("file", file, filename);

  const response = await fetch(`${API_BASE}/simplify-pdf/`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Failed to simplify PDF.");
  }

  return {
    stem: response.headers.get("X-Stored-Stem"),
    blob: await response.blob(),
  };
}
