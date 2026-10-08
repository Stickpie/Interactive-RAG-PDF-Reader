export type Folder = {
  id: string;
  name: string;
};

export type PdfEntry = {
  id: string;
  folderId: string;
  displayName: string;
  storedStem: string | null;
};

export type Library = {
  folders: Folder[];
  pdfs: PdfEntry[];
};

export type PdfView = "original" | "simplified";
