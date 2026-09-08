import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarOff,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  FlaskConical,
  Gavel,
  HelpCircle,
  History,
  Layers,
  Loader2,
  Lock,
  MapPin,
  Package,
  RefreshCw,
  RotateCcw,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  Truck,
  UserCheck,
  Users,
} from "lucide-react";

import { PageHeader } from "@/components/page-shell";
import { ReasoningList } from "@/components/reasoning-list";
import { EmptyState, ErrorState, LoadingState, PermissionNotice } from "@/components/states";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { casesQuery, formatDate } from "@/lib/cases";
import { useCurrentStaff, permissionsFor, roleLabel } from "@/hooks/use-current-staff";
import { formatSlotLabel, schedulingDataQuery } from "@/lib/scheduling";
import { recordAudit } from "@/lib/audit";
import { policeAssetsQuery } from "@/lib/assets";
import { secureDocumentsQuery } from "@/lib/documents";
import {
  applySimulation,
  applyCourtroomSimulation,
  simulateJudgeUnavailable,
  simulateCourtroomClosure,
  runPoliceAssetSimulation,
  PRESET_SIMULATION_SCENARIOS,
  type SimulationResult,
  type CourtroomSimulationResult,
  type PoliceAssetSimulationInput,
  type PoliceAssetSimulationResult,
  type PoliceAssetSimulationScenarioType,
} from "@/lib/simulation";

export const Route = createFileRoute("/_authenticated/what-if-simulation")({
  head: () => ({
    meta: [
      { title: "What-If Simulation & Digital Twin — NyayaSetu" },
      {
        name: "description",
        content:
          "High-fidelity digital twin modeling for judicial bench availability, courtroom infrastructure, and police asset/evidence impact simulations.",
      },
      { property: "og:title", content: "What-If Simulation & Digital Twin — NyayaSetu" },
      {
        property: "og:description",
        content:
          "High-fidelity digital twin modeling for judicial bench availability, courtroom infrastructure, and police asset/evidence impact simulations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

// Stepper phases for the existing judicial scheduling simulation
const JUDICIAL_STEPS = [
  { key: "scope", label: "Applying simulated condition", icon: FlaskConical },
  { key: "impact", label: "Tracing affected hearings", icon: CalendarOff },
  { key: "availability", label: "Re-checking judge & courtroom availability", icon: Gavel },
  { key: "conflicts", label: "Re-checking conflicts and duration fit", icon: Timer },
] as const;

// Stepper phases for the new Police Asset & Evidence Digital Twin simulation
const ASSET_TWIN_STEPS = [
  { key: "topology", label: "Ingesting asset, custody & docket topology", icon: Layers },
  {
    key: "intersect",
    label: "Tracing intersecting officers, trial cases & exhibits",
    icon: ShieldAlert,
  },
  {
    key: "compliance",
    label: "Evaluating hearing adjournment & Section 63 BSA risks",
    icon: Scale,
  },
  { key: "synthesis", label: "Synthesizing deterministic alternative mitigations", icon: Sparkles },
] as const;

function Page() {
  const staff = useCurrentStaff();
  const cases = useQuery(casesQuery);
  const engineData = useQuery(schedulingDataQuery);
  const assetsQuery = useQuery(policeAssetsQuery);
  const docsQuery = useQuery(secureDocumentsQuery());
  const queryClient = useQueryClient();

  // Top-level simulation category switcher
  const [simulationCategory, setSimulationCategory] = useState<"judicial" | "police-assets">(
    "police-assets",
  );

  // --- Judicial Simulation States ---
  const [conditionType, setConditionType] = useState<"judge-unavailable" | "courtroom-closure">(
    "judge-unavailable",
  );
  const [judgeId, setJudgeId] = useState("");
  const [courtroomId, setCourtroomId] = useState("");
  const [date, setDate] = useState("");
  const [judicialStep, setJudicialStep] = useState(-1);
  const [judicialResult, setJudicialResult] = useState<
    SimulationResult | CourtroomSimulationResult | null
  >(null);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState<number | null>(null);

  // --- Police Asset & Evidence Digital Twin States ---
  const [selectedScenarioType, setSelectedScenarioType] =
    useState<PoliceAssetSimulationScenarioType>("vehicle-unavailable");
  const [targetAssetCode, setTargetAssetCode] = useState("VH-1045");
  const [targetOfficerName, setTargetOfficerName] = useState("Insp. Rajesh Sharma");
  const [targetLockerLocation, setTargetLockerLocation] = useState(
    "Locker L-12 (Central Malkhana High-Security Vault)",
  );
  const [targetTransferId, setTargetTransferId] = useState("TRF-NDPS-89");
  const [delayHours, setDelayHours] = useState(48);
  const [simulatedDate, setSimulatedDate] = useState("Tomorrow (11:30 AM)");
  const [assetTwinStep, setAssetTwinStep] = useState(-1);
  const [assetTwinResult, setAssetTwinResult] = useState<PoliceAssetSimulationResult | null>(null);
  const [activeImpactTab, setActiveImpactTab] = useState<
    "assets" | "officers" | "cases" | "evidence" | "documents"
  >("cases");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const judges = engineData.data?.judges ?? [];
  const courtrooms = engineData.data?.courtrooms ?? [];
  const runningJudicial = judicialStep >= 0 && judicialStep < JUDICIAL_STEPS.length;
  const runningAssetTwin = assetTwinStep >= 0 && assetTwinStep < ASSET_TWIN_STEPS.length;
  const canApply = permissionsFor(staff.data?.role).canSchedule;

  // Pre-load demo for judicial
  function loadJudicialDemo() {
    if (!engineData.data) return;
    const firstJudgeWithHearings = engineData.data.judges.find((j) =>
      engineData.data!.schedules.some(
        (s) =>
          (s.status === "proposed" || s.status === "confirmed") &&
          s.judge_id === j.id &&
          s.hearing_slots,
      ),
    );
    if (!firstJudgeWithHearings) return;
    const scheduleForJudge = engineData.data.schedules.find(
      (s) =>
        (s.status === "proposed" || s.status === "confirmed") &&
        s.judge_id === firstJudgeWithHearings.id &&
        s.hearing_slots,
    );
    const demoDate = scheduleForJudge?.hearing_slots?.date ?? "";
    discardJudicial();
    setConditionType("judge-unavailable");
    setJudgeId(firstJudgeWithHearings.id);
    setDate(demoDate);
  }

  function discardJudicial() {
    timers.current.forEach(clearTimeout);
    setJudicialStep(-1);
    setJudicialResult(null);
    setChoices({});
    setApplied(null);
  }

  function runJudicial() {
    if (!date || !engineData.data || !cases.data) return;
    if (conditionType === "judge-unavailable" && !judgeId) return;
    if (conditionType === "courtroom-closure" && !courtroomId) return;

    timers.current.forEach(clearTimeout);
    setJudicialResult(null);
    setChoices({});
    setApplied(null);
    setJudicialStep(0);

    timers.current = JUDICIAL_STEPS.map((_, i) =>
      setTimeout(() => setJudicialStep(i + 1), 480 * (i + 1)),
    );
    timers.current.push(
      setTimeout(() => {
        let sim: SimulationResult | CourtroomSimulationResult | null = null;
        if (conditionType === "judge-unavailable") {
          sim = simulateJudgeUnavailable({
            judgeId,
            date,
            data: engineData.data!,
            cases: cases.data!,
          });
          if (sim) {
            void recordAudit(
              `Ran What-If Simulation — ${sim.judge.name} marked unavailable on ${sim.date}; ${sim.affected.length} hearing(s) affected`,
              `judge:${sim.judge.id} date:${sim.date}`,
            );
          }
        } else {
          sim = simulateCourtroomClosure({
            courtroomId,
            date,
            data: engineData.data!,
            cases: cases.data!,
          });
          if (sim) {
            void recordAudit(
              `Ran What-If Simulation — ${sim.courtroom.name} marked closed on ${sim.date}; ${sim.affected.length} hearing(s) affected`,
              `courtroom:${sim.courtroom.id} date:${sim.date}`,
            );
          }
        }

        setJudicialResult(sim);
        setChoices(
          Object.fromEntries(
            (sim?.affected ?? [])
              .map((a) => [a.scheduleId, a.alternatives[0]?.key] as const)
              .filter((entry): entry is readonly [string, string] => Boolean(entry[1])),
          ),
        );
      }, 480 * JUDICIAL_STEPS.length),
    );
  }

  async function applyJudicialCommit() {
    if (!judicialResult || !engineData.data || !staff.data) return;
    if (!canApply) {
      toast.error("Your role does not permit committing schedule changes.");
      return;
    }
    setApplying(true);
    try {
      let reassigned = 0;
      if (conditionType === "judge-unavailable") {
        const res = await applySimulation({
          result: judicialResult as SimulationResult,
          choices,
          slots: engineData.data.slots,
          userId: staff.data.id,
        });
        reassigned = res.reassigned;
      } else {
        const res = await applyCourtroomSimulation({
          result: judicialResult as CourtroomSimulationResult,
          choices,
          slots: engineData.data.slots,
          userId: staff.data.id,
        });
        reassigned = res.reassigned;
      }

      setApplied(reassigned);
      toast.success(`What-If Simulation applied — ${reassigned} hearing(s) reassigned`);
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not apply the What-If Simulation",
      );
    } finally {
      setApplying(false);
    }
  }

  // --- Police Asset & Evidence Digital Twin Handlers ---
  function discardAssetTwin() {
    timers.current.forEach(clearTimeout);
    setAssetTwinStep(-1);
    setAssetTwinResult(null);
  }

  function handleSelectPresetScenario(preset: (typeof PRESET_SIMULATION_SCENARIOS)[0]) {
    setSelectedScenarioType(preset.id);
    discardAssetTwin();
    if (preset.id === "vehicle-unavailable") {
      setTargetAssetCode("VH-1045");
      setSimulatedDate("Tomorrow (11:30 AM)");
    } else if (preset.id === "locker-unavailable") {
      setTargetLockerLocation("Locker L-12 (Central Malkhana High-Security Vault)");
      setSimulatedDate("Today (11:00 AM)");
    } else if (preset.id === "officer-on-leave") {
      setTargetOfficerName("Insp. Rajesh Sharma");
      setSimulatedDate("In 3 Days (11:00 AM)");
    } else if (preset.id === "transfer-delayed") {
      setTargetTransferId("TRF-NDPS-89");
      setDelayHours(48);
      setSimulatedDate("In 2 Days (02:00 PM)");
    }
  }

  function runAssetTwinSimulation() {
    timers.current.forEach(clearTimeout);
    setAssetTwinResult(null);
    setAssetTwinStep(0);

    const preset = PRESET_SIMULATION_SCENARIOS.find((p) => p.id === selectedScenarioType);
    const title =
      selectedScenarioType === "vehicle-unavailable"
        ? `What if vehicle ${targetAssetCode} becomes unavailable?`
        : selectedScenarioType === "locker-unavailable"
          ? `What if Evidence Locker ${targetLockerLocation} becomes unavailable?`
          : selectedScenarioType === "officer-on-leave"
            ? `What if Officer ${targetOfficerName} goes on leave?`
            : selectedScenarioType === "transfer-delayed"
              ? `What if evidence transfer ${targetTransferId} is delayed by ${delayHours}h?`
              : `What if asset ${targetAssetCode} becomes unavailable?`;

    const input: PoliceAssetSimulationInput = {
      scenarioType: selectedScenarioType,
      title,
      description:
        preset?.description ||
        "Simulate police asset & evidence logistical disruption in digital twin.",
      targetAssetCode,
      targetOfficerName,
      targetLockerLocation,
      targetTransferId,
      delayHours,
      simulatedDate,
    };

    timers.current = ASSET_TWIN_STEPS.map((_, i) =>
      setTimeout(() => setAssetTwinStep(i + 1), 400 * (i + 1)),
    );

    timers.current.push(
      setTimeout(() => {
        const sim = runPoliceAssetSimulation({
          input,
          liveAssets: assetsQuery.data,
          liveDocuments: docsQuery.data ?? [],
          liveCases: cases.data,
        });
        setAssetTwinResult(sim);
        setAssetTwinStep(ASSET_TWIN_STEPS.length);

        void recordAudit({
          action: `Ran Digital Twin Simulation [SIMULATION ONLY]: "${title}". Identified ${sim.affectedAssets.length} assets, ${sim.affectedCases.length} cases, and ${sim.recommendedAlternatives.length} mitigations.`,
          actionCode: "SIMULATION_APPLIED",
          entityType: "schedule",
          entityId: `sim-twin-${selectedScenarioType}`,
          caseId: sim.affectedCases[0]?.caseNumber || null,
          metadata: {
            scenarioType: selectedScenarioType,
            metrics: sim.metrics,
            isSimulationOnly: true,
          },
        });
      }, 400 * ASSET_TWIN_STEPS.length),
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 sm:py-10 space-y-6">
      {/* Page Header */}
      <PageHeader
        eyebrow="Predictive Operations & Digital Twin"
        title="What-If Simulation Engine"
        description="High-fidelity in-memory digital twin modeling. Model judge absences, courtroom closures, police vehicle breakdowns, evidence locker lockouts, officer leaves, and custody transfer delays without modifying live cause lists or production databases."
        actions={
          simulationCategory === "judicial" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={loadJudicialDemo}
              disabled={!engineData.data || runningJudicial}
              title="Pre-fill the first judge who has active hearings as a demo scenario"
              className="gap-1.5"
            >
              <FlaskConical className="size-4 text-primary" />
              Load Demo Judge
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSelectPresetScenario(PRESET_SIMULATION_SCENARIOS[0]!)}
              className="gap-1.5"
            >
              <Sparkles className="size-4 text-primary" />
              Reset to Vehicle Scenario
            </Button>
          )
        }
      />

      {/* TOP CATEGORY SELECTOR */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-muted/60 rounded-xl border border-border/80 w-fit">
        <button
          type="button"
          onClick={() => {
            setSimulationCategory("police-assets");
            discardJudicial();
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border shrink-0",
            simulationCategory === "police-assets"
              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
              : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
          )}
        >
          <ShieldCheck className="size-4 text-current" />
          <span>Police Asset / Evidence Impact</span>
          <Badge
            variant="secondary"
            className="text-[10px] py-0 px-1 font-mono uppercase bg-white/20 text-current"
          >
            New Category
          </Badge>
        </button>

        <button
          type="button"
          onClick={() => {
            setSimulationCategory("judicial");
            discardAssetTwin();
          }}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all border shrink-0",
            simulationCategory === "judicial"
              ? "bg-primary text-primary-foreground border-primary shadow-xs font-bold"
              : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
          )}
        >
          <Gavel className="size-4 text-current" />
          <span>Judicial Bench & Courtroom Availability</span>
          <span className="text-[10px] opacity-75">({judges.length} Judges)</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* CATEGORY 1: POLICE ASSET / EVIDENCE IMPACT SIMULATION                */}
      {/* ==================================================================== */}
      {simulationCategory === "police-assets" && (
        <div className="space-y-6">
          {/* SIMULATION ONLY WATERMARK CALLOUT */}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-300">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-bold text-xs uppercase tracking-wider">
                  Simulation Only — In-Memory Digital Twin Sandbox
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                  All disruptions, chain-of-custody impacts, and alternatives are computed on an
                  in-memory replica graph. Production database records are strictly unaltered.
                </p>
              </div>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] font-mono border-amber-500/40 shrink-0 uppercase"
            >
              No Production Changes
            </Badge>
          </div>

          {/* PRESET SCENARIO SELECTOR CARDS */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {PRESET_SIMULATION_SCENARIOS.map((preset) => {
              const isSelected = selectedScenarioType === preset.id;
              const Icon =
                preset.id === "vehicle-unavailable"
                  ? Car
                  : preset.id === "locker-unavailable"
                    ? Lock
                    : preset.id === "officer-on-leave"
                      ? Users
                      : Truck;

              return (
                <Card
                  key={preset.id}
                  onClick={() => handleSelectPresetScenario(preset)}
                  className={cn(
                    "cursor-pointer transition-all hover:border-primary/50 shadow-xs",
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "border-border/80 bg-card",
                  )}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          "flex size-8 items-center justify-center rounded-lg",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </div>
                      {isSelected && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] font-bold">
                          Active
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xs font-bold text-foreground mt-2">
                      {preset.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-1">
                    <p className="text-[11px] font-semibold text-primary/90 font-mono">
                      {preset.tagline}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {preset.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* SCENARIO CONFIGURATION PARAMETERS */}
          <Card className="shadow-xs border-border/80">
            <CardHeader className="pb-3 px-4 sm:px-6">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="size-4 text-primary" />
                Scenario Parameters Configuration
              </CardTitle>
              <CardDescription>
                Customize the simulation inputs to test specific vehicles, evidence lockers,
                officers, or transfer delay windows.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {/* Specific Parameter Based on Scenario */}
                {selectedScenarioType === "vehicle-unavailable" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vehicle Registration / Asset Code</Label>
                      <Input
                        value={targetAssetCode}
                        onChange={(e) => setTargetAssetCode(e.target.value)}
                        placeholder="e.g. VH-1045"
                        className="text-xs font-mono h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Default: VH-1045 (Mahindra Bolero Mobile Crime Unit)
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Simulated Date of Disruption</Label>
                      <Input
                        value={simulatedDate}
                        onChange={(e) => setSimulatedDate(e.target.value)}
                        placeholder="e.g. Tomorrow (11:30 AM)"
                        className="text-xs h-9"
                      />
                    </div>
                  </>
                )}

                {selectedScenarioType === "locker-unavailable" && (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Evidence Locker / Malkhana Vault Unit</Label>
                      <Input
                        value={targetLockerLocation}
                        onChange={(e) => setTargetLockerLocation(e.target.value)}
                        placeholder="e.g. Locker L-12 (Central Malkhana High-Security Vault)"
                        className="text-xs font-mono h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Simulates biometric lock failure for Locker L-12 containing physical
                        exhibits.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Simulated Hearing Window</Label>
                      <Input
                        value={simulatedDate}
                        onChange={(e) => setSimulatedDate(e.target.value)}
                        placeholder="e.g. Today (11:00 AM)"
                        className="text-xs h-9"
                      />
                    </div>
                  </>
                )}

                {selectedScenarioType === "officer-on-leave" && (
                  <>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Officer Name & Role</Label>
                      <Input
                        value={targetOfficerName}
                        onChange={(e) => setTargetOfficerName(e.target.value)}
                        placeholder="e.g. Insp. Rajesh Sharma"
                        className="text-xs h-9"
                      />
                      <p className="text-[10px] text-muted-foreground">
                        Senior Investigating Officer with active session depositions and checked-out
                        armory weapons.
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Scheduled Trial Testimony Date</Label>
                      <Input
                        value={simulatedDate}
                        onChange={(e) => setSimulatedDate(e.target.value)}
                        placeholder="e.g. In 3 Days (11:00 AM)"
                        className="text-xs h-9"
                      />
                    </div>
                  </>
                )}

                {selectedScenarioType === "transfer-delayed" && (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Transfer Manifest Reference</Label>
                      <Input
                        value={targetTransferId}
                        onChange={(e) => setTargetTransferId(e.target.value)}
                        placeholder="e.g. TRF-NDPS-89"
                        className="text-xs font-mono h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Transit Delay Duration (Hours)</Label>
                      <Input
                        type="number"
                        min={12}
                        max={120}
                        value={delayHours}
                        onChange={(e) => setDelayHours(Number(e.target.value))}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Impacted Court Session</Label>
                      <Input
                        value={simulatedDate}
                        onChange={(e) => setSimulatedDate(e.target.value)}
                        placeholder="e.g. In 2 Days (02:00 PM)"
                        className="text-xs h-9"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/60">
                <p className="text-xs text-muted-foreground">
                  Click run to compute the multi-domain ripple effects across assets, officers,
                  trial cases, and legal documents.
                </p>
                <div className="flex items-center gap-2">
                  {assetTwinResult && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={discardAssetTwin}
                      className="h-9 text-xs"
                    >
                      Reset
                    </Button>
                  )}
                  <Button
                    onClick={runAssetTwinSimulation}
                    disabled={runningAssetTwin}
                    className="gap-2 h-9 text-xs font-semibold"
                  >
                    {runningAssetTwin ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Running Digital Twin Sandbox...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-4" />
                        Run Digital Twin Simulation
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* SIMULATION STEPPER PROGRESS */}
          {runningAssetTwin && (
            <Card className="border-primary/30 bg-primary/5 shadow-xs">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-primary mb-3 flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  Digital Twin Processing Engine: Resolving Operational Interdependencies
                </p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {ASSET_TWIN_STEPS.map((s, idx) => {
                    const isDone = assetTwinStep > idx;
                    const isCurrent = assetTwinStep === idx;
                    const Icon = s.icon;

                    return (
                      <div
                        key={s.key}
                        className={cn(
                          "rounded-lg border p-2.5 text-xs transition-all flex items-center gap-2",
                          isCurrent
                            ? "border-primary bg-primary/15 text-primary font-semibold shadow-xs"
                            : isDone
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : "border-border/60 bg-muted/20 text-muted-foreground opacity-60",
                        )}
                      >
                        <div
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                            isDone
                              ? "bg-emerald-500 text-white"
                              : isCurrent
                                ? "bg-primary text-primary-foreground animate-pulse"
                                : "bg-muted text-muted-foreground",
                          )}
                        >
                          {isDone ? <CheckCircle2 className="size-3" /> : idx + 1}
                        </div>
                        <span className="text-[11px] line-clamp-1">{s.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SIMULATION RESULTS VIEW */}
          {assetTwinResult && (
            <div className="space-y-6">
              {/* Prominent Simulated Result Watermark Banner */}
              <div className="rounded-xl border-2 border-dashed border-primary/40 bg-card p-5 shadow-panel space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-primary text-primary-foreground font-mono text-xs font-bold uppercase tracking-wider">
                      Simulated Result Only
                    </Badge>
                    <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                      Digital Twin Sandbox
                    </Badge>
                  </div>
                  <time className="text-xs text-muted-foreground">
                    Model Run: {new Date(assetTwinResult.simulatedAt).toLocaleString("en-IN")}
                  </time>
                </div>

                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground">
                    {assetTwinResult.scenario.title}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {assetTwinResult.summary}
                  </p>
                </div>

                {/* KPI METRICS ROW */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 pt-2">
                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">Affected Assets</p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {assetTwinResult.metrics.totalAssetsAffected}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Affected Officers
                    </p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {assetTwinResult.metrics.totalOfficersAffected}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">Affected Cases</p>
                    <p className="text-xl font-bold text-primary mt-1">
                      {assetTwinResult.metrics.totalCasesAffected}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Adjournment Risk
                    </p>
                    <p className="text-xl font-bold text-destructive mt-1">
                      {assetTwinResult.metrics.highRiskAdjournmentCount} High
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Affected Evidence
                    </p>
                    <p className="text-xl font-bold text-foreground mt-1">
                      {assetTwinResult.metrics.totalEvidenceAffected}
                    </p>
                  </div>

                  <div className="rounded-lg border border-border/80 bg-muted/40 p-3 text-center">
                    <p className="text-[11px] font-medium text-muted-foreground">Alternatives</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {assetTwinResult.recommendedAlternatives.length} Ready
                    </p>
                  </div>
                </div>
              </div>

              {/* IMPACT INSPECTION SUB-TABS */}
              <div className="space-y-4">
                <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border/80 pb-1">
                  <button
                    type="button"
                    onClick={() => setActiveImpactTab("cases")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      activeImpactTab === "cases"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Scale className="size-3.5" />
                    <span>Affected Cases & Hearings ({assetTwinResult.affectedCases.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveImpactTab("assets")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      activeImpactTab === "assets"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Package className="size-3.5" />
                    <span>Affected Assets ({assetTwinResult.affectedAssets.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveImpactTab("officers")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      activeImpactTab === "officers"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Users className="size-3.5" />
                    <span>Affected Officers ({assetTwinResult.affectedOfficers.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveImpactTab("evidence")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      activeImpactTab === "evidence"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <ShieldCheck className="size-3.5" />
                    <span>Affected Evidence ({assetTwinResult.affectedEvidence.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveImpactTab("documents")}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shrink-0",
                      activeImpactTab === "documents"
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-card text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <FileText className="size-3.5" />
                    <span>Affected Documents ({assetTwinResult.affectedDocuments.length})</span>
                  </button>
                </div>

                {/* TAB CONTENT: AFFECTED CASES */}
                {activeImpactTab === "cases" && (
                  <div className="space-y-3">
                    {assetTwinResult.affectedCases.map((c) => (
                      <Card key={c.caseId} className="border-border/80 shadow-xs">
                        <CardContent className="p-4 space-y-2.5">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono font-bold">
                                {c.caseNumber}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {c.category}
                              </Badge>
                            </div>
                            <Badge
                              className={cn(
                                "text-xs font-bold uppercase",
                                c.adjournmentRisk === "HIGH_RISK_OF_ADJOURNMENT"
                                  ? "bg-destructive/15 text-destructive border-destructive/30 animate-pulse"
                                  : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
                              )}
                            >
                              <AlertTriangle className="size-3 mr-1 inline" />
                              {c.adjournmentRisk.replace(/_/g, " ")}
                            </Badge>
                          </div>

                          <div>
                            <h4 className="text-sm font-semibold text-foreground">{c.caseTitle}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Stage: <strong className="text-foreground">{c.stage}</strong> •
                              Scheduled Session:{" "}
                              <strong className="text-primary">{c.scheduledHearingDate}</strong> in{" "}
                              {c.hearingCourtroom} ({c.judgeName})
                            </p>
                          </div>

                          <div className="rounded-md bg-destructive/5 p-2.5 border border-destructive/20 text-xs text-destructive">
                            <strong>Hearing Vulnerability:</strong> {c.riskRationale}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* TAB CONTENT: AFFECTED ASSETS */}
                {activeImpactTab === "assets" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assetTwinResult.affectedAssets.map((ast) => (
                      <Card key={ast.id} className="border-border/80 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <Badge className="bg-primary/10 text-primary border-primary/20 font-mono text-xs font-bold">
                              {ast.assetCode}
                            </Badge>
                            <Badge variant="destructive" className="text-[10px] font-bold">
                              {ast.status}
                            </Badge>
                          </div>
                          <h4 className="text-xs font-bold text-foreground">{ast.name}</h4>
                          <div className="text-[11px] text-muted-foreground space-y-0.5">
                            <p>
                              Category:{" "}
                              <strong className="text-foreground">{ast.categoryName}</strong>
                            </p>
                            <p>
                              Location: <strong className="text-foreground">{ast.location}</strong>
                            </p>
                            <p>
                              Custodian:{" "}
                              <strong className="text-foreground">{ast.custodian}</strong>
                            </p>
                          </div>
                          <p className="text-xs text-destructive bg-destructive/5 p-2 rounded border border-destructive/20">
                            <strong>Impact:</strong> {ast.impactReason}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* TAB CONTENT: AFFECTED OFFICERS */}
                {activeImpactTab === "officers" && (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {assetTwinResult.affectedOfficers.map((off) => (
                      <Card key={off.id} className="border-border/80 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
                              <UserCheck className="size-4 text-primary" />
                              {off.name}
                            </div>
                            <Badge variant="outline" className="text-[10px] font-mono">
                              {off.role}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Station: <strong className="text-foreground">{off.station}</strong> •
                            Active Dockets:{" "}
                            <strong className="text-foreground">{off.activeCasesCount}</strong>
                          </p>
                          <div className="rounded-md bg-muted/60 p-2.5 border border-border/60 text-xs text-foreground space-y-1">
                            <p>
                              <strong>Operational Impact:</strong> {off.dutyImpact}
                            </p>
                            <p className="text-primary font-medium">
                              <strong>Recommended Substitute:</strong> {off.recommendedSubstitute}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* TAB CONTENT: AFFECTED EVIDENCE */}
                {activeImpactTab === "evidence" && (
                  <div className="space-y-3">
                    {assetTwinResult.affectedEvidence.map((ev) => (
                      <Card key={ev.id} className="border-border/80 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-mono text-xs font-bold">
                                {ev.assetCode}
                              </Badge>
                              <span className="font-semibold text-xs text-foreground">
                                {ev.name}
                              </span>
                            </div>
                            {ev.tamperSealNumber && (
                              <Badge
                                variant="outline"
                                className="font-mono text-[10px] text-emerald-600"
                              >
                                Seal #{ev.tamperSealNumber}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Storage Location:{" "}
                            <strong className="text-foreground">{ev.storageLocation}</strong> •
                            Status: {ev.currentStatus}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2 text-xs">
                            <div className="rounded bg-destructive/5 p-2 border border-destructive/20 text-destructive">
                              <strong>Chain of Custody Risk:</strong> {ev.chainOfCustodyRisk}
                            </div>
                            <div className="rounded bg-amber-500/5 p-2 border border-amber-500/20 text-amber-800 dark:text-amber-200">
                              <strong>BSA §63 Admissibility:</strong> {ev.admissibilityConcern}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* TAB CONTENT: AFFECTED DOCUMENTS */}
                {activeImpactTab === "documents" && (
                  <div className="space-y-3">
                    {assetTwinResult.affectedDocuments.map((doc) => (
                      <Card key={doc.id} className="border-border/80 shadow-xs">
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20 font-mono text-xs font-bold">
                                {doc.documentNumber}
                              </Badge>
                              <span className="font-semibold text-xs text-foreground">
                                {doc.title}
                              </span>
                            </div>
                            <Badge variant="outline" className="text-[10px]">
                              {doc.category}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Associated Case:{" "}
                            <strong className="text-primary font-mono">
                              {doc.caseNumber || "Unassigned"}
                            </strong>
                          </p>
                          <div className="rounded bg-muted/60 p-2 font-mono text-[11px] text-muted-foreground flex items-center justify-between">
                            <span className="truncate">SHA-256: {doc.sha256}</span>
                            <Badge
                              variant="secondary"
                              className="text-[9px] uppercase shrink-0 ml-2"
                            >
                              Cryptographic Seal Intact
                            </Badge>
                          </div>
                          <p className="text-xs text-foreground bg-muted/40 p-2 rounded border border-border/60">
                            <strong>Filing / Evidence Impact:</strong> {doc.documentImpact}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {/* RECOMMENDED ALTERNATIVES & MITIGATION PROTOCOLS */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="size-4 text-emerald-600 dark:text-emerald-400" />
                    Recommended Alternatives & Operational Mitigations (
                    {assetTwinResult.recommendedAlternatives.length})
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    Deterministic Resolution
                  </Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {assetTwinResult.recommendedAlternatives.map((alt, idx) => (
                    <Card
                      key={alt.id}
                      className="border-emerald-500/30 bg-emerald-500/5 shadow-xs flex flex-col justify-between"
                    >
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge className="bg-emerald-500 text-white text-[10px] font-bold">
                            Alternative #{idx + 1}
                          </Badge>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="text-[10px] font-mono border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold"
                            >
                              {alt.feasibilityScore}% Feasibility Fit
                            </Badge>
                            <Badge
                              className={cn(
                                "text-[10px] font-bold uppercase",
                                alt.priority === "CRITICAL"
                                  ? "bg-destructive text-destructive-foreground"
                                  : "bg-primary text-primary-foreground",
                              )}
                            >
                              {alt.priority}
                            </Badge>
                          </div>
                        </div>
                        <CardTitle className="text-xs font-bold text-foreground mt-2">
                          {alt.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-4 pt-1 space-y-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {alt.description}
                        </p>

                        <div className="rounded-lg bg-background/80 p-3 border border-emerald-500/20 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                            Step-by-Step Action Plan:
                          </p>
                          <ul className="space-y-1 text-xs text-foreground">
                            {alt.actionSteps.map((step, sIdx) => (
                              <li key={sIdx} className="flex items-start gap-1.5">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {sIdx + 1}.
                                </span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="text-[11px] text-muted-foreground border-t border-emerald-500/20 pt-2 space-y-0.5">
                          <p>
                            Assigned Resource:{" "}
                            <strong className="text-foreground">{alt.resourceAssigned}</strong>
                          </p>
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-400">
                            {alt.complianceNotes}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Reset / Explore Another */}
              <div className="flex justify-center pt-2">
                <Button variant="outline" onClick={discardAssetTwin} className="gap-2">
                  <RotateCcw className="size-4" />
                  Explore Another Scenario
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* CATEGORY 2: JUDICIAL BENCH & COURTROOM SCHEDULING (PRESERVED)        */}
      {/* ==================================================================== */}
      {simulationCategory === "judicial" && (
        <div className="space-y-6">
          {(cases.isError || engineData.isError) && (
            <ErrorState
              title="Could not load What-If Simulation data"
              error={cases.error ?? engineData.error}
              onRetry={() => {
                void cases.refetch();
                void engineData.refetch();
              }}
              retrying={cases.isFetching || engineData.isFetching}
            />
          )}

          <Card className="shadow-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FlaskConical className="size-4 text-primary" />
                Judicial Scenario Definition
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Condition</Label>
                  <Select
                    value={conditionType}
                    onValueChange={(v: "judge-unavailable" | "courtroom-closure") => {
                      setConditionType(v);
                      discardJudicial();
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="judge-unavailable">
                        Judge emergency leave / absence on a date
                      </SelectItem>
                      <SelectItem value="courtroom-closure">
                        Courtroom emergency infrastructure closure
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {conditionType === "judge-unavailable" ? (
                  <div className="space-y-2">
                    <Label htmlFor="sim-judge">Judge</Label>
                    <Select
                      value={judgeId}
                      onValueChange={(v) => {
                        setJudgeId(v);
                        discardJudicial();
                      }}
                    >
                      <SelectTrigger id="sim-judge">
                        <SelectValue placeholder="Select a judge" />
                      </SelectTrigger>
                      <SelectContent>
                        {judges.map((j) => (
                          <SelectItem key={j.id} value={j.id}>
                            {j.name} · {j.specialisation || "General"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="sim-room">Courtroom</Label>
                    <Select
                      value={courtroomId}
                      onValueChange={(v) => {
                        setCourtroomId(v);
                        discardJudicial();
                      }}
                    >
                      <SelectTrigger id="sim-room">
                        <SelectValue placeholder="Select a courtroom" />
                      </SelectTrigger>
                      <SelectContent>
                        {courtrooms.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} (Capacity: {c.capacity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sim-date">Date of simulated absence</Label>
                  <Input
                    id="sim-date"
                    type="date"
                    value={date}
                    onChange={(e) => {
                      setDate(e.target.value);
                      discardJudicial();
                    }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-muted-foreground">
                  The real schedule is never touched until you explicitly press Commit.
                </p>
                <div className="flex items-center gap-2">
                  {judicialResult && (
                    <Button variant="ghost" size="sm" onClick={discardJudicial}>
                      Discard
                    </Button>
                  )}
                  <Button
                    onClick={runJudicial}
                    disabled={runningJudicial || !date}
                    className="gap-2"
                  >
                    {runningJudicial && <Loader2 className="size-4 animate-spin" />}
                    {runningJudicial ? "Simulating…" : "Run Simulation"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stepper Progress */}
          {runningJudicial && (
            <Card className="border-primary/40 bg-primary/5 shadow-panel">
              <CardContent className="p-6">
                <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {JUDICIAL_STEPS.map((s, idx) => {
                    const isDone = judicialStep > idx;
                    const isCurrent = judicialStep === idx;
                    const Icon = s.icon;
                    return (
                      <li key={s.key} className="flex items-center gap-3">
                        <div
                          className={cn(
                            "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                            isDone
                              ? "border-primary bg-primary text-primary-foreground"
                              : isCurrent
                                ? "border-primary bg-background text-primary"
                                : "border-border bg-muted text-muted-foreground",
                          )}
                        >
                          {isDone ? <CheckCircle2 className="size-4" /> : idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <Icon className="size-3.5 text-muted-foreground" />
                            {s.label}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          )}

          {/* Judicial Results View */}
          {judicialResult && (
            <div className="space-y-6">
              <Card className="shadow-panel">
                <CardHeader>
                  <CardTitle className="text-base">Impacted Judicial Hearings</CardTitle>
                  <CardDescription>
                    {judicialResult.affected.length} hearing(s) affected by the simulated condition
                    on {judicialResult.date}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {judicialResult.affected.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No active hearings were listed on this date.
                    </p>
                  ) : (
                    judicialResult.affected.map((h) => (
                      <div
                        key={h.scheduleId}
                        className="rounded-lg border border-border p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-foreground">
                            {h.caseRow.case_number} · {h.caseRow.parties}
                          </span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {h.caseRow.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Slot: {formatSlotLabel(h.slot)} • Current Judge: {h.judge.name}
                        </p>
                        <div className="pt-2">
                          <p className="text-xs font-semibold text-foreground mb-2">
                            Recommended Reassignments:
                          </p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {h.alternatives.map((alt) => (
                              <div
                                key={alt.key}
                                onClick={() =>
                                  setChoices((prev) => ({ ...prev, [h.scheduleId]: alt.key }))
                                }
                                className={cn(
                                  "cursor-pointer rounded border p-2 text-xs transition-all",
                                  choices[h.scheduleId] === alt.key
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-muted/50",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-foreground">
                                    {alt.judge.name}
                                  </span>
                                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px]">
                                    Fit {alt.score}/100
                                  </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {alt.courtroom.name} • {formatSlotLabel(alt.slot)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}

                  {judicialResult.affected.length > 0 && (
                    <div className="flex justify-end pt-3">
                      <Button
                        onClick={applyJudicialCommit}
                        disabled={applying}
                        className="gap-2 text-xs font-semibold"
                      >
                        {applying && <Loader2 className="size-4 animate-spin" />}
                        Commit Simulated Reassignments
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
