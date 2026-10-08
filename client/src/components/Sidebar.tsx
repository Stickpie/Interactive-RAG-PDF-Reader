import type { Folder, PdfEntry } from "../types";

type SidebarProps = {
  folders: Folder[];
  pdfs: PdfEntry[];
  selectedFolderId: string | null;
  selectedPdfId: string | null;
  onAddFolder: () => void;
  onSelectFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onSelectPdf: (pdfId: string) => void;
  onDeletePdf: (pdfId: string) => void;
  onUpload: () => void;
  onClose: () => void;
};

export function Sidebar({
  folders,
  pdfs,
  selectedFolderId,
  selectedPdfId,
  onAddFolder,
  onSelectFolder,
  onDeleteFolder,
  onSelectPdf,
  onDeletePdf,
  onUpload,
  onClose,
}: SidebarProps) {
  return (
    <aside className="sidebar" id="sidebar" aria-label="Document library">
      <div className="sidebar-head">
        <span>Library</span>
        <button type="button" id="sidebarCloseBtn" className="sidebar-close-btn" aria-label="Close library" onClick={onClose}>
          ×
        </button>
        <button type="button" id="addFolderBtn" title="Add folder" onClick={onAddFolder}>
          +
        </button>
      </div>
      <div id="folderList" className="folder-list-root">
        {folders.map((folder) => {
          const folderPdfs = pdfs.filter((pdf) => pdf.folderId === folder.id);
          return (
            <div className="folder-block" key={folder.id}>
              <div
                className={`folder-row${folder.id === selectedFolderId ? " selected-folder" : ""}`}
                onClick={() => onSelectFolder(folder.id)}
              >
                <span className="folder-name">{folder.name}</span>
                {folderPdfs.length === 0 && (
                  <button
                    type="button"
                    className="folder-del"
                    title="Delete empty folder"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDeleteFolder(folder.id);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <ul className="pdf-list">
                {folderPdfs.map((pdf) => (
                  <li
                    key={pdf.id}
                    className={pdf.id === selectedPdfId ? "selected-pdf" : undefined}
                    onClick={() => onSelectPdf(pdf.id)}
                  >
                    <span className="pdf-title">{pdf.displayName}</span>
                    <button
                      type="button"
                      className="pdf-del"
                      title="Remove PDF"
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDeletePdf(pdf.id);
                      }}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <button type="button" id="mobileUploadBtn" className="sidebar-upload-btn" onClick={onUpload}>
        + Upload New Document
      </button>
      <p className="sidebar-close-hint">Tap outside or X to close</p>
    </aside>
  );
}
