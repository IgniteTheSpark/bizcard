import { useState } from "react";
import { Send, StopCircle } from "lucide-react";

/**
 * ChatInput — single-line growable textarea + send button.
 *
 * Enter        — send (without Shift)
 * Shift+Enter  — newline (without sending)
 */

interface ChatInputProps {
  onSend: (text: string) => void;
  /** True while a stream is in flight — disables send + shows stop button */
  streaming?: boolean;
  /** Reserved: stop the current stream (future — backend doesn't support abort yet) */
  onStop?: () => void;
  placeholder?: string;
}

export function ChatInput({ onSend, streaming, placeholder }: ChatInputProps) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    onSend(trimmed);
    setText("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // nativeEvent.isComposing → true while IME composing CJK chars; avoid
    // submitting mid-composition
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-eu-rule bg-eu-bg/70 backdrop-blur px-eu-md py-eu-sm">
      <div className="flex items-end gap-eu-sm max-w-3xl mx-auto">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder ?? "问 Agent 任何事…(Enter 发送 / Shift+Enter 换行)"}
          rows={1}
          className={[
            "flex-1 resize-none",
            "min-h-[40px] max-h-32",
            "bg-eu-surface border border-eu-border rounded-eu-md",
            "px-eu-md py-eu-sm text-eu-base text-eu-text",
            "placeholder:text-eu-text-muted",
            "focus:outline-none focus:border-eu-brand",
            "transition-colors duration-eu-fast",
          ].join(" ")}
        />
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim() || streaming}
          aria-label="发送"
          className={[
            "shrink-0 h-10 w-10 rounded-eu-md",
            "flex items-center justify-center",
            "bg-eu-brand text-white hover:bg-eu-brand-hi",
            "disabled:opacity-40 disabled:cursor-not-allowed",
            "transition-all duration-eu-fast active:scale-95",
          ].join(" ")}
        >
          {streaming ? <StopCircle size={18} /> : <Send size={16} strokeWidth={2} />}
        </button>
      </div>
    </div>
  );
}
