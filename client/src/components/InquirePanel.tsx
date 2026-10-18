import { useEffect, useRef } from "react";
import type { InquireState } from "../hooks/useReader";

type InquirePanelProps = {
  inquire: InquireState;
  onQuestionChange: (question: string) => void;
  onSubmit: () => void;
  onToggleCollapsed: () => void;
  onHighlight: (text: string) => void;
};

function nodeElement(node: Node | null): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
}

function highlightedPassage(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString().trim();
  if (!text) return null;
  const anchor = nodeElement(selection.anchorNode);
  const focus = nodeElement(selection.focusNode);
  if (!anchor || !focus) return null;
  const fromAi = anchor.closest("[data-ai-response]") && focus.closest("[data-ai-response]");
  const fromPdf = anchor.closest("#pdf-pages") && focus.closest("#pdf-pages");
  if (!fromAi && !fromPdf) return null;
  return text;
}

export function InquirePanel({
  inquire,
  onQuestionChange,
  onSubmit,
  onToggleCollapsed,
  onHighlight,
}: InquirePanelProps) {
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const onHighlightRef = useRef(onHighlight);
  onHighlightRef.current = onHighlight;

  useEffect(() => {
    if (!inquire.panelCollapsed && inquire.segment) {
      questionRef.current?.focus({ preventScroll: true });
    }
  }, [inquire.highlightNonce, inquire.panelCollapsed, inquire.segment]);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [inquire.turns]);

  useEffect(() => {
    let timer = 0;
    const capture = () => {
      const text = highlightedPassage();
      if (text) onHighlightRef.current(text);
    };
    const onTouchEnd = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(capture, 50);
    };
    document.addEventListener("mouseup", capture);
    document.addEventListener("touchend", onTouchEnd);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseup", capture);
      document.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  const collapsed = inquire.panelCollapsed;

  return (
    <aside className={`inquire-side${collapsed ? " collapsed" : ""}`} aria-label="Inquire">
      <div className="inquire-side-head">
        {collapsed ? (
          <button
            type="button"
            className="inquire-collapse"
            aria-expanded={false}
            aria-label="Expand inquire panel"
            onClick={onToggleCollapsed}
          >
            <span className="inquire-collapse-icon" aria-hidden="true">
              ‹
            </span>
            <span className="inquire-collapse-label">Inquire</span>
          </button>
        ) : (
          <>
            <h2 id="inquireSideTitle">Inquire</h2>
            <button
              type="button"
              className="inquire-collapse"
              aria-expanded
              aria-label="Collapse inquire panel"
              onClick={onToggleCollapsed}
            >
              ›
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <>
          <div className="inquire-log" ref={logRef} role="log" aria-live="polite" aria-relevant="additions text">
            {inquire.turns.length === 0 ? (
              <p className="inquire-log-empty">No questions yet.</p>
            ) : (
              inquire.turns.map((turn) => (
                <div className="inquire-turn" key={turn.id}>
                  <div className="inquire-bubble user">{turn.question}</div>
                  <div
                    className={`inquire-bubble ai${turn.answer.startsWith("Loading") ? " pending" : ""}`}
                    data-ai-response=""
                  >
                    {turn.answer}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="inquire-dock">
            <section
              className={`highlight-card${inquire.segment ? "" : " is-minimized"}`}
              aria-label="Highlighted text"
            >
              <h3>Highlighted text</h3>
              {inquire.segment ? (
                <div className="highlight-card-body">{inquire.segment}</div>
              ) : (
                <p className="highlight-card-hint">Select text from PDF or AI responses</p>
              )}
            </section>

            {inquire.notice ? (
              <p className="inquire-notice" role="status">
                {inquire.notice}
              </p>
            ) : null}

            <form
              className="inquire-composer"
              onSubmit={(event) => {
                event.preventDefault();
                if (!inquire.submitting) onSubmit();
              }}
            >
              <textarea
                ref={questionRef}
                id="inquireQuestion"
                rows={2}
                aria-label="Your question"
                placeholder="Ask about the highlighted text…"
                value={inquire.question}
                onChange={(event) => onQuestionChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (!inquire.submitting) onSubmit();
                  }
                }}
              />
              <button type="submit" className="inquire-ask" disabled={inquire.submitting}>
                Ask
              </button>
            </form>
          </div>
        </>
      )}
    </aside>
  );
}
