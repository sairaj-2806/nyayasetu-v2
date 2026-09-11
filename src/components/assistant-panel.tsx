import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { FileSearch, Loader2, MessageSquareText, SendHorizonal, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EXAMPLE_QUESTIONS, type AssistantAnswer, type AssistantRow } from "@/lib/assistant";
import { askRegistryAssistant } from "@/lib/assistant.functions";
import { ChatMarkdown } from "@/components/chat-markdown";
import { useCurrentStaff } from "@/hooks/use-current-staff";

type Turn =
  | { role: "user"; id: string; text: string }
  | { role: "assistant"; id: string; answer: AssistantAnswer }
  | { role: "error"; id: string; text: string };

/**
 * Global helper to open the AI Judicial Copilot sheet from anywhere (e.g. TopBar, navigation, cards).
 */
export function openAiAssistant() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("nyayasetu:open-copilot"));
  }
}

export const openAiCopilot = openAiAssistant;

/**
 * Registry Assistant — a decision-support lookup panel. Every answer is the
 * result of a real query against the live registry; unmatched questions are
 * declined rather than guessed at. Conversation is session-only by design.
 */
export function AssistantPanel() {
  const navigate = useNavigate();
  const { data: staff } = useCurrentStaff();
  const askFn = useServerFn(askRegistryAssistant);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("nyayasetu:open-copilot", handleOpenEvent);
    return () => window.removeEventListener("nyayasetu:open-copilot", handleOpenEvent);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80);
  }, [open]);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [turns, busy]);

  async function ask(q: string) {
    if (!q.trim() || busy) return;
    const userTurn: Turn = { role: "user", id: `u-${Date.now()}`, text: q.trim() };
    setTurns((prev) => [...prev, userTurn]);
    setValue("");
    setBusy(true);

    try {
      const answer = await askFn({
        data: {
          question: q.trim(),
          userRole: staff?.role,
          userId: staff?.id,
        },
      });
      setTurns((prev) => [...prev, { role: "assistant", id: `a-${Date.now()}`, answer }]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lookup failed. Please try again.";
      setTurns((prev) => [...prev, { role: "error", id: `e-${Date.now()}`, text: message }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleOpenEntity(row: AssistantRow) {
    if (!row.target) return;
    setOpen(false);
    const t = row.target;
    if (t.route === "/cases/$caseId") navigate({ to: t.route, params: { caseId: t.caseId } });
    else if (t.route === "/judges/$judgeId")
      navigate({ to: t.route, params: { judgeId: t.judgeId } });
    else if (t.route === "/courtrooms/$courtroomId")
      navigate({ to: t.route, params: { courtroomId: t.courtroomId } });
    else if (t.route === "/assets/$assetId")
      navigate({ to: t.route, params: { assetId: t.assetId } });
    else if (t.route === "/documents/$documentId")
      navigate({ to: t.route, params: { documentId: t.documentId } });
    else navigate({ to: t.route as any });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open NyayaSetu Assistant"
          className={cn(
            "fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 sm:bottom-6 sm:right-6 z-40",
            "group flex items-center gap-2 rounded-full px-3.5 py-2.5 sm:px-4.5 sm:py-3.5",
            "bg-primary text-primary-foreground font-semibold text-xs sm:text-sm",
            "shadow-xl shadow-primary/30 border border-primary/20",
            "hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-0.5 active:scale-95 active:translate-y-0",
            "transition-all duration-200 cursor-pointer select-none",
            "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            open && "opacity-0 pointer-events-none",
          )}
        >
          <div className="relative flex items-center justify-center">
            <Sparkles className="size-4 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform duration-300" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <span className="tracking-wide">NyayaSetu Assistant</span>
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="flex h-full max-h-[100dvh] w-full flex-col gap-0 p-0 sm:max-w-lg md:max-w-xl border-l border-border/80 bg-background shadow-2xl overflow-hidden"
      >
        <SheetHeader className="px-5 py-4 pr-12 border-b bg-card/60 shrink-0">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <FileSearch className="size-4.5 text-primary" />
            NyayaSetu Assistant
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground leading-normal">
            AI-assisted authorized investigation information, document intelligence, evidence
            custody, and case records.
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable messages container - strictly bound with min-h-0 and native scroll */}
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 sm:p-5 space-y-4 overscroll-contain"
        >
          {turns.length === 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Try one of these lookups:
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => ask(q)}
                    className="rounded-lg border border-border/80 bg-card/80 px-3 py-1.5 text-left text-xs text-foreground transition-all hover:bg-accent hover:border-primary/40 hover:text-accent-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) =>
            turn.role === "user" ? (
              <div key={turn.id} className="flex justify-end min-w-0">
                <div className="max-w-[85%] min-w-0 rounded-2xl rounded-br-xs bg-primary px-4 py-2.5 text-sm text-primary-foreground shadow-sm leading-relaxed break-words [word-break:break-word] whitespace-pre-wrap">
                  {turn.text}
                </div>
              </div>
            ) : turn.role === "error" ? (
              <p
                key={turn.id}
                className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive leading-relaxed break-words [word-break:break-word]"
              >
                {turn.text}
              </p>
            ) : (
              <div
                key={turn.id}
                className="space-y-3 rounded-2xl rounded-tl-xs border border-border/80 bg-card/90 p-4 shadow-sm min-w-0 max-w-full overflow-hidden break-words [word-break:break-word]"
              >
                <ChatMarkdown content={turn.answer.summary} />
                {turn.answer.rows.length > 0 && (
                  <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-background/50">
                    {turn.answer.rows.map((row) => (
                      <li key={row.id}>
                        <button
                          type="button"
                          onClick={() => handleOpenEntity(row)}
                          disabled={!row.target}
                          className={cn(
                            "flex w-full items-start justify-between gap-3 px-3.5 py-2.5 text-left transition-colors",
                            row.target ? "hover:bg-muted/70 cursor-pointer" : "cursor-default",
                          )}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-foreground">
                              {row.label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground mt-0.5">
                              {row.detail}
                            </span>
                          </span>
                          {row.badge && (
                            <Badge
                              variant="outline"
                              className="shrink-0 text-[10px] font-normal px-2 py-0.5"
                            >
                              {row.badge}
                            </Badge>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ),
          )}

          {busy && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground py-2 px-1">
              <Loader2 className="size-4 animate-spin text-primary shrink-0" /> Querying the legal
              engine & registry…
            </p>
          )}
        </div>

        <form
          className="flex items-center gap-2 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/80 bg-card/90 backdrop-blur shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            void ask(value);
          }}
        >
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask about cases, schedules, assets, evidence, documents, or custody…"
            aria-label="Ask the AI Copilot"
            className="flex-1 min-w-0 text-sm h-10 bg-background/80 focus-visible:ring-1"
          />
          <Button
            type="submit"
            size="icon"
            disabled={busy || !value.trim()}
            aria-label="Send question"
            className="h-10 w-10 shrink-0"
          >
            <SendHorizonal className="size-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
