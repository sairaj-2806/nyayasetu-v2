import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  Briefcase,
  CheckCircle2,
  Copy,
  Gavel,
  KeyRound,
  Pencil,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/page-shell";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createRegistryAccount,
  deleteRegistryAccount,
  getAdminOverview,
  listRegistryAccounts,
  resetRegistryAccountPassword,
  updateRegistryAccountName,
  updateRegistryAccountRole,
  type RegistryRole,
} from "@/lib/admin-accounts.functions";
import { judgesQuery } from "@/lib/registry";
import { useCurrentStaff } from "@/hooks/use-current-staff";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin panel — NyayaSetu" },
      {
        name: "description",
        content:
          "Administrator control panel for registry logins: create registrar and bench accounts, change roles, reset passwords and revoke access.",
      },
      { property: "og:title", content: "Admin panel — NyayaSetu" },
      {
        property: "og:description",
        content: "Manage registrars, administrators and judicial bench logins for NyayaSetu.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPanelPage,
});

const roleLabels: Record<RegistryRole, string> = {
  admin: "Administrator",
  registrar: "Registrar",
  judge: "Judge (Bench)",
  police_officer: "Police Officer",
  investigating_officer: "Investigating Officer",
  forensic_officer: "Forensic Officer",
  evidence_custodian: "Evidence Custodian",
  legal_officer: "Legal Officer / Prosecutor",
  document_officer: "Document Officer",
  unassigned: "Unassigned / Pending Verification",
};

const roleTone: Record<RegistryRole, string> = {
  admin: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
  registrar: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  judge: "border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-400",
  police_officer: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  investigating_officer: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-400",
  forensic_officer: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  evidence_custodian: "border-teal-500/40 bg-teal-500/10 text-teal-700 dark:text-teal-400",
  legal_officer: "border-indigo-500/40 bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
  document_officer: "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  unassigned: "border-zinc-500/40 bg-zinc-500/10 text-zinc-700 dark:text-zinc-400",
};

const roleDescriptions: Record<RegistryRole, string> = {
  admin: "Full platform administration, user management, audit trails, and system courtroom parameters.",
  registrar: "Court roster management, case listing, scheduling engine, and cause list generation.",
  judge: "Judicial bench portal, cause list proceedings, judicial orders, and hearing dossier.",
  police_officer: "Station asset custody, charge sheets, summon service tracking, and seizure logs.",
  investigating_officer: "Case investigation, evidence submissions, case diary management, and IO reports.",
  forensic_officer: "Forensic reports, ballistics/DNA chain of custody, and lab evidence verification.",
  evidence_custodian: "Malkhana evidence room management, physical intake, QR tracking, and secure custody.",
  legal_officer: "Prosecution filings, witness liaison, trial representations, and bail briefs.",
  document_officer: "Registry archives, document stamping, certified copy issuance, and sealed records.",
  unassigned: "Account has no statutory role assigned. Access to sensitive registry records is blocked.",
};

const roleCategories: { category: string; roles: RegistryRole[] }[] = [
  {
    category: "Judicial & Registry Core",
    roles: ["admin", "registrar", "judge"],
  },
  {
    category: "Investigation & Law Enforcement",
    roles: ["police_officer", "investigating_officer"],
  },
  {
    category: "Forensics & Malkhana Evidence",
    roles: ["forensic_officer", "evidence_custodian"],
  },
  {
    category: "Prosecution & Archives",
    roles: ["legal_officer", "document_officer"],
  },
];

function generatePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#$%";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
}

async function copyToClipboard(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  } catch {
    toast.error("Copy failed — select the text manually.");
  }
}

function AdminPanelPage() {
  const staff = useCurrentStaff();
  const queryClient = useQueryClient();
  const isAdmin = staff.data?.role === "admin";

  const fetchAccounts = useServerFn(listRegistryAccounts);
  const fetchOverview = useServerFn(getAdminOverview);
  const createAccount = useServerFn(createRegistryAccount);
  const updateRole = useServerFn(updateRegistryAccountRole);
  const updateName = useServerFn(updateRegistryAccountName);
  const resetPassword = useServerFn(resetRegistryAccountPassword);
  const revokeAccount = useServerFn(deleteRegistryAccount);

  const accounts = useQuery({
    queryKey: ["registry-accounts"],
    queryFn: () => fetchAccounts({ data: undefined }),
    enabled: isAdmin,
  });
  const overview = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => fetchOverview({ data: undefined }),
    enabled: isAdmin,
  });
  const judges = useQuery({ ...judgesQuery, enabled: isAdmin });

  const [tab, setTab] = useState("overview");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | RegistryRole>("all");
  const [form, setForm] = useState<{
    fullName: string;
    email: string;
    password: string;
    role: RegistryRole;
    additionalRoles: RegistryRole[];
    judgeId: string;
  }>({
    fullName: "",
    email: "",
    password: "",
    role: "registrar",
    additionalRoles: [],
    judgeId: "",
  });
  const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ userId: string; fullName: string } | null>(null);
  const [roleEditorUser, setRoleEditorUser] = useState<{
    id: string;
    fullName: string;
    email: string;
    primaryRole: RegistryRole;
    roles: RegistryRole[];
    judgeId: string | null;
  } | null>(null);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["registry-accounts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    void queryClient.invalidateQueries({ queryKey: ["judges"] });
    void queryClient.invalidateQueries({ queryKey: ["bench-accounts"] });
  };

  const create = useMutation({
    mutationFn: () =>
      createAccount({
        data: {
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          additionalRoles: form.additionalRoles,
          judgeId:
            form.role === "judge" || form.additionalRoles.includes("judge")
              ? form.judgeId || null
              : null,
        },
      }),
    onSuccess: () => {
      toast.success(`${roleLabels[form.role]} account created`, {
        description: "Share the temporary credentials securely with the account holder.",
      });
      setForm({
        fullName: "",
        email: "",
        password: "",
        role: "registrar",
        additionalRoles: [],
        judgeId: "",
      });
      setTab("accounts");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changeRole = useMutation({
    mutationFn: (input: {
      userId: string;
      role: RegistryRole;
      additionalRoles?: RegistryRole[];
      judgeId?: string | null;
    }) => updateRole({ data: input }),
    onSuccess: () => {
      toast.success("Role privileges updated");
      setRoleEditorUser(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rename = useMutation({
    mutationFn: (input: { userId: string; fullName: string }) => updateName({ data: input }),
    onSuccess: () => {
      toast.success("Account name updated");
      setRenaming(null);
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const changePassword = useMutation({
    mutationFn: (input: { userId: string; password: string }) => resetPassword({ data: input }),
    onSuccess: (_r, input) => {
      toast.success("Password reset", { description: "Pass the new password on securely." });
      setPasswordDrafts((prev) => ({ ...prev, [input.userId]: "" }));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const revoke = useMutation({
    mutationFn: (userId: string) => revokeAccount({ data: { userId } }),
    onSuccess: () => {
      toast.success("Login revoked");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = useMemo(() => accounts.data ?? [], [accounts.data]);
  const counts = useMemo(
    () => ({
      admins: rows.filter((a) => a.roles.includes("admin") || a.role === "admin").length,
      registrars: rows.filter((a) => a.roles.includes("registrar") || a.role === "registrar").length,
      bench: rows.filter((a) => a.roles.includes("judge") || a.role === "judge").length,
      officers: rows.filter(
        (a) =>
          a.roles.some((r) =>
            [
              "police_officer",
              "investigating_officer",
              "forensic_officer",
              "evidence_custodian",
              "legal_officer",
              "document_officer",
            ].includes(r),
          ) ||
          [
            "police_officer",
            "investigating_officer",
            "forensic_officer",
            "evidence_custodian",
            "legal_officer",
            "document_officer",
          ].includes(a.role as any),
      ).length,
      dormant: rows.filter((a) => !a.lastSignInAt).length,
    }),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((a) => {
      const matchesRole =
        roleFilter === "all" || a.role === roleFilter || a.roles.includes(roleFilter);
      const matchesTerm =
        !term ||
        a.fullName.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        (a.judgeName ?? "").toLowerCase().includes(term) ||
        a.roles.some((r) => roleLabels[r]?.toLowerCase().includes(term));
      return matchesRole && matchesTerm;
    });
  }, [rows, search, roleFilter]);
  const unlinkedJudges = (judges.data ?? []).filter((j) => !j.user_id);

  if (staff.isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
        <PageHeader
          eyebrow="Administration"
          title="Admin panel"
          description="Central control for registry logins, roles and bench access."
        />
        <Card className="mt-8 border-destructive/40">
          <CardContent className="flex items-start gap-3 py-6">
            <ShieldAlert className="mt-0.5 size-5 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Administrator access required</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Only administrators may create or amend registry logins. Contact the registry
                administrator if you need an account issued or a role changed.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = overview.data;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Administration"
          title="Admin panel"
          description="Issue and manage every court & enforcement login — across all 9 judicial, investigation, forensics, custody, prosecution, and administrative roles."
        />
        <Button variant="outline" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Administrators" value={counts.admins} icon={ShieldCheck} loading={accounts.isLoading} />
        <SummaryCard label="Registrars" value={counts.registrars} icon={Users} loading={accounts.isLoading} />
        <SummaryCard label="Judicial Bench" value={counts.bench} icon={Gavel} loading={accounts.isLoading} />
        <SummaryCard label="Officers & Custody" value={counts.officers} icon={Briefcase} loading={accounts.isLoading} />
        <SummaryCard label="Never signed in" value={counts.dormant} icon={UserPlus} loading={accounts.isLoading} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="new">Create account</TabsTrigger>
          <TabsTrigger value="bench">Bench links</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {overview.isError ? (
            <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
          ) : overview.isLoading || !stats ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Caseload</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatRow label="Total cases" value={stats.cases.total} />
                    <StatRow label="Awaiting listing" value={stats.cases.filed} />
                    <StatRow label="Scheduled" value={stats.cases.scheduled} />
                    <StatRow label="Adjourned" value={stats.cases.adjourned} />
                    <StatRow label="Disposed" value={stats.cases.disposed} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Priority tiers</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {(
                      [
                        ["Tier 1", stats.tiers.tier1],
                        ["Tier 2", stats.tiers.tier2],
                        ["Tier 3", stats.tiers.tier3],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="font-medium text-foreground">{value}</span>
                        </div>
                        <Progress
                          value={stats.cases.total ? (value / stats.cases.total) * 100 : 0}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Registry resources</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatRow label="Judges on the roll" value={stats.judges} />
                    <StatRow label="Judges without a login" value={stats.unlinkedJudges} />
                    <StatRow label="Courtrooms" value={stats.courtrooms} />
                    <StatRow label="Active listings" value={stats.activeSchedules} />
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button asChild variant="outline" size="sm">
                        <Link to="/judges">
                          <Gavel className="size-4" />
                          Judges
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/courtrooms">Courtrooms</Link>
                      </Button>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/priority-settings">Weights</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="size-4" />
                    Latest registry activity
                  </CardTitle>
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/activity-log">View full log</Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  {stats.recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {stats.recentActivity.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                        >
                          <div>
                            <p className="text-sm text-foreground">{entry.action}</p>
                            <p className="text-xs text-muted-foreground">{entry.entity}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(entry.at).toLocaleString()}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          {accounts.isError ? (
            <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
          ) : accounts.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <Card>
              <CardHeader className="gap-4">
                <CardTitle className="text-base">
                  Registry logins ({filteredRows.length} of {rows.length})
                </CardTitle>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      placeholder="Search by name, email or bench"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Select
                    value={roleFilter}
                    onValueChange={(value) => setRoleFilter(value as "all" | RegistryRole)}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {roleCategories.map((group) => (
                        <SelectGroup key={group.category}>
                          <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                            {group.category}
                          </SelectLabel>
                          {group.roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabels[role]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="overflow-x-auto p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Bench record</TableHead>
                      <TableHead>Last sign-in</TableHead>
                      <TableHead className="min-w-[300px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No logins match this filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium text-foreground">
                            <div className="flex items-center gap-2">
                              {account.fullName}
                              {account.id === staff.data?.id && (
                                <span className="text-xs text-muted-foreground">(you)</span>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                aria-label={`Rename ${account.fullName}`}
                                onClick={() =>
                                  setRenaming({
                                    userId: account.id,
                                    fullName: account.fullName,
                                  })
                                }
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 hover:text-foreground"
                              onClick={() => void copyToClipboard(account.email)}
                            >
                              {account.email}
                              <Copy className="size-3.5" />
                            </button>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1.5 min-w-[210px]">
                              <div className="flex items-center gap-2">
                                <Select
                                  value={account.role ?? "unassigned"}
                                  onValueChange={(role) =>
                                    changeRole.mutate({
                                      userId: account.id,
                                      role: role as RegistryRole,
                                      additionalRoles: account.roles.filter((r) => r !== role),
                                      judgeId: account.judgeId,
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 w-[160px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {roleCategories.map((group) => (
                                      <SelectGroup key={group.category}>
                                        <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                                          {group.category}
                                        </SelectLabel>
                                        {group.roles.map((role) => (
                                          <SelectItem key={role} value={role}>
                                            {roleLabels[role]}
                                          </SelectItem>
                                        ))}
                                      </SelectGroup>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8"
                                  title="Manage multiple roles for this account"
                                  aria-label={`Manage roles for ${account.fullName}`}
                                  onClick={() =>
                                    setRoleEditorUser({
                                      id: account.id,
                                      fullName: account.fullName,
                                      email: account.email,
                                      primaryRole: account.role ?? "unassigned",
                                      roles:
                                        account.roles.length > 0
                                          ? [...account.roles]
                                          : [account.role ?? "unassigned"],
                                      judgeId: account.judgeId,
                                    })
                                  }
                                >
                                  <UserCog className="size-4 text-muted-foreground hover:text-foreground" />
                                </Button>
                              </div>
                              {account.roles.length > 1 && (
                                <div className="flex flex-wrap gap-1">
                                  {account.roles.map((r) => (
                                    <Badge
                                      key={r}
                                      variant="outline"
                                      className={`text-[10px] px-1.5 py-0 h-4.5 ${roleTone[r]}`}
                                    >
                                      {roleLabels[r]}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {account.judgeName ? (
                              <Badge variant="outline" className={roleTone.judge}>
                                {account.judgeName}
                              </Badge>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {account.lastSignInAt ? (
                              new Date(account.lastSignInAt).toLocaleDateString()
                            ) : (
                              <Badge variant="outline">Never</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-2">
                              <Input
                                type="text"
                                placeholder="New password"
                                className="h-9 w-[150px]"
                                value={passwordDrafts[account.id] ?? ""}
                                onChange={(e) =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [account.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label="Generate password"
                                onClick={() =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [account.id]: generatePassword(),
                                  }))
                                }
                              >
                                <KeyRound className="size-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={
                                  (passwordDrafts[account.id] ?? "").length < 8 ||
                                  changePassword.isPending
                                }
                                onClick={() =>
                                  changePassword.mutate({
                                    userId: account.id,
                                    password: passwordDrafts[account.id] ?? "",
                                  })
                                }
                              >
                                Reset
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    aria-label={`Revoke ${account.fullName}`}
                                    disabled={account.id === staff.data?.id}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Revoke this login?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      {account.fullName} ({account.email}) will lose access
                                      immediately. Judge records and case data are never deleted.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => revoke.mutate(account.id)}>
                                      Revoke login
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="new" className="mt-6">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Issue a new login</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full name</Label>
                  <Input
                    id="admin-name"
                    value={form.fullName}
                    onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="Hon'ble Justice / Registrar name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Official email</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="name@court.gov.in"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Temporary password</Label>
                  <div className="flex gap-2">
                    <Input
                      id="admin-password"
                      type="text"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="At least 8 characters"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Generate password"
                      onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}
                    >
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label="Copy password"
                      disabled={!form.password}
                      onClick={() => void copyToClipboard(form.password)}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Primary Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(role) =>
                      setForm((f) => ({
                        ...f,
                        role: role as RegistryRole,
                        additionalRoles: f.additionalRoles.filter((r) => r !== role),
                        judgeId:
                          role === "judge" || f.additionalRoles.includes("judge") ? f.judgeId : "",
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleCategories.map((group) => (
                        <SelectGroup key={group.category}>
                          <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                            {group.category}
                          </SelectLabel>
                          {group.roles.map((role) => (
                            <SelectItem key={role} value={role}>
                              {roleLabels[role]}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-medium text-foreground">
                  <Badge variant="outline" className={roleTone[form.role]}>
                    {roleLabels[form.role]}
                  </Badge>
                  <span>Role Scope & Responsibilities:</span>
                </div>
                <p className="mt-1.5 leading-relaxed">{roleDescriptions[form.role]}</p>
              </div>

              <div className="space-y-3 rounded-lg border p-4 bg-background">
                <div>
                  <Label className="text-sm font-semibold">Additional Roles (Optional)</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Assign additional roles to provision a multi-role user profile (e.g., Police Officer + Investigating Officer).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                  {(Object.keys(roleLabels) as RegistryRole[])
                    .filter((r) => r !== form.role)
                    .map((r) => {
                      const isChecked = form.additionalRoles.includes(r);
                      return (
                        <label
                          key={r}
                          className={`flex items-start gap-2.5 p-2 rounded-md border cursor-pointer transition-colors text-xs ${
                            isChecked
                              ? "border-primary bg-primary/5 text-foreground font-medium"
                              : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setForm((f) => ({
                                ...f,
                                additionalRoles: checked
                                  ? [...f.additionalRoles, r]
                                  : f.additionalRoles.filter((ar) => ar !== r),
                              }));
                            }}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <span className="block text-foreground">{roleLabels[r]}</span>
                          </div>
                        </label>
                      );
                    })}
                </div>
              </div>

              {(form.role === "judge" || form.additionalRoles.includes("judge")) && (
                <div className="space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
                  <Label className="text-foreground font-semibold">Link to Judge Bench Record</Label>
                  <Select
                    value={form.judgeId}
                    onValueChange={(judgeId) => setForm((f) => ({ ...f, judgeId }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a judge record" />
                    </SelectTrigger>
                    <SelectContent>
                      {(judges.data ?? []).map((judge) => (
                        <SelectItem key={judge.id} value={judge.id}>
                          {judge.name}
                          {judge.user_id ? " (already linked to another login)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Bench logins access the dedicated Bench Portal to review scheduled cases, daily cause lists, and enter hearing notes.
                  </p>
                </div>
              )}

              <Button
                onClick={() => create.mutate()}
                disabled={create.isPending || !form.email || form.password.length < 8}
                className="w-full sm:w-auto"
              >
                <UserPlus className="size-4" />
                {create.isPending ? "Creating account…" : "Create account"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bench" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Judges without a bench login</CardTitle>
            </CardHeader>
            <CardContent>
              {judges.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : unlinkedJudges.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Every judge on the roll has an active bench login.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {unlinkedJudges.map((judge) => (
                    <li key={judge.id} className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{judge.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {judge.specialisation || "General bench"}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setForm((f) => ({
                            ...f,
                            role: "judge",
                            judgeId: judge.id,
                            fullName: judge.name,
                            password: generatePassword(),
                          }));
                          setTab("new");
                        }}
                      >
                        Prepare login
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs text-muted-foreground">
                Judge records themselves are added on the{" "}
                <Link to="/judges" className="underline underline-offset-4">
                  Judges
                </Link>{" "}
                page. Revoking a login never deletes the judge record.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-input">Full name</Label>
            <Input
              id="rename-input"
              value={renaming?.fullName ?? ""}
              onChange={(e) =>
                setRenaming((prev) => (prev ? { ...prev, fullName: e.target.value } : prev))
              }
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button
              disabled={!renaming?.fullName.trim() || rename.isPending}
              onClick={() => renaming && rename.mutate(renaming)}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={roleEditorUser !== null}
        onOpenChange={(open) => !open && setRoleEditorUser(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Roles & Permissions</DialogTitle>
            <DialogDescription>
              Assign canonical roles to {roleEditorUser?.fullName} ({roleEditorUser?.email}).
            </DialogDescription>
          </DialogHeader>
          {roleEditorUser && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Primary Role</Label>
                <Select
                  value={roleEditorUser.primaryRole}
                  onValueChange={(val) => {
                    const r = val as RegistryRole;
                    setRoleEditorUser((prev) =>
                      prev
                        ? {
                            ...prev,
                            primaryRole: r,
                            roles: Array.from(new Set([r, ...prev.roles])),
                          }
                        : prev,
                    );
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roleCategories.map((group) => (
                      <SelectGroup key={group.category}>
                        <SelectLabel className="text-xs uppercase tracking-wider text-muted-foreground">
                          {group.category}
                        </SelectLabel>
                        {group.roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {roleLabels[r]}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Assigned Roles</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(roleLabels) as RegistryRole[]).map((r) => {
                    const isChecked = roleEditorUser.roles.includes(r);
                    const isPrimary = roleEditorUser.primaryRole === r;
                    return (
                      <label
                        key={r}
                        className={`flex items-center gap-2.5 p-2 rounded-md border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "border-primary bg-primary/5 text-foreground"
                            : "border-border/60 hover:bg-muted/50 text-muted-foreground"
                        }`}
                      >
                        <Checkbox
                          checked={isChecked}
                          disabled={isPrimary}
                          onCheckedChange={(checked) => {
                            if (isPrimary) return;
                            setRoleEditorUser((prev) => {
                              if (!prev) return prev;
                              const nextRoles = checked
                                ? [...prev.roles, r]
                                : prev.roles.filter((item) => item !== r);
                              return { ...prev, roles: nextRoles };
                            });
                          }}
                        />
                        <div className="flex-1">
                          <span className="font-medium text-foreground">{roleLabels[r]}</span>
                          {isPrimary && (
                            <span className="ml-1 text-[10px] text-muted-foreground">(primary)</span>
                          )}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {roleEditorUser.roles.includes("judge") && (
                <div className="space-y-2 rounded-lg border border-purple-500/30 bg-purple-500/5 p-3 text-xs">
                  <Label className="text-foreground font-semibold">Link to Judge Record</Label>
                  <Select
                    value={roleEditorUser.judgeId ?? ""}
                    onValueChange={(val) =>
                      setRoleEditorUser((prev) =>
                        prev ? { ...prev, judgeId: val || null } : prev,
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a judge record" />
                    </SelectTrigger>
                    <SelectContent>
                      {(judges.data ?? []).map((judge) => (
                        <SelectItem key={judge.id} value={judge.id}>
                          {judge.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoleEditorUser(null)}>
              Cancel
            </Button>
            <Button
              disabled={!roleEditorUser || changeRole.isPending}
              onClick={() => {
                if (!roleEditorUser) return;
                changeRole.mutate({
                  userId: roleEditorUser.id,
                  role: roleEditorUser.primaryRole,
                  additionalRoles: roleEditorUser.roles.filter(
                    (r) => r !== roleEditorUser.primaryRole,
                  ),
                  judgeId: roleEditorUser.roles.includes("judge")
                    ? roleEditorUser.judgeId
                    : null,
                });
              }}
            >
              Save Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading = false,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-5">
        <span className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
        <div>
          {loading ? (
            <Skeleton className="my-1 h-7 w-12" />
          ) : (
            <p className="text-2xl font-semibold text-foreground">{value}</p>
          )}
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
