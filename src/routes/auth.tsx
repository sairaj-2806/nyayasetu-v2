import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import {
  Loader2,
  Gavel,
  ClipboardList,
  ArrowLeft,
  ShieldCheck,
  Shield,
  FileSearch,
  FlaskConical,
  Scale,
  PackageCheck,
  FileText,
  UserCog,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/lib/network-status";
import {
  authenticateOffline,
  cacheStaffCredentialsLocally,
  getOfflineStaffVault,
  SEED_OFFLINE_STAFF_ACCOUNTS,
} from "@/lib/offline-auth";
import { AppRole, canAccessWorkspace, normalizeRole, ROLE_METADATA } from "@/lib/rbac";

export type PortalWorkspace =
  | "police"
  | "investigation"
  | "forensic"
  | "court"
  | "legal"
  | "evidence"
  | "documents"
  | "admin";

const workspaceCopy: Record<
  PortalWorkspace,
  {
    eyebrow: string;
    heading: string;
    blurb: string;
    icon: React.ComponentType<{ className?: string }>;
    note: string;
  }
> = {
  police: {
    eyebrow: "Police Station & Patrol",
    heading: "Police Workspace Sign In",
    blurb: "Station patrol officers, beat constables, and tactical fleet operators.",
    icon: Shield,
    note: "Official police department ID required. Access is monitored and logged.",
  },
  investigation: {
    eyebrow: "Criminal Investigation",
    heading: "Investigation Workspace Sign In",
    blurb: "Investigating Officers (IOs), Cyber Cell, and case filing officers.",
    icon: FileSearch,
    note: "Restricted to authorized Investigating Officers under the BNSS & BNS frameworks.",
  },
  forensic: {
    eyebrow: "Forensic Laboratory (FSL / CFSL)",
    heading: "Forensic Workspace Sign In",
    blurb: "Scientific officers, ballistics experts, and BSA Section 63 certifiers.",
    icon: FlaskConical,
    note: "Forensic laboratory personnel credentials only. Digital signature credentials enforced.",
  },
  court: {
    eyebrow: "Judicial & Court Registry",
    heading: "Judicial / Court Sign In",
    blurb: "Judicial officers (Judges) and Registry Administrators.",
    icon: Gavel,
    note: "Bench accounts and registry logins issued by High Court eCourts administration.",
  },
  legal: {
    eyebrow: "Prosecution & Legal Counsel",
    heading: "Legal Officer Sign In",
    blurb: "Public Prosecutors, state attorneys, and legal scrutinizers.",
    icon: Scale,
    note: "Authorized prosecutors and government standing counsels only.",
  },
  evidence: {
    eyebrow: "Malkhana Vault Custody",
    heading: "Evidence Custodian Sign In",
    blurb: "Malkhana Moharrirs, evidence room in-charge, and vault handlers.",
    icon: PackageCheck,
    note: "Malkhana ledger custody logs are cryptographically immutable under BSA Section 63.",
  },
  documents: {
    eyebrow: "Secure Document Vault",
    heading: "Records & Vault Officer Sign In",
    blurb: "Court record room managers and digital document custody officers.",
    icon: FileText,
    note: "Manages immutable document versions, cryptographic digests, and tamper tracking.",
  },
  admin: {
    eyebrow: "System Administration",
    heading: "System Admin Sign In",
    blurb: "Chief judicial administrative officers and system engineers.",
    icon: UserCog,
    note: "Unrestricted security administration, RBAC governance, and system configuration.",
  },
};

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (
    search: Record<string, unknown>,
  ): { workspace?: PortalWorkspace; role?: string } => {
    let ws: PortalWorkspace = "court";
    const rawWs = String(search["workspace"] || "").toLowerCase();
    const rawRole = String(search["role"] || "").toLowerCase();

    if (rawWs in workspaceCopy) {
      ws = rawWs as PortalWorkspace;
    } else if (rawRole === "judge") {
      ws = "court";
    } else if (rawRole === "registrar") {
      ws = "court";
    }

    const result: { workspace?: PortalWorkspace; role?: string } = {
      workspace: ws,
    };
    if (rawRole) {
      result.role = rawRole;
    }
    return result;
  },

  head: () => ({
    meta: [
      { title: "Unified Portal Sign In — NyayaSetu" },
      {
        name: "description",
        content:
          "Unified Supabase authentication portal for Indian Police, Forensics, Judiciary, Prosecution, and Registry workspaces.",
      },
      { property: "og:title", content: "Unified Portal Sign In — NyayaSetu" },
      {
        property: "og:description",
        content:
          "Unified Supabase authentication portal for Indian Police, Forensics, Judiciary, Prosecution, and Registry workspaces.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const workspace: PortalWorkspace = search.workspace ?? "court";
  const copy = workspaceCopy[workspace] ?? workspaceCopy.court;
  const { isOnline } = useNetworkStatus();

  const WorkspaceIcon = copy.icon;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function routeForRoleAndWorkspace(role: AppRole, targetWs?: PortalWorkspace) {
    if (role === "judge") {
      return "/bench";
    }
    if (targetWs === "evidence" && (role === "evidence_custodian" || role === "admin")) {
      return "/evidence";
    }
    if (targetWs === "documents" && (role === "document_officer" || role === "admin" || role === "registrar")) {
      return "/documents";
    }
    if (targetWs === "admin" && role === "admin") {
      return "/admin";
    }
    return "/dashboard";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const cleanEmail = email.trim();

    // 1. If currently offline, authenticate directly via the local cryptographic vault
    if (!isOnline) {
      const offlineRes = await authenticateOffline(cleanEmail, password);
      setLoading(false);

      if (offlineRes.success && offlineRes.account) {
        const userRole = offlineRes.account.role;
        const roleDesc = ROLE_METADATA[userRole]?.label || userRole.toUpperCase();

        // Check workspace authorization
        if (workspace && !canAccessWorkspace(userRole, workspace)) {
          toast.warning("Role-Workspace Mismatch", {
            description: `You are signed in as ${roleDesc}. Directing to your authorized workspace.`,
          });
        } else {
          toast.success("Offline Authentication Successful", {
            description: `Signed in as ${offlineRes.account.fullName} (${roleDesc}) from secure offline vault.`,
            icon: <ShieldCheck className="size-4 text-amber-500" />,
          });
        }

        navigate({ to: routeForRoleAndWorkspace(userRole, workspace), replace: true });
        return;
      }

      setError(offlineRes.error || "Offline login failed. Verify your email and password.");
      return;
    }

    // 2. If online, attempt standard Supabase login
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (signInError || !data.user) {
        // Fallback to offline vault if network glitch
        if (signInError?.message?.includes("fetch") || signInError?.message?.includes("network")) {
          const fallbackRes = await authenticateOffline(cleanEmail, password);
          if (fallbackRes.success && fallbackRes.account) {
            setLoading(false);
            const userRole = fallbackRes.account.role;
            toast.warning("Network Unreachable — Signed in Offline", {
              description: `Signed in as ${fallbackRes.account.fullName} using cached cryptographic profile.`,
            });
            navigate({ to: routeForRoleAndWorkspace(userRole, workspace), replace: true });
            return;
          }
        }

        // Also check if matches demo offline vault account even in development
        const demoRes = await authenticateOffline(cleanEmail, password);
        if (demoRes.success && demoRes.account) {
          setLoading(false);
          const userRole = demoRes.account.role;
          toast.info("Demo Persona Signed In", {
            description: `Logged in as ${demoRes.account.fullName} (${ROLE_METADATA[userRole]?.label}).`,
          });
          navigate({ to: routeForRoleAndWorkspace(userRole, workspace), replace: true });
          return;
        }

        setLoading(false);
        setError("Invalid credentials. Contact your court/department administrator if the issue persists.");
        return;
      }

      // Online login succeeded: retrieve roles & bench details
      const [{ data: roles }, { data: profile }, { data: bench }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
        supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle(),
        supabase.from("judges").select("id, name").eq("user_id", data.user.id).maybeSingle(),
      ]);

      const userRoles = (roles?.map((r) => String(r.role)) || []) as string[];
      let computedRole: AppRole = "police_officer";
      if (userRoles.includes("admin")) computedRole = "admin";
      else if (userRoles.includes("judge") || bench?.id) computedRole = "judge";
      else if (userRoles.includes("investigating_officer")) computedRole = "investigating_officer";
      else if (userRoles.includes("forensic_officer")) computedRole = "forensic_officer";
      else if (userRoles.includes("evidence_custodian")) computedRole = "evidence_custodian";
      else if (userRoles.includes("legal_officer")) computedRole = "legal_officer";
      else if (userRoles.includes("document_officer")) computedRole = "document_officer";
      else if (userRoles.includes("police_officer")) computedRole = "police_officer";
      else if (userRoles.includes("registrar")) computedRole = "registrar";
      else if (userRoles[0]) computedRole = normalizeRole(userRoles[0]);

      // Cache credentials locally for future offline logins
      await cacheStaffCredentialsLocally(
        {
          id: data.user.id,
          email: cleanEmail,
          fullName: profile?.full_name || cleanEmail.split("@")[0] || "Staff",
          role: computedRole,
          judgeId: bench?.id || null,
          judgeName: bench?.name || null,
        },
        password,
      );

      setLoading(false);

      // Verify workspace authorization
      if (workspace && !canAccessWorkspace(computedRole, workspace)) {
        toast.warning("Redirected to Authorized Workspace", {
          description: `Your assigned role (${ROLE_METADATA[computedRole]?.label}) is not assigned to the ${workspace.toUpperCase()} workspace. Entering your standard workspace.`,
        });
      }

      navigate({ to: routeForRoleAndWorkspace(computedRole, workspace), replace: true });
    } catch (err) {
      console.warn("Sign in encountered exception, trying offline vault fallback", err);
      const fallbackRes = await authenticateOffline(cleanEmail, password);
      setLoading(false);
      if (fallbackRes.success && fallbackRes.account) {
        navigate({
          to: routeForRoleAndWorkspace(fallbackRes.account.role, workspace),
          replace: true,
        });
        return;
      }
      setError("Unable to connect to court authentication. Please check credentials or network.");
    }
  }

  // Quick fill demo helper
  function quickFillPersona(emailStr: string, defaultPw: string = "Court123!") {
    setEmail(emailStr);
    setPassword(defaultPw);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary px-12 py-14 text-primary-foreground lg:flex">
        <div className="flex items-center gap-3">
          <BrandMark className="size-12 bg-white p-0.5 shadow-xs" showLabel />
          <div>
            <span className="text-sm font-semibold tracking-wide block">NyayaSetu</span>
            <span className="text-[10px] text-primary-foreground/70 uppercase tracking-wider">
              Bridge to Justice · SIH 26190
            </span>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-2 font-semibold">
            Unified National Digital Justice Infrastructure
          </p>
          <h2 className="text-3xl leading-snug font-semibold">
            Secure DMS, Police Assets & Smart Judicial Scheduling.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
            One Supabase authentication engine governing Least-Privilege access across Police,
            Investigation, Forensics, Prosecution, Malkhana Custody, and Judicial Benches.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Authorised official use only. All actions are cryptographically signed and logged to an
          immutable audit ledger under Section 63, Bharatiya Sakshya Adhiniyam, 2023.
        </p>
      </section>

      <section className="flex items-center justify-center bg-background px-5 py-10 sm:px-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark className="size-10 bg-white p-0.5 shadow-xs" showLabel />
            <span className="text-sm font-semibold">NyayaSetu</span>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="size-3.5" />
            Back to workspace selection
          </Link>

          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <WorkspaceIcon className="size-5" />
            </span>
            <div>
              <p className="text-eyebrow text-[11px]">{copy.eyebrow}</p>
              <h1 className="text-xl font-bold text-foreground">{copy.heading}</h1>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{copy.blurb}</p>

          {/* Workspace Quick-Tabs */}
          <div className="mt-5">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Switch Target Workspace
            </Label>
            <div className="mt-1.5 grid grid-cols-4 gap-1 rounded-md border border-border p-1 text-[11px] font-medium bg-muted/30">
              {(
                [
                  ["court", "Court"],
                  ["investigation", "Investig."],
                  ["forensic", "Forensic"],
                  ["police", "Police"],
                  ["legal", "Legal"],
                  ["evidence", "Malkhana"],
                  ["documents", "Records"],
                  ["admin", "Admin"],
                ] as const
              ).map(([key, label]) => (
                <Link
                  key={key}
                  to="/auth"
                  search={{ workspace: key }}
                  replace
                  className={`rounded px-1.5 py-1 text-center transition-colors truncate ${
                    workspace === key
                      ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          {!isOnline && (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <ShieldCheck className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <strong className="font-semibold">Offline Court Login:</strong> You can sign in
                without internet using your device's local cryptographic vault.
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs">
                Official Department Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@courts.gov or name@police.gov"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-sm"
              />
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <Button type="submit" className="w-full h-9 text-sm" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Sign In to {workspaceCopy[workspace]?.heading.replace(" Sign In", "") || "Workspace"}
            </Button>
          </form>

          {/* Evaluator Quick Demo Accounts Selector */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                Evaluation Demo Accounts (1-Click Fill)
              </span>
              <span className="text-[10px] text-primary font-mono font-medium">PW: Court123!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => quickFillPersona("admin@courts.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Admin</div>
                <div className="text-[10px] text-muted-foreground truncate">admin@courts.gov</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("registrar@courts.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Registrar</div>
                <div className="text-[10px] text-muted-foreground truncate">registrar@courts.gov</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("judge.kapoor@delhicourts.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Judge</div>
                <div className="text-[10px] text-muted-foreground truncate">judge.kapoor@...</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("io.sharma@delhipolice.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Investigating Off.</div>
                <div className="text-[10px] text-muted-foreground truncate">io.sharma@...</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("fsl.mehta@cfsl.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Forensic FSL</div>
                <div className="text-[10px] text-muted-foreground truncate">fsl.mehta@cfsl.gov</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("malkhana.singh@delhipolice.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Evidence Custodian</div>
                <div className="text-[10px] text-muted-foreground truncate">malkhana.singh@...</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("prosecutor.mehta@justice.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Prosecutor</div>
                <div className="text-[10px] text-muted-foreground truncate">prosecutor.mehta@...</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("records.gupta@courts.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Records Vault</div>
                <div className="text-[10px] text-muted-foreground truncate">records.gupta@...</div>
              </button>
              <button
                type="button"
                onClick={() => quickFillPersona("beat.verma@delhipolice.gov")}
                className="rounded border border-border/80 bg-card p-1.5 text-left hover:bg-muted hover:border-primary/40 cursor-pointer transition-colors"
              >
                <div className="font-semibold text-foreground truncate">Patrol Officer</div>
                <div className="text-[10px] text-muted-foreground truncate">beat.verma@...</div>
              </button>
            </div>
          </div>

          <p className="mt-5 text-[11px] leading-relaxed text-muted-foreground">{copy.note}</p>

          <div className="mt-4 border-t border-border pt-3 text-xs flex items-center justify-between text-muted-foreground">
            <span>Litigant or Citizen?</span>
            <Link
              to="/case-status"
              className="font-medium text-primary underline underline-offset-4 hover:text-primary/80"
            >
              Check Public Case Status
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
