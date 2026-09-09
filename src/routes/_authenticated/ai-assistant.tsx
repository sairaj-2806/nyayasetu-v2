import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  SendHorizonal,
  Loader2,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Bot,
  User,
  HelpCircle,
  FileText,
  Package,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { askRegistryAssistant } from "@/lib/assistant.functions";
import { type AssistantAnswer, type AssistantRow } from "@/lib/assistant";
import { ChatMarkdown } from "@/components/chat-markdown";
import { useCurrentStaff } from "@/hooks/use-current-staff";

export const Route = createFileRoute("/_authenticated/ai-assistant")({
  head: () => ({
    meta: [
      { title: "AI Legal & Investigation Assistant — NyayaSetu" },
      {
        name: "description",
        content:
          "Live grounded AI assistant for judicial cause-lists, case dossiers, evidence chain-of-custody, and police asset lifecycles.",
      },
    ],
  }),
  component: AIAssistantPage,
});

type Turn =
  | { role: "user"; id: string; text: string }
  | { role: "assistant"; id: string; answer: AssistantAnswer }
  | { role: "error"; id: string; text: string };

const SUGGESTED_QUERIES = [
  {
    category: "Case Dossier",
    prompt: "Summarize Case BNS/2026/0014 and list all critical evidence.",
    description: "Multi-party overview, charges, evidence and scheduled hearings",
  },
  {
    category: "Malkhana & Evidence",
    prompt: "Where is evidence EV-1045 and what is its chain of custody?",
    description: "Seizure, forensic status, custody handovers and tamper seals",
  },
  {
    category: "Police Assets",
    prompt: "Which police assets are currently under maintenance or transferred?",
    description: "Patrol vehicles, armory firearms, body cameras and custody status",
  },
  {
    category: "Document Vault",
    prompt: "Which documents are awaiting digital signature or SHA-256 integrity verification?",
    description: "BSA §63 compliant hashes, cryptographic verification and pending signatures",
  },
  {
    category: "Court Cause List",
    prompt: "Which hearings are scheduled today across all courtrooms?",
    description: "Courtroom load, listed matters, allocated judges and time slots",
  },
  {
    category: "Forensic Status",
    prompt: "Show all forensic evidence currently under examination at FSL.",
    description: "Pending examination, chain-of-custody transfers and forensic reports",
  },
];

export function AIAssistantPage() {
  const navigate = useNavigate();
  const { data: staff } = useCurrentStaff();
  const askFn = useServerFn(askRegistryAssistant);

  const [turns, setTurns] = useState<Turn[]>([]);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  async function handleAsk(questionText: string) {
    const q = questionText.trim();
    if (!q || busy) return;

    const userTurn: Turn = {
      role: "user",
      id: `u-${Date.now()}`,
      text: q,
    };
    setTurns((prev) => [...prev, userTurn]);
    setValue("");
    setBusy(true);

    try {
      const answer = await askFn({
        data: {
          question: q,
          userRole: staff?.role,
          userId: staff?.id,
        },
      });
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          id: `a-${Date.now()}`,
          answer,
        },
      ]);
    } catch (error) {
      setTurns((prev) => [
        ...prev,
        {
          role: "error",
          id: `err-${Date.now()}`,
          text:
            error instanceof Error
              ? error.message
              : "The legal and judicial query failed to resolve. Please try again.",
        },
      ]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleOpenEntity(row: AssistantRow) {
    if (!row.target) return;
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
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-8 sm:py-9 space-y-6">
      <PageHeader
        eyebrow="Intelligence & Copilot"
        title="AI Judicial & Investigation Assistant"
        description="Grounded AI reasoning across active court cases, forensic evidence custody, secure document vaults, and police assets."
        actions={
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-700 border-emerald-500/30 dark:text-emerald-400 font-medium py-1 px-2.5 gap-1.5"
            >
              <ShieldCheck className="size-3.5" />
              Live DB Grounding Active
            </Badge>
            {turns.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setTurns([])}
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3.5 mr-1" />
                Clear Chat
              </Button>
            )}
          </div>
        }
      />

      {/* Human-in-the-Loop Governance Banner */}
      <Card className="border-border bg-gradient-to-r from-primary/5 via-primary/[0.02] to-background text-xs text-muted-foreground p-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="size-4 text-primary shrink-0" />
          <span>
            <strong className="text-foreground font-semibold">Human-in-the-Loop Governance:</strong>{" "}
            The AI assistant operates strictly as an informational decision-support tool. It cannot
            unilaterally reschedule hearings, transfer evidence custody, overwrite official
            documents, or modify audit logs.
          </span>
        </div>
        <Badge variant="secondary" className="shrink-0 text-[10px] uppercase font-mono">
          Tier-1 Guardrails
        </Badge>
      </Card>

      {/* Main Conversation Canvas */}
      <Card className="border-border shadow-xs flex flex-col min-h-[560px]">
        <CardContent className="flex-1 p-4 sm:p-6 flex flex-col justify-between">
          {/* Messages Area */}
          <div className="space-y-6 flex-1">
            {turns.length === 0 ? (
              <div className="py-8 space-y-6 text-center max-w-2xl mx-auto">
                <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto ring-8 ring-primary/5">
                  <Sparkles className="size-6" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-base font-semibold text-foreground">
                    How can I assist your workflow today, {staff?.fullName || "Officer"}?
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Ask any question regarding active trials, seized evidence, bodycam records,
                    investigation reports, or courtroom slot constraints. Every answer is grounded in
                    real database records.
                  </p>
                </div>

                {/* Prompt Suggestions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                  {SUGGESTED_QUERIES.map((sq, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleAsk(sq.prompt)}
                      className="group flex flex-col p-3 rounded-lg border border-border/70 bg-background/50 hover:bg-muted/50 hover:border-primary/40 transition-all text-left"
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                          {sq.category}
                        </span>
                        <ArrowRight className="size-3 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                        "{sq.prompt}"
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{sq.description}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={cn(
                      "flex gap-3.5",
                      turn.role === "user" ? "justify-end" : "justify-start",
                    )}
                  >
                    {turn.role !== "user" && (
                      <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                        <Bot className="size-4" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "max-w-2xl rounded-xl p-4 text-sm leading-relaxed",
                        turn.role === "user"
                          ? "bg-primary text-primary-foreground font-medium ml-12"
                          : turn.role === "error"
                            ? "bg-destructive/10 text-destructive border border-destructive/20"
                            : "bg-muted/40 border border-border/70 text-foreground space-y-3",
                      )}
                    >
                      {turn.role === "user" && <p>{turn.text}</p>}

                      {turn.role === "error" && <p>{turn.text}</p>}

                      {turn.role === "assistant" && (
                        <div className="space-y-3">
                          <ChatMarkdown content={turn.answer.summary} />

                          {/* Referenced Entities / Search Results */}
                          {turn.answer.rows && turn.answer.rows.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/60 space-y-1.5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Referenced Registry Records ({turn.answer.rows.length})
                              </p>
                              <div className="grid grid-cols-1 gap-1.5">
                                {turn.answer.rows.map((row, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleOpenEntity(row)}
                                    className="flex items-center justify-between p-2 rounded-md bg-background/80 hover:bg-primary/5 hover:border-primary/40 border border-border/60 transition-colors text-left group"
                                  >
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary">
                                        {row.label}
                                      </p>
                                      <p className="text-[11px] text-muted-foreground truncate">
                                        {row.detail}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      {row.badge && (
                                        <Badge
                                          variant="secondary"
                                          className="text-[10px] font-normal"
                                        >
                                          {row.badge}
                                        </Badge>
                                      )}
                                      <ExternalLink className="size-3 text-muted-foreground group-hover:text-primary" />
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Grounding Attribution Footnote */}
                          <div className="flex items-center justify-between pt-2 text-[10px] text-muted-foreground/80 border-t border-border/40 font-mono">
                            <span>
                              Engine: {turn.answer.source || "Deterministic Multi-Constraint Grounding"}
                            </span>
                            <span>Verified with RLS Boundaries</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {turn.role === "user" && (
                      <div className="size-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center shrink-0 mt-0.5">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                ))}

                {busy && (
                  <div className="flex gap-3.5 justify-start">
                    <div className="size-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="size-4" />
                    </div>
                    <div className="bg-muted/40 border border-border/70 rounded-xl p-4 text-xs text-muted-foreground flex items-center gap-2.5">
                      <Loader2 className="size-4 animate-spin text-primary" />
                      <span>Searching case registry, FSL records, document hashes and asset logs…</span>
                    </div>
                  </div>
                )}
                <div ref={scrollEndRef} />
              </div>
            )}
          </div>

          {/* User Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAsk(value);
            }}
            className="mt-6 flex items-center gap-2 p-2 rounded-xl border border-border bg-background shadow-xs"
          >
            <Input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Ask about a case, evidence chain of custody, document integrity, or hearing schedule…"
              disabled={busy}
              className="border-0 shadow-none focus-visible:ring-0 text-sm px-3"
            />
            <Button
              type="submit"
              disabled={busy || !value.trim()}
              size="sm"
              className="gap-1.5 shrink-0 px-4"
            >
              <SendHorizonal className="size-3.5" />
              <span>Ask</span>
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
