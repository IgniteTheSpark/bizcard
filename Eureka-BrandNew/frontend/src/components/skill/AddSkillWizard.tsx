import { useState } from "react";
import { Check, Loader2, RotateCcw, Sparkles, Wand2, X } from "lucide-react";
import { useSWRConfig } from "swr";

import { useModalMount } from "@/context/ModalContext";
import { ApiError, apiFetch } from "@/lib/api";
import { buildCard } from "@/lib/render-spec";
import type { AccentColor, RenderSpec } from "@/lib/render-spec";
import { SkillCard } from "@/components/skill/SkillCard";

/**
 * AddSkillWizard — M5. "由 AI 帮你设计卡片".
 *
 * 4-step flow (Phase D §二.1): 描述 → 生成 → 预览 → 注册.
 *
 *   describe : user types a natural-language description of what they want to
 *              track ("我想记录跑步训练").
 *   generate : POST /api/skills { description } → the backend design_agent
 *              (Gemini, structured output) returns a draft skill —
 *              { name, display_name, payload_schema, render_spec, sample_payload }.
 *   preview  : render a LIVE SkillCard from draft.render_spec + sample_payload
 *              (same interpreter the rest of the app uses), show the captured
 *              fields, and let the user tweak display_name / icon / accent.
 *   register : POST /api/skills/confirm → creates the UserSkill, refresh the
 *              registry, close. 409 → "已存在同名技能".
 *
 * Same bottom-sheet shell as ContactForm / EventForm so it feels native to the
 * iPhone-frame app.
 */

interface SkillDraft {
  name: string;
  display_name: string;
  payload_schema: Record<string, unknown>;
  render_spec: RenderSpec;
  sample_payload: Record<string, unknown>;
}

interface AddSkillWizardProps {
  onClose: () => void;
  onCreated?: (name: string) => void;
}

const ACCENT_SWATCH: Record<AccentColor, string> = {
  blue:    "#6f9eff",
  amber:   "#f0b86f",
  green:   "#6fe0a0",
  red:     "#ff8a8a",
  purple:  "#c4a8ff",
  gray:    "#9aa3b2",
  neutral: "#c8ced8",
};
const ACCENTS = Object.keys(ACCENT_SWATCH) as AccentColor[];

const EXAMPLES = ["跑步训练记录", "读书笔记", "每天喝水量", "面试复盘"];

export function AddSkillWizard(props: AddSkillWizardProps) {
  useModalMount();
  return <Body {...props} />;
}

function Body({ onClose, onCreated }: AddSkillWizardProps) {
  const { mutate } = useSWRConfig();

  const [step, setStep] = useState<"describe" | "preview">("describe");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false); // generating (describe) / confirming (preview)
  const [error, setError] = useState<string | null>(null);

  const [draft, setDraft] = useState<SkillDraft | null>(null);
  // Editable overrides applied on top of the AI draft in the preview step.
  const [displayName, setDisplayName] = useState("");
  const [accent, setAccent] = useState<AccentColor>("blue");
  const [icon, setIcon] = useState("");

  async function generate() {
    const desc = description.trim();
    if (!desc || busy) return;
    setBusy(true);
    setError(null);
    try {
      const resp = await apiFetch<{ ok: boolean; draft?: SkillDraft; error?: string }>(
        "/api/skills",
        { method: "POST", body: { description: desc }, timeoutMs: 60_000 },
      );
      if (!resp.ok || !resp.draft) throw new Error(resp.error ?? "生成失败,请重试");
      const d = resp.draft;
      setDraft(d);
      setDisplayName(d.display_name ?? "");
      setAccent(d.render_spec?.accent_color ?? "blue");
      setIcon(d.render_spec?.icon ?? "•");
      setStep("preview");
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!draft || busy) return;
    setBusy(true);
    setError(null);
    try {
      const render_spec: RenderSpec = { ...draft.render_spec, accent_color: accent, icon };
      const resp = await apiFetch<{ ok: boolean; user_skill_id?: string; name?: string; error?: string }>(
        "/api/skills/confirm",
        {
          method: "POST",
          body: {
            name: draft.name,
            display_name: displayName.trim() || draft.display_name,
            payload_schema: draft.payload_schema,
            render_spec,
            queryable_fields: [],
          },
        },
      );
      if (!resp.ok) throw new Error(resp.error ?? "注册失败");
      await mutate((key) => typeof key === "string" && key.startsWith("/api/skills"));
      onCreated?.(draft.name);
      onClose();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setError("已存在同名技能 — 换个描述再生成。");
      } else {
        setError(errMsg(e));
      }
      setBusy(false);
    }
  }

  function backToDescribe() {
    setStep("describe");
    setError(null);
  }

  // Live preview card: feed the (possibly tweaked) spec + the AI's sample
  // payload through the same interpreter the real cards use.
  const previewCard =
    draft &&
    buildCard({
      payload: draft.sample_payload ?? {},
      spec: { ...draft.render_spec, accent_color: accent, icon },
      assetId: null,
      cardType: draft.name,
      displayName: displayName || draft.display_name,
    });

  return (
    <div
      className="fixed inset-0 z-50 bg-eu-bg/92 backdrop-blur-md eu-fade-in"
      onClick={busy ? undefined : onClose}
    >
      <aside
        onClick={(e) => e.stopPropagation()}
        className={[
          "fixed inset-x-0 bottom-0 max-h-[90vh] rounded-t-eu-xl",
          "eu-sheet-up",
          "bg-eu-surface-raised border-t border-eu-border",
          "shadow-eu-lg pt-eu-md pb-safe overflow-y-auto eu-noscroll",
          "flex flex-col gap-eu-md",
        ].join(" ")}
      >
        <div className="h-1 w-12 rounded-full bg-eu-rule mx-auto" />

        {/* Header */}
        <header className="flex items-start gap-eu-md px-eu-lg">
          <div
            className="shrink-0 h-10 w-10 rounded-eu-md flex items-center justify-center text-eu-lg"
            style={{
              background: "rgba(196,168,255,0.10)",
              border: "1px solid rgba(196,168,255,0.32)",
              color: "#c4a8ff",
              boxShadow: "0 0 12px rgba(196,168,255,0.30)",
            }}
          >
            <Sparkles size={18} strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
              新技能 · AI 设计
            </div>
            <div className="text-eu-lg text-eu-text-hi font-medium tracking-tight mt-0.5">
              {step === "describe" ? "想记录点什么?" : "预览这张卡片"}
            </div>
          </div>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 p-1.5 rounded-eu-sm text-eu-text-mid hover:text-eu-text-hi hover:bg-eu-surface-hover disabled:opacity-40"
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </header>

        {step === "describe" && (
          <DescribeStep
            description={description}
            setDescription={setDescription}
            busy={busy}
            onGenerate={generate}
          />
        )}

        {step === "preview" && draft && previewCard && (
          <PreviewStep
            card={previewCard}
            draft={draft}
            displayName={displayName}
            setDisplayName={setDisplayName}
            accent={accent}
            setAccent={setAccent}
            icon={icon}
            setIcon={setIcon}
          />
        )}

        {error && (
          <div className="px-eu-lg">
            <div className="text-eu-sm text-eu-accent-red-fg bg-eu-accent-red-bg border border-eu-accent-red-edge rounded-eu-md px-eu-sm py-1.5 font-mono">
              {error}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-auto px-eu-lg pt-eu-md pb-eu-md border-t border-eu-rule flex items-center gap-eu-sm">
          {step === "describe" ? (
            <>
              <div className="ml-auto flex gap-eu-sm">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={busy}
                  className="px-eu-md py-eu-sm text-eu-sm text-eu-text-mid hover:text-eu-text-hi disabled:opacity-40"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={generate}
                  disabled={busy || !description.trim()}
                  className={[
                    "inline-flex items-center gap-1.5 px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                    "bg-eu-brand text-white hover:bg-eu-brand-hi",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors duration-eu-fast",
                  ].join(" ")}
                >
                  {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Wand2 size={14} strokeWidth={2} />}
                  {busy ? "设计中…" : "AI 生成"}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={backToDescribe}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-eu-md py-eu-sm rounded-eu-md text-eu-sm text-eu-text-mid hover:text-eu-text-hi disabled:opacity-40"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                重新描述
              </button>
              <div className="ml-auto">
                <button
                  type="button"
                  onClick={confirm}
                  disabled={busy}
                  className={[
                    "inline-flex items-center gap-1.5 px-eu-md py-eu-sm rounded-eu-md text-eu-sm font-medium",
                    "bg-eu-brand text-white hover:bg-eu-brand-hi",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    "transition-colors duration-eu-fast",
                  ].join(" ")}
                >
                  {busy ? <Loader2 size={14} strokeWidth={2} className="animate-spin" /> : <Check size={14} strokeWidth={2} />}
                  {busy ? "注册中…" : "添加这个技能"}
                </button>
              </div>
            </>
          )}
        </footer>
      </aside>
    </div>
  );
}

/* ── Step 1: describe ─────────────────────────────────────────────────────── */

function DescribeStep({
  description,
  setDescription,
  busy,
  onGenerate,
}: {
  description: string;
  setDescription: (v: string) => void;
  busy: boolean;
  onGenerate: () => void;
}) {
  if (busy) {
    return (
      <div className="px-eu-lg flex flex-col items-center gap-eu-md py-eu-2xl text-center">
        <div className="relative">
          <Sparkles size={28} strokeWidth={1.5} className="text-eu-accent-purple-fg" />
          <Loader2 size={48} strokeWidth={1.25} className="animate-spin text-eu-brand absolute -inset-2.5" />
        </div>
        <div className="text-eu-base text-eu-text-hi font-medium">AI 正在设计你的卡片…</div>
        <div className="text-eu-sm text-eu-text-lo font-mono">约 15-30 秒</div>
      </div>
    );
  }

  return (
    <div className="px-eu-lg flex flex-col gap-eu-md">
      <textarea
        autoFocus
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onGenerate();
        }}
        rows={3}
        placeholder="用一句话描述你想记录的东西,例如「记录每次跑步的距离、配速和感受」…"
        className={[
          "w-full resize-none",
          "bg-eu-surface border border-eu-border rounded-eu-md",
          "p-eu-md text-eu-base text-eu-text-hi",
          "placeholder:text-eu-text-muted",
          "focus:outline-none focus:border-eu-brand",
          "transition-colors duration-eu-fast",
        ].join(" ")}
      />
      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setDescription(ex)}
            className={[
              "px-eu-sm py-1 rounded-eu-full text-eu-xs",
              "bg-eu-surface border border-eu-border text-eu-text-mid",
              "hover:border-eu-brand-line hover:text-eu-text-hi active:scale-95",
              "transition-all duration-eu-fast",
            ].join(" ")}
          >
            {ex}
          </button>
        ))}
      </div>
      <div className="text-eu-xs text-eu-text-lo font-mono">
        AI 会自动设计字段、图标和卡片样式 · ⌘/Ctrl+Enter 生成
      </div>
    </div>
  );
}

/* ── Step 2: preview + tweak ──────────────────────────────────────────────── */

function PreviewStep({
  card,
  draft,
  displayName,
  setDisplayName,
  accent,
  setAccent,
  icon,
  setIcon,
}: {
  card: ReturnType<typeof buildCard>;
  draft: SkillDraft;
  displayName: string;
  setDisplayName: (v: string) => void;
  accent: AccentColor;
  setAccent: (v: AccentColor) => void;
  icon: string;
  setIcon: (v: string) => void;
}) {
  const fields = schemaFields(draft.payload_schema);

  return (
    <div className="px-eu-lg flex flex-col gap-eu-md">
      {/* Live card preview */}
      <div>
        <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono mb-1.5">
          卡片预览
        </div>
        <div className="pointer-events-none">
          <SkillCard data={card} />
        </div>
      </div>

      {/* Tweak: name + icon + accent */}
      <div className="flex flex-col gap-eu-md border-t border-eu-rule pt-eu-md">
        <div className="flex gap-eu-md">
          <div className="flex flex-col gap-1" style={{ width: 64 }}>
            <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">图标</div>
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value.slice(0, 2))}
              maxLength={2}
              className="w-full text-center bg-eu-surface border border-eu-border rounded-eu-md px-eu-sm py-1.5 text-eu-lg focus:outline-none focus:border-eu-brand"
            />
          </div>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">名称</div>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={draft.display_name}
              className="w-full bg-eu-surface border border-eu-border rounded-eu-md px-eu-sm py-1.5 text-eu-base text-eu-text-hi focus:outline-none focus:border-eu-brand"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">主题色</div>
          <div className="flex gap-2">
            {ACCENTS.map((a) => (
              <button
                key={a}
                type="button"
                aria-label={a}
                onClick={() => setAccent(a)}
                className="rounded-full active:scale-90 transition-transform"
                style={{
                  width: 26,
                  height: 26,
                  background: ACCENT_SWATCH[a],
                  boxShadow: accent === a ? `0 0 0 2px var(--eu-surface-raised), 0 0 0 4px ${ACCENT_SWATCH[a]}` : "none",
                  opacity: accent === a ? 1 : 0.55,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Captured fields */}
      {fields.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-eu-rule pt-eu-md">
          <div className="text-eu-xs uppercase tracking-eu-caps text-eu-text-lo font-mono">
            会记录这些字段
          </div>
          <div className="flex flex-wrap gap-1.5">
            {fields.map((f) => (
              <span
                key={f.name}
                className="inline-flex items-center gap-1 px-eu-sm py-1 rounded-eu-md bg-eu-surface border border-eu-border text-eu-xs text-eu-text-mid"
              >
                <span className="text-eu-text-hi">{f.name}</span>
                {f.type && <span className="font-mono text-eu-text-lo">{f.type}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function schemaFields(schema: Record<string, unknown>): Array<{ name: string; type: string }> {
  if (!schema || typeof schema !== "object") return [];
  return Object.entries(schema).map(([name, v]) => {
    let type = "";
    if (typeof v === "string") type = v;
    else if (v && typeof v === "object" && "type" in (v as object)) {
      type = String((v as { type: unknown }).type ?? "");
    }
    return { name, type };
  });
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const body = e.body as { error?: string } | null;
    return body?.error ?? `请求失败 (${e.status})`;
  }
  return e instanceof Error ? e.message : String(e);
}
