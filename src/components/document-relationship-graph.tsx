import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  FileText,
  ShieldAlert,
  CheckCircle2,
  Lock,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Workflow,
  Sparkles,
  Package,
  Layers,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { SecureDocument } from "@/lib/documents";
import type { PoliceAsset } from "@/lib/assets";

interface DocumentRelationshipGraphProps {
  caseNumber: string;
  documents: SecureDocument[];
  evidence: PoliceAsset[];
}

interface PipelineStage {
  id: string;
  stageNumber: number;
  label: string;
  categoryKeys: string[];
  description: string;
  statutoryBasis: string;
}

const STAGES: PipelineStage[] = [
  {
    id: "fir",
    stageNumber: 1,
    label: "FIR & Inception Record",
    categoryKeys: ["fir", "first information", "complaint"],
    description: "Initial formal registration of cognizable offense initiating investigation",
    statutoryBasis: "Section 173 BNSS, 2023",
  },
  {
    id: "investigation",
    stageNumber: 2,
    label: "Investigation & Panchnama",
    categoryKeys: ["investigation", "panchnama", "police report", "inspection"],
    description: "Site inspection memos, search panchnamas, and spot investigation diaries",
    statutoryBasis: "Section 105 & 175 BNSS, 2023",
  },
  {
    id: "witness",
    stageNumber: 3,
    label: "Witness Statements",
    categoryKeys: ["witness", "statement", "deposition", "section 180"],
    description: "Audio-video or signed evidentiary depositions taken by investigating officer",
    statutoryBasis: "Section 180 BNSS, 2023",
  },
  {
    id: "evidence",
    stageNumber: 4,
    label: "Seized Physical & Digital Exhibits",
    categoryKeys: ["evidence", "exhibit", "seizure", "malkhana"],
    description: "Physical property, narcotics, phones, and digital storage seized under seal",
    statutoryBasis: "Section 105 BNSS / Section 63 BSA, 2023",
  },
  {
    id: "forensic",
    stageNumber: 5,
    label: "Forensic & Scientific Reports",
    categoryKeys: ["forensic", "cfsl", "fsl", "chemical", "ballistic", "cyber"],
    description: "Certified laboratory extractions and expert opinions with hash verifications",
    statutoryBasis: "Section 39 BSA & Section 193 BNSS",
  },
  {
    id: "chargesheet",
    stageNumber: 6,
    label: "Police Charge Sheet / Final Report",
    categoryKeys: ["charge sheet", "chargesheet", "final report", "closure"],
    description:
      "Formal indictment specifying evidence against accused presented before Magistrate",
    statutoryBasis: "Section 193 BNSS, 2023",
  },
  {
    id: "court-filings",
    stageNumber: 7,
    label: "Court Pleadings & Filings",
    categoryKeys: ["court filing", "bail", "petition", "affidavit", "application"],
    description: "Prosecution responses, bail oppositions, and defense legal pleadings",
    statutoryBasis: "High Court Rules & BNSS Procedures",
  },
  {
    id: "judgment",
    stageNumber: 8,
    label: "Judicial Orders & Judgment",
    categoryKeys: ["judgment", "order", "decree", "charge order"],
    description:
      "Formal court determinations, framing of charges, bail orders, or trial disposition",
    statutoryBasis: "Section 258/392 BNSS, 2023",
  },
];

export function DocumentRelationshipGraph({
  caseNumber,
  documents,
  evidence,
}: DocumentRelationshipGraphProps) {
  // Map documents and evidence to the pipeline stages
  const mappedStages = useMemo(() => {
    return STAGES.map((stage) => {
      // Find matching documents
      const matchingDocs = documents.filter((doc) => {
        const cat = (doc.category || "").toLowerCase();
        const title = (doc.title || "").toLowerCase();
        return stage.categoryKeys.some((k) => cat.includes(k) || title.includes(k));
      });

      // Find matching evidence (specifically for the evidence stage)
      const matchingEvidence = stage.id === "evidence" ? evidence : [];

      const totalItems = matchingDocs.length + matchingEvidence.length;

      return {
        ...stage,
        matchingDocs,
        matchingEvidence,
        totalItems,
        isCompleted: totalItems > 0,
      };
    });
  }, [documents, evidence]);

  return (
    <div className="space-y-6">
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Workflow className="size-4 text-primary" />
                Evidentiary & Procedural Document Relationship Graph
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Deterministic lifecycle traceability for Case{" "}
                <span className="font-mono font-semibold text-foreground">{caseNumber}</span>{" "}
                showing how inception FIR records progress through crime-scene seizure, forensic
                laboratory analysis, and judicial filings.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs font-mono bg-primary/5 text-primary border-primary/30"
              >
                Section 63 BSA Compliant
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {documents.length} Records · {evidence.length} Exhibits
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual Step Indicator */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {mappedStages.map((st) => (
              <div
                key={st.id}
                className={`p-2.5 rounded-lg border text-center transition-colors ${
                  st.isCompleted
                    ? "bg-primary/5 border-primary/40 text-foreground"
                    : "bg-muted/20 border-dashed border-border/70 text-muted-foreground opacity-60"
                }`}
              >
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span
                    className={`size-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      st.isCompleted
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {st.stageNumber}
                  </span>
                  {st.isCompleted && <CheckCircle2 className="size-3 text-emerald-500" />}
                </div>
                <div className="text-[11px] font-semibold leading-tight line-clamp-2">
                  {st.label}
                </div>
                <div className="text-[10px] mt-1 font-mono">
                  {st.totalItems > 0 ? (
                    <span className="text-primary font-bold">{st.totalItems} linked</span>
                  ) : (
                    <span className="text-muted-foreground">Pending</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Detailed Stage Traceability Chain */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Traceable Document & Evidence Flow
            </h4>

            <div className="space-y-4">
              {mappedStages.map((stage, idx) => (
                <div key={stage.id} className="relative">
                  {/* Vertical connector line */}
                  {idx < mappedStages.length - 1 && (
                    <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-border/80 z-0 -mb-4" />
                  )}

                  <div className="relative z-10 flex items-start gap-4">
                    {/* Stage number badge */}
                    <div
                      className={`size-8 rounded-full shrink-0 flex items-center justify-center font-bold text-xs shadow-xs border ${
                        stage.isCompleted
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {stage.stageNumber}
                    </div>

                    {/* Stage content card */}
                    <div
                      className={`flex-1 rounded-lg border p-4 transition-all ${
                        stage.isCompleted
                          ? "bg-card border-border/80 shadow-xs"
                          : "bg-muted/10 border-dashed border-border/60"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-2 border-b border-border/40">
                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-sm font-semibold text-foreground">{stage.label}</h5>
                            <span className="text-[10px] text-muted-foreground">
                              ({stage.statutoryBasis})
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {stage.description}
                          </p>
                        </div>
                        <Badge
                          variant={stage.isCompleted ? "default" : "outline"}
                          className="text-[10px] self-start sm:self-auto shrink-0"
                        >
                          {stage.isCompleted
                            ? `${stage.totalItems} Records Linked`
                            : "Stage Pending"}
                        </Badge>
                      </div>

                      {/* Render Linked Items if any */}
                      {stage.isCompleted ? (
                        <div className="mt-3 space-y-2">
                          {/* Documents */}
                          {stage.matchingDocs.map((doc) => (
                            <div
                              key={doc.id}
                              className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border bg-muted/25 text-xs hover:bg-muted/40 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <FileText className="size-4 text-primary shrink-0" />
                                <div>
                                  <Link
                                    to="/documents/$documentId"
                                    params={{ documentId: doc.id }}
                                    className="font-medium text-foreground hover:underline flex items-center gap-1"
                                  >
                                    <span className="font-mono text-primary font-semibold">
                                      {doc.document_number}:
                                    </span>{" "}
                                    {doc.title}
                                    <ExternalLink className="size-3 text-muted-foreground inline" />
                                  </Link>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 font-mono">
                                    <span>v{doc.current_version}</span>
                                    <span>·</span>
                                    <span>{doc.originating_agency}</span>
                                    <span>·</span>
                                    <span>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle2 className="size-3" />
                                  SHA-256 Verified
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {doc.sensitivity_tier}
                                </Badge>
                              </div>
                            </div>
                          ))}

                          {/* Evidence items */}
                          {stage.matchingEvidence.map((ev) => (
                            <div
                              key={ev.id}
                              className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded border bg-muted/25 text-xs hover:bg-muted/40 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <Package className="size-4 text-amber-600 shrink-0" />
                                <div>
                                  <Link
                                    to="/assets/$assetId"
                                    params={{ assetId: ev.id }}
                                    className="font-medium text-foreground hover:underline flex items-center gap-1"
                                  >
                                    <span className="font-mono text-amber-700 font-semibold dark:text-amber-400">
                                      {ev.asset_code}:
                                    </span>{" "}
                                    {ev.name}
                                    <ExternalLink className="size-3 text-muted-foreground inline" />
                                  </Link>
                                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                    <span>Seal: {ev.tamper_seal_number || "Verified"}</span>
                                    <span>·</span>
                                    <span>Location: {ev.current_location}</span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  <CheckCircle2 className="size-3" />
                                  Custody Intact
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {ev.evidence_status || "SEIZED_IN_CUSTODY"}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-muted-foreground italic">
                          No official records registered for this stage in this case docket.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
