import { useEffect, useRef } from "react";
import type { InquireState } from "../hooks/useReader";

type InquireDialogProps = {
  inquire: InquireState;
  onQuestionChange: (question: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function InquireDialog({ inquire, onQuestionChange, onClose, onSubmit }: InquireDialogProps) {
  const questionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inquire.open) questionRef.current?.focus();
  }, [inquire.open]);

  return (
    <div
      className={`inquire-backdrop${inquire.open ? " visible" : ""}`}
      id="inquireBackdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inquireTitle"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="inquire-panel">
        <h2 id="inquireTitle">Inquire</h2>
        <label htmlFor="segmentPreview">Highlighted text</label>
        <div className="segment-preview" id="segmentPreview">
          {inquire.segment}
        </div>
        <label htmlFor="questionInput">Your question</label>
        <textarea
          ref={questionRef}
          id="questionInput"
          rows={3}
          placeholder="Ask about the highlighted text…"
          value={inquire.question}
          onChange={(event) => onQuestionChange(event.target.value)}
        />
        <label htmlFor="answerBox">Answer</label>
        <textarea
          id="answerBox"
          readOnly
          rows={6}
          placeholder="The answer will appear here."
          value={inquire.answer}
        />
        <div className="inquire-actions">
          <button type="button" id="inquireCancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" id="inquireSubmit" disabled={inquire.submitting} onClick={onSubmit}>
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
