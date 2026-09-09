import { useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Gavel,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Shield,
  FileSearch,
  FlaskConical,
  Scale,
  PackageCheck,
  FileText,
  UserCog,
  AlertTriangle,
  Eye,
  EyeOff,
  LogOut,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useNetworkStatus } from "@/lib/network-status";
import { useCurrentStaff } from "@/hooks/use-current-staff";
import {
  authenticateOffline,
  cacheStaffCredentialsLocally,
  clearOfflineStaffSession,
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

const DEMO_OFFICIAL_ACCOUNTS: {
  role: AppRole;
  label: string;
  email: string;
  designation: string;
  workspace: PortalWorkspace;
}[] = [
  {
    role: "admin",
    label: "Admin",
    email: "admin@courts.gov",
    designation: "System Administrator",
    workspace: "admin",
  },
  {
    role: "registrar",
    label: "Registrar",
    email: "registrar@courts.gov",
    designation: "Judicial Registry In-Charge",
    workspace: "court",
  },
  {
    role: "judge",
    label: "Judge",
    email: "judge.kapoor@delhicourts.gov",
    designation: "Hon'ble Bench (Court 1)",
    workspace: "court",
  },
  {
    role: "investigating_officer",
    label: "Investigating Off.",
    email: "io.sharma@delhipolice.gov",
    designation: "Inspector (Special Cell)",
    workspace: "investigation",
  },
  {
    role: "forensic_officer",
    label: "Forensic FSL",
    email: "fsl.mehta@cfsl.gov",
    designation: "Ballistics Expert (CFSL)",
    workspace: "forensic",
  },
  {
    role: "evidence_custodian",
    label: "Malkhana Custodian",
    email: "malkhana.singh@delhipolice.gov",
    designation: "Malkhana Moharrir",
    workspace: "evidence",
  },
  {
    role: "legal_officer",
    label: "Prosecutor",
    email: "prosecutor.mehta@justice.gov",
    designation: "Chief Public Prosecutor",
    workspace: "legal",
  },
  {
    role: "document_officer",
    label: "Records Vault",
    email: "records.gupta@courts.gov",
    designation: "Record Room Officer",
    workspace: "documents",
  },
  {
    role: "police_officer",
    label: "Patrol Officer",
    email: "beat.verma@delhipolice.gov",
    designation: "Beat Constable (Station)",
    workspace: "police",
  },
];

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
  const queryClient = useQueryClient();
  const staff = useCurrentStaff();
  const search = Route.useSearch();
  const workspace: PortalWorkspace = search.workspace ?? "court";
  const copy = workspaceCopy[workspace] ?? workspaceCopy.court;
  const { isOnline } = useNetworkStatus();

  const WorkspaceIcon = copy.icon;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDemoEmail, setSelectedDemoEmail] = useState<string | null>(null);

  function routeForRoleAndWorkspace(role: AppRole, targetWs?: PortalWorkspace) {
    if (role === "judge") {
      return "/bench";
    }
    if (targetWs === "evidence" && (role === "evidence_custodian" || role === "admin")) {
      return "/evidence";
    }
    if (
      targetWs === "documents" &&
      (role === "document_officer" || role === "admin" || role === "registrar")
    ) {
      return "/documents";
    }
    if (targetWs === "admin" && role === "admin") {
      return "/admin";
    }
    return "/dashboard";
  }

  async function performSignIn(rawEmail: string, rawPassword: string) {
    const cleanEmail = rawEmail.trim();
    const cleanPassword = rawPassword;

    if (!cleanEmail || !cleanPassword) {
      setError("Please enter both your official email and password.");
      return;
    }

    setLoading(true);
    setError(null);

    // Clean up any stale session role override
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("nyayasetu:active-role");
    }

    // 1. If currently offline, authenticate directly via local cryptographic vault
    if (!isOnline) {
      const offlineRes = await authenticateOffline(cleanEmail, cleanPassword);
      setLoading(false);

      if (offlineRes.success && offlineRes.account) {
        const userRole = offlineRes.account.role;
        const roleDesc = ROLE_METADATA[userRole]?.label || userRole.toUpperCase();

        toast.success("Offline Authentication Successful", {
          description: `Signed in as ${offlineRes.account.fullName} (${roleDesc}) from secure offline vault.`,
          icon: <ShieldCheck className="size-4 text-amber-500" />,
        });

        await queryClient.invalidateQueries({ queryKey: ["current-staff"] });
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
        password: cleanPassword,
      });

      if (signInError || !data.user) {
        // Fallback to offline vault if network glitch or demo account credentials
        const fallbackRes = await authenticateOffline(cleanEmail, cleanPassword);
        if (fallbackRes.success && fallbackRes.account) {
          setLoading(false);
          const userRole = fallbackRes.account.role;
          toast.success("Signed In Successfully", {
            description: `Logged in as ${fallbackRes.account.fullName} (${ROLE_METADATA[userRole]?.label}).`,
            icon: <ShieldCheck className="size-4 text-emerald-500" />,
          });
          await queryClient.invalidateQueries({ queryKey: ["current-staff"] });
          navigate({ to: routeForRoleAndWorkspace(userRole, workspace), replace: true });
          return;
        }

        setLoading(false);
        setError("Invalid credentials. Please verify your department email and password.");
        return;
      }

      // Online login succeeded: clear any old offline session so live Supabase auth takes over
      clearOfflineStaffSession();

      // Retrieve assigned roles & judicial bench details
      const [{ data: roles }, { data: profile }, { data: bench }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
        supabase.from("profiles").select("full_name").eq("id", data.user.id).maybeSingle(),
        supabase.from("judges").select("id, name").eq("user_id", data.user.id).maybeSingle(),
      ]);

      const userRoles = (roles?.map((r) => String(r.role)) || []) as string[];
      let computedRole: AppRole = "police_officer";
      if (userRoles.includes("admin")) computedRole = "admin";
      else if (userRoles.includes("judge") || bench?.id) computedRole = "judge";
      else if (userRoles.includes("registrar")) computedRole = "registrar";
      else if (userRoles.includes("investigating_officer")) computedRole = "investigating_officer";
      else if (userRoles.includes("forensic_officer")) computedRole = "forensic_officer";
      else if (userRoles.includes("evidence_custodian")) computedRole = "evidence_custodian";
      else if (userRoles.includes("legal_officer")) computedRole = "legal_officer";
      else if (userRoles.includes("document_officer")) computedRole = "document_officer";
      else if (userRoles.includes("police_officer")) computedRole = "police_officer";
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
        cleanPassword,
      );

      setLoading(false);
      await queryClient.invalidateQueries({ queryKey: ["current-staff"] });

      toast.success("Authentication Successful", {
        description: `Welcome back, ${profile?.full_name || "Official"} (${ROLE_METADATA[computedRole]?.label}).`,
        icon: <ShieldCheck className="size-4 text-emerald-500" />,
      });

      // Verify workspace authorization
      if (workspace && !canAccessWorkspace(computedRole, workspace)) {
        toast.warning("Redirected to Authorized Workspace", {
          description: `Your assigned role (${ROLE_METADATA[computedRole]?.label}) is not assigned to the ${workspace.toUpperCase()} workspace. Entering your standard workspace.`,
        });
      }

      navigate({ to: routeForRoleAndWorkspace(computedRole, workspace), replace: true });
    } catch (err) {
      console.warn("Sign in encountered exception, trying offline vault fallback", err);
      const fallbackRes = await authenticateOffline(cleanEmail, cleanPassword);
      setLoading(false);
      if (fallbackRes.success && fallbackRes.account) {
        await queryClient.invalidateQueries({ queryKey: ["current-staff"] });
        navigate({
          to: routeForRoleAndWorkspace(fallbackRes.account.role, workspace),
          replace: true,
        });
        return;
      }
      setError("Unable to connect to court authentication gateway. Check credentials or network.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await performSignIn(email, password);
  }

  function handleSelectDemoAccount(demo: (typeof DEMO_OFFICIAL_ACCOUNTS)[number]) {
    setSelectedDemoEmail(demo.email);
    setEmail(demo.email);
    setPassword("Court123!");
    setError(null);
  }

  async function handleDirectSignIn(demo: (typeof DEMO_OFFICIAL_ACCOUNTS)[number]) {
    setSelectedDemoEmail(demo.email);
    setEmail(demo.email);
    setPassword("Court123!");
    await performSignIn(demo.email, "Court123!");
  }

  async function handleSwitchActiveUser() {
    clearOfflineStaffSession();
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("nyayasetu:active-role");
    }
    await supabase.auth.signOut();
    await queryClient.cancelQueries();
    queryClient.clear();
    setEmail("");
    setPassword("");
    setSelectedDemoEmail(null);
    toast.info("Previous session cleared. Please sign in.");
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Left Column — Branding and Security Credentials */}
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
            One authentication gateway governing Least-Privilege access across Police,
            Investigation, Forensics, Prosecution, Malkhana Custody, and Judicial Benches.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">
          Authorised official use only. All actions are cryptographically signed and logged to an
          immutable audit ledger under Section 63, Bharatiya Sakshya Adhiniyam, 2023.
        </p>
      </section>

      {/* Right Column — Authentication Form */}
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

          {/* Active Session Notification Card */}
          {staff.data && (
            <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {staff.data.fullName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">
                        {staff.data.fullName}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <Shield className="size-2.5" />
                        {ROLE_METADATA[staff.data.role]?.label || staff.data.role}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{staff.data.email}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs flex-1 gap-1.5"
                  onClick={() =>
                    navigate({ to: routeForRoleAndWorkspace(staff.data!.role, workspace) })
                  }
                >
                  Continue to Workspace
                  <ArrowRight className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
                  onClick={handleSwitchActiveUser}
                >
                  <LogOut className="size-3.5" />
                  Sign Out / Switch
                </Button>
              </div>
            </div>
          )}

          {/* Workspace Quick-Tabs */}
          <div className="mt-5">
            <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">
              Target Workspace
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
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedDemoEmail(null);
                }}
                placeholder="name@courts.gov or name@police.gov"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-9 pr-9 text-sm"
                  placeholder="Enter security password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center gap-2">
                <AlertTriangle className="size-3.5 shrink-0" />
                <span>{error}</span>
              </p>
            )}

            <Button type="submit" className="w-full h-9 text-sm font-medium" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin mr-1.5" />}
              Sign In to {workspaceCopy[workspace]?.heading.replace(" Sign In", "") || "Workspace"}
            </Button>
          </form>

          {/* Evaluator Quick Demo Accounts Selector */}
          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="size-3 text-primary" />
                Evaluation Accounts (1-Click Fill)
              </span>
              <span className="text-[10px] text-primary font-mono font-medium">PW: Court123!</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
              {DEMO_OFFICIAL_ACCOUNTS.map((demo) => {
                const isSelected = selectedDemoEmail === demo.email;
                return (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => handleSelectDemoAccount(demo)}
                    onDoubleClick={() => void handleDirectSignIn(demo)}
                    className={`rounded border p-2 text-left cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary/40 shadow-xs"
                        : "border-border/80 bg-card hover:bg-muted/80 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-foreground truncate">{demo.label}</span>
                      {isSelected && <CheckCircle2 className="size-3 text-primary shrink-0" />}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{demo.email}</div>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Tip: Click any official account above to fill credentials, then click <strong>Sign In</strong>.
            </p>
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
