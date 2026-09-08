import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Gavel,
  ClipboardList,
  Search,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Landmark,
  Shield,
  FileSearch,
  FlaskConical,
  Scale,
  PackageCheck,
  FileText,
  UserCog,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/brand-mark";
import { supabase } from "@/integrations/supabase/client";
import { getOfflineStaffSession } from "@/lib/offline-auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "NyayaSetu — Unified Legal & Judicial Workspace Portal" },
      {
        name: "description",
        content:
          "Secure Digital Document Management System, Police Asset Lifecycle, and Smart Court Scheduling platform for Indian Judicial and Law Enforcement workspaces.",
      },
      { property: "og:title", content: "NyayaSetu — Choose Your Workspace" },
      {
        property: "og:description",
        content:
          "Unified digital justice portal for Police, Forensics, Investigation, Judiciary, Prosecution, and Litigants.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalPage,
});

interface WorkspaceCardEntry {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  cta: string;
  to: string;
  search?: { workspace: string } | undefined;
  badge?: string | undefined;
  accent?: string | undefined;
}

const entries: WorkspaceCardEntry[] = [
  {
    key: "police",
    icon: Shield,
    eyebrow: "Law Enforcement & Station Duty",
    title: "Police Workspace",
    description:
      "Station patrol officers, beat constables, and tactical fleet operators managing assigned weapons, surveillance bodycams, and patrol vehicles.",
    points: [
      "Field equipment & vehicle status lifecycle",
      "Departmental notifications & station duty roster",
      "Two-officer custody handover protocols",
    ],
    cta: "Enter Police Workspace",
    to: "/auth",
    search: { workspace: "police" },
    badge: "MHA Aligned",
    accent: "text-slate-700 bg-slate-100 dark:text-slate-300 dark:bg-slate-800",
  },
  {
    key: "investigation",
    icon: FileSearch,
    eyebrow: "Criminal Investigation & IOs",
    title: "Investigation Workspace",
    description:
      "Investigating Officers (IOs) and Cyber Crime specialists recording FIRs, investigation diaries, witness depositions, and crime scene seizures.",
    points: [
      "Digital FIR filings & case diary logging under BNSS",
      "Witness statement recording & tamper-evident logs",
      "Evidence seizure memos & road dispatch certificates",
    ],
    cta: "Enter Investigation Workspace",
    to: "/auth",
    search: { workspace: "investigation" },
    badge: "BNSS / BNS",
    accent: "text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30",
  },
  {
    key: "forensic",
    icon: FlaskConical,
    eyebrow: "Forensic Laboratory (CFSL / FSL)",
    title: "Forensic Workspace",
    description:
      "Forensic scientists, ballistic experts, and cyber examiners recording forensic extractions, laboratory findings, and BSA Section 63 certificates.",
    points: [
      "Incoming forensic exhibit queue & examination records",
      "Ballistics, DNA & cyber extraction reports",
      "Statutory BSA Section 63 cryptographic certification",
    ],
    cta: "Enter Forensic Workspace",
    to: "/auth",
    search: { workspace: "forensic" },
    badge: "BSA § 63",
    accent: "text-cyan-700 bg-cyan-100 dark:text-cyan-300 dark:bg-cyan-900/30",
  },
  {
    key: "court",
    icon: Gavel,
    eyebrow: "Judicial Officers & Registrars",
    title: "Judicial / Court Workspace",
    description:
      "Judges and court registrars managing daily cause lists, AI-assisted smart hearing schedules, courtroom allocations, and conflict resolutions.",
    points: [
      "Deterministic AI smart scheduling engine",
      "Judge bench cause lists with transparent listing rationale",
      "Conflict detection & digital twin What-If simulation",
    ],
    cta: "Enter Court Workspace",
    to: "/auth",
    search: { workspace: "court" },
    badge: "eCourts Core",
    accent: "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30",
  },
  {
    key: "legal",
    icon: Scale,
    eyebrow: "Prosecution & Legal Counsel",
    title: "Legal & Prosecution Workspace",
    description:
      "Public Prosecutors and government advocates scrutinizing police charge sheets, trial filings, legal notices, and verified case exhibits.",
    points: [
      "Prosecution scrutiny of investigation charge sheets",
      "Inspection of verified criminal evidence & exhibits",
      "Judicial filings, legal notices & judgment archives",
    ],
    cta: "Enter Legal Workspace",
    to: "/auth",
    search: { workspace: "legal" },
    badge: "Prosecution",
    accent: "text-teal-700 bg-teal-100 dark:text-teal-300 dark:bg-teal-900/30",
  },
  {
    key: "evidence",
    icon: PackageCheck,
    eyebrow: "Malkhana Moharrir & Vault Officers",
    title: "Evidence Custodian Workspace",
    description:
      "Malkhana custodians managing secure evidence vaults, lockers, tamper seals, chain-of-custody transfer receipts, and lab dispatches.",
    points: [
      "Biometric malkhana vault locker inventory",
      "Transit tamper seal tracking & receipt verification",
      "Algorithmic unbroken custody verifier under BSA",
    ],
    cta: "Enter Evidence Workspace",
    to: "/auth",
    search: { workspace: "evidence" },
    badge: "Chain of Custody",
    accent: "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/30",
  },
  {
    key: "documents",
    icon: FileText,
    eyebrow: "Court Record Room & Vault Officers",
    title: "Documents & Records Workspace",
    description:
      "Records officers maintaining the Secure Digital Document Vault, multi-version immutable archives, SHA-256 integrity, and digital signatures.",
    points: [
      "Cryptographic SHA-256 document integrity watchdog",
      "Immutable multi-version history (V1, V2, V3...)",
      "Digital signatures & Section 63 BSA compliance",
    ],
    cta: "Enter Document Workspace",
    to: "/auth",
    search: { workspace: "documents" },
    badge: "Secure DMS",
    accent: "text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/30",
  },
  {
    key: "admin",
    icon: UserCog,
    eyebrow: "System & Judicial Administrators",
    title: "Administration Workspace",
    description:
      "Chief judicial administrators managing users, roles, Least-Privilege permissions (RBAC), security integrity alerts, and registry governance.",
    points: [
      "User accounts, role provisioning & permission matrix",
      "Real-time security alerts & immutable audit trail",
      "Department configuration & priority scoring thresholds",
    ],
    cta: "Enter Admin Workspace",
    to: "/auth",
    search: { workspace: "admin" },
    badge: "Full RBAC",
    accent: "text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30",
  },
  {
    key: "public",
    icon: Search,
    eyebrow: "Litigants & General Public",
    title: "Public Case Status Lookup",
    description:
      "Enter your 16-digit CNR or Case Number to check current case stage, next hearing date, allocated judge, and courtroom — no login required.",
    points: [
      "Next hearing date, judge bench and courtroom",
      "Real-time daily cause list position lookup",
      "Available in English, हिन्दी and regional languages",
    ],
    cta: "Check Public Case Status",
    to: "/case-status",
    search: undefined,
    badge: "Citizen Open",
    accent: "text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30",
  },
];

function PortalPage() {
  const navigate = useNavigate();
  const [signedInRole, setSignedInRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Check online user
      const { data } = await supabase.auth.getUser();
      if (active && data.user) {
        const { data: roles } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        if (!active) return;
        const r = roles?.[0]?.role || "registrar";
        setSignedInRole(r);
        return;
      }

      // Check offline session
      const offline = getOfflineStaffSession();
      if (active && offline) {
        setSignedInRole(offline.role);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Top Banner Header */}
      <header className="border-b border-primary/20 bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark className="size-11 bg-white p-0.5 shadow-xs" showLabel />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-base font-bold tracking-tight">NyayaSetu</p>
                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-primary-foreground/20 text-primary-foreground">
                  SIH 26190 Prototype
                </span>
              </div>
              <p className="text-xs text-primary-foreground/80">
                Secure Document Vault · Police Assets · Smart Judicial Scheduling
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-3 border-l border-primary-foreground/20 pl-4 text-xs text-primary-foreground/80 sm:flex">
            <Landmark className="size-4 text-accent" />
            <span>Ministry of Law & Justice / Department of Justice</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="registry-enter border-b border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5 text-primary text-xs font-semibold mb-3">
              <Sparkles className="size-3.5" />
              <span>Unified National Justice & Investigation Infrastructure</span>
            </div>
            <h1 className="text-3xl leading-tight font-extrabold text-foreground sm:text-5xl tracking-tight">
              One Secure Platform for Police, Forensics & the Judiciary.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
              NyayaSetu seamlessly bridges criminal investigation with judicial proceedings. Under
              one unified Supabase authentication engine, every case connects digital police
              diaries, forensic examination reports, malkhana chain-of-custody ledgers, and
              AI-assisted court scheduling.
            </p>
          </div>
          <div className="registry-interactive border border-border bg-background p-5 rounded-xl shadow-xs">
            <BrandMark
              className="mx-auto h-48 w-full max-w-sm bg-white p-3 sm:h-56 rounded-lg"
              imageClassName="drop-shadow-xs"
              showLabel
            />
          </div>
          <div className="grid gap-3 border-l-0 border-border text-sm sm:grid-cols-3 lg:col-span-2 lg:grid-cols-3">
            {[
              ["01", "Secure Document Vault", "SHA-256 verified legal filings, FIRs & charge sheets"],
              ["02", "Malkhana Custody & Assets", "Tamper-evident chain of custody & equipment state machine"],
              ["03", "Smart Court Scheduling", "Deterministic listing, conflict avoidance & cause lists"],
            ].map(([number, label, desc], index) => (
              <div
                key={number}
                className="registry-enter flex flex-col gap-1 border-b sm:border-b-0 sm:border-r last:border-r-0 border-border pb-3 sm:pb-0 sm:pr-4"
                style={{ animationDelay: `${120 + index * 80}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-serif text-2xl font-bold text-primary">{number}</span>
                  <span className="font-semibold text-foreground text-sm">{label}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Choose Workspace Section */}
      <section className="registry-enter mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-border pb-6">
          <div>
            <p className="text-eyebrow text-xs uppercase tracking-wider text-primary font-bold">
              Choose Your Workspace
            </p>
            <h2 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
              Select Departmental Portal to Continue
            </h2>
          </div>
          <p className="max-w-xl text-xs sm:text-sm leading-relaxed text-muted-foreground">
            Sign in with your official court, police, or forensic credentials. Access is strictly
            governed by Least-Privilege Role-Based Access Control (RBAC). Litigants may check public
            status without logging in.
          </p>
        </div>

        {signedInRole && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-5 py-3.5">
            <div className="flex items-center gap-3">
              <ShieldCheck className="size-5 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Active Session Detected ({signedInRole.toUpperCase()})
                </p>
                <p className="text-xs text-muted-foreground">
                  You are already authenticated. You can continue directly to your workspace.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() =>
                navigate({ to: signedInRole === "judge" ? "/bench" : "/dashboard", replace: true })
              }
              className="gap-2"
            >
              Enter My Workspace
              <ArrowRight className="size-4" />
            </Button>
          </div>
        )}

        {/* 9 Workspaces Grid */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map((entry, index) => {
            const Icon = entry.icon;
            return (
              <article
                key={entry.key}
                className="registry-enter registry-interactive flex flex-col justify-between rounded-xl border border-border bg-card p-6 shadow-2xs hover:shadow-md transition-all hover:border-primary/50"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`flex size-11 items-center justify-center rounded-lg border border-border/80 shadow-2xs ${
                        entry.accent || "bg-secondary text-primary"
                      }`}
                    >
                      <Icon className="size-5.5" />
                    </span>
                    {entry.badge && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground font-mono">
                        {entry.badge}
                      </span>
                    )}
                  </div>

                  <p className="text-eyebrow mt-4 text-[11px] font-semibold text-primary">
                    {entry.eyebrow}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-foreground">{entry.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {entry.description}
                  </p>

                  <ul className="mt-4 space-y-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
                    {entry.points.map((point) => (
                      <li key={point} className="flex items-start gap-2">
                        <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" />
                        <span className="leading-snug">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-6 pt-2">
                  <Button asChild className="w-full justify-between h-9 text-xs font-semibold">
                    {entry.search ? (
                      <Link to={entry.to as any} search={entry.search as any}>
                        {entry.cta}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    ) : (
                      <Link to={entry.to as any}>
                        {entry.cta}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    )}
                  </Button>
                </div>
              </article>
            );
          })}
        </div>

        {/* Legal & Compliance Footer Notice */}
        <div className="mt-12 rounded-lg border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <strong className="text-foreground font-semibold">
              Statutory Compliance & Security Notice:
            </strong>{" "}
            NyayaSetu is designed in compliance with the Bharatiya Nyaya Sanhita (BNS, 2023),
            Bharatiya Nagarik Suraksha Sanhita (BNSS, 2023), and Section 63 of Bharatiya Sakshya
            Adhiniyam (BSA, 2023). All electronic records, document versions, and custody transfers
            are sealed with SHA-256 cryptographic digests and subject to immutable audit logging.
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Link
              to="/case-status"
              className="text-primary hover:underline font-semibold text-xs whitespace-nowrap"
            >
              Litigant Case Status →
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
