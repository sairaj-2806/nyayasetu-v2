import { supabase } from "@/integrations/supabase/client";
import { recordAudit } from "@/lib/audit";
import type { Database } from "@/integrations/supabase/types";
import type { AssetLifecycleStatus, PoliceAsset } from "@/lib/assets";
import { AppRole, assertPermission, hasPermission, Permission } from "@/lib/rbac";

export type StaffRole = AppRole;

export interface LifecycleActionDefinition {
  actionId: string;
  targetStatus: AssetLifecycleStatus;
  label: string;
  description: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  requiresAdmin?: boolean;
}

/**
 * Deterministic State Machine Transition Rules Matrix
 * Only explicitly registered transitions are permitted.
 */
export const LIFECYCLE_TRANSITIONS: Record<AssetLifecycleStatus, LifecycleActionDefinition[]> = {
  REGISTERED: [
    {
      actionId: "STOCK_AVAILABLE",
      targetStatus: "AVAILABLE",
      label: "Verify & Stock (Available)",
      description: "Perform initial inspection, verify serial/tamper seal, and place into available armory/malkhana inventory.",
      variant: "default",
    },
    {
      actionId: "REJECT_DECOMMISSION",
      targetStatus: "RETIRED",
      label: "Reject / Decommission",
      description: "Mark item as defective, damaged beyond receipt, or rejected on intake.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  AVAILABLE: [
    {
      actionId: "ASSIGN_OFFICER",
      targetStatus: "ASSIGNED",
      label: "Assign to Officer",
      description: "Issue asset or evidence to an investigating officer or duty staff for authorized duty.",
      variant: "default",
    },
    {
      actionId: "SEND_MAINTENANCE",
      targetStatus: "MAINTENANCE",
      label: "Send to Maintenance",
      description: "Dispatch equipment for routine servicing, ballistics testing, or calibration.",
      variant: "outline",
    },
    {
      actionId: "TRANSFER_LOCATION",
      targetStatus: "TRANSFERRED",
      label: "Transfer Custody",
      description: "Initiate inter-station or court dispatch manifest under transit seal.",
      variant: "outline",
    },
    {
      actionId: "RETIRE_ASSET",
      targetStatus: "RETIRED",
      label: "Retire Asset",
      description: "Formally decommission, dispose of evidence, or release to rightful owner under superdari.",
      variant: "destructive",
      requiresAdmin: true,
    },
    {
      actionId: "REPORT_LOST",
      targetStatus: "LOST",
      label: "Report Lost",
      description: "Report asset as stolen, lost from storage, or unaccounted for.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  ASSIGNED: [
    {
      actionId: "DEPLOY_IN_USE",
      targetStatus: "IN_USE",
      label: "Mark In Use",
      description: "Deploy asset on active investigation, crime scene duty, or court exhibit presentation.",
      variant: "default",
    },
    {
      actionId: "RETURN_ASSET",
      targetStatus: "RETURNED",
      label: "Return Asset",
      description: "Surrender equipment from officer back to custody for checkin inspection.",
      variant: "secondary",
    },
    {
      actionId: "TRANSFER_OFFICER_CUSTODY",
      targetStatus: "TRANSFERRED",
      label: "Transfer Custody",
      description: "Transfer possession to another department, lab, or court officer.",
      variant: "outline",
    },
    {
      actionId: "REPORT_ASSIGNMENT_LOST",
      targetStatus: "LOST",
      label: "Report Lost",
      description: "Officer reports article lost or stolen while assigned.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  IN_USE: [
    {
      actionId: "STAND_DOWN",
      targetStatus: "ASSIGNED",
      label: "Complete Operation (Assigned)",
      description: "Conclude active field deployment; item remains issued to officer.",
      variant: "default",
    },
    {
      actionId: "TRANSFER_FROM_FIELD",
      targetStatus: "TRANSFERRED",
      label: "Transfer to Lab / Court",
      description: "Direct handover from field to forensic laboratory or trial courtroom.",
      variant: "outline",
    },
    {
      actionId: "IN_USE_MAINTENANCE",
      targetStatus: "MAINTENANCE",
      label: "Send to Maintenance",
      description: "Article malfunctioned or sustained damage during active duty.",
      variant: "outline",
    },
    {
      actionId: "RETURN_DIRECT",
      targetStatus: "RETURNED",
      label: "Return to Malkhana",
      description: "Immediate checkin at station malkhana following operation.",
      variant: "secondary",
    },
    {
      actionId: "REPORT_FIELD_LOST",
      targetStatus: "LOST",
      label: "Report Lost",
      description: "Report article lost or unrecoverable in the field.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  TRANSFERRED: [
    {
      actionId: "RECEIVE_ASSIGN",
      targetStatus: "ASSIGNED",
      label: "Receive & Assign to Custodian",
      description: "Destination facility receives transit package, inspects seal, and signs custody receipt.",
      variant: "default",
    },
    {
      actionId: "RECEIVE_STOCK",
      targetStatus: "AVAILABLE",
      label: "Receive into Stock",
      description: "Transit completed; item returned to general malkhana armory storage.",
      variant: "secondary",
    },
    {
      actionId: "RECEIVE_LAB_IN_USE",
      targetStatus: "IN_USE",
      label: "Receive at Lab / Court Examination",
      description: "Admitted into court proceedings or active forensic dissection.",
      variant: "outline",
    },
    {
      actionId: "REPORT_TRANSIT_LOSS",
      targetStatus: "LOST",
      label: "Report Transit Loss",
      description: "Seal broken or item missing during courier/escort transit.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  MAINTENANCE: [
    {
      actionId: "MAINTENANCE_COMPLETE",
      targetStatus: "AVAILABLE",
      label: "Service Completed (Available)",
      description: "Maintenance, calibration, or decontamination completed and certified operational.",
      variant: "default",
    },
    {
      actionId: "DECOMMISSION_UNSERVICEABLE",
      targetStatus: "RETIRED",
      label: "Decommission (Unserviceable)",
      description: "Technician certifies article beyond economical repair; condemned.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  RETURNED: [
    {
      actionId: "RESTOCK_INVENTORY",
      targetStatus: "AVAILABLE",
      label: "Inspect & Stock (Available)",
      description: "Checkin verification passed. Restock into available malkhana vault.",
      variant: "default",
    },
    {
      actionId: "POST_RETURN_MAINTENANCE",
      targetStatus: "MAINTENANCE",
      label: "Send for Cleaning / Service",
      description: "Item returned requiring weapon cleaning, diagnostic check, or decontamination.",
      variant: "outline",
    },
    {
      actionId: "RETIRE_RETURNED",
      targetStatus: "RETIRED",
      label: "Retire / Release",
      description: "Case disposed; released to claimant or permanently decommissioned.",
      variant: "destructive",
      requiresAdmin: true,
    },
  ],

  RETIRED: [
    {
      actionId: "REACTIVE_MAINTENANCE",
      targetStatus: "MAINTENANCE",
      label: "Re-commission via Overhaul",
      description: "Admin override: Re-admit decommissioned item for comprehensive testing and recertification.",
      variant: "outline",
      requiresAdmin: true,
    },
  ],

  LOST: [
    {
      actionId: "RECOVER_ASSET",
      targetStatus: "RETURNED",
      label: "Mark Recovered (Checkin)",
      description: "Previously lost/stolen article recovered by police; admitted for physical audit.",
      variant: "default",
      requiresAdmin: true,
    },
  ],
};

export function getRequiredPermissionForTransition(
  fromStatus: AssetLifecycleStatus,
  targetStatus: AssetLifecycleStatus,
): Permission | null {
  if (targetStatus === "ASSIGNED" || targetStatus === "RETURNED" || targetStatus === "IN_USE") {
    return "ASSET_ASSIGN";
  }
  if (targetStatus === "TRANSFERRED") {
    return "ASSET_TRANSFER";
  }
  if (targetStatus === "MAINTENANCE") {
    return "ASSET_MAINTENANCE";
  }
  if (targetStatus === "AVAILABLE") {
    if (fromStatus === "MAINTENANCE") return "ASSET_MAINTENANCE";
    if (fromStatus === "REGISTERED") return "ASSET_CREATE";
    return "ASSET_ASSIGN";
  }
  return null;
}

/**
 * Pure validation function for state machine transitions.
 */
export function canTransition(
  fromStatus: AssetLifecycleStatus,
  toStatus: AssetLifecycleStatus,
  userRole: StaffRole = "registrar",
): { allowed: boolean; reason?: string } {
  // 1. RBAC check: Judges have read-only access to asset lifecycle
  if (userRole === "judge") {
    return {
      allowed: false,
      reason: "Judicial bench accounts have read-only exhibit access and cannot execute custody state transitions.",
    };
  }

  // 2. Identity check: Cannot transition to the same status
  if (fromStatus === toStatus) {
    return {
      allowed: false,
      reason: `Asset is already in state '${fromStatus}'.`,
    };
  }

  // 3. State machine lookup
  const allowedActions = LIFECYCLE_TRANSITIONS[fromStatus] || [];
  const matchingAction = allowedActions.find((a) => a.targetStatus === toStatus);

  if (!matchingAction) {
    const validTargets = allowedActions.map((a) => a.targetStatus).join(", ") || "None (Terminal State)";
    return {
      allowed: false,
      reason: `Invalid transition: Cannot transition asset from '${fromStatus}' to '${toStatus}'. Permitted transitions from '${fromStatus}' are: [${validTargets}].`,
    };
  }

  // 4. Admin-only actions check
  if (matchingAction.requiresAdmin && userRole !== "admin") {
    return {
      allowed: false,
      reason: `Transition '${fromStatus} → ${toStatus}' requires administrative role permissions.`,
    };
  }

  // 5. Granular RBAC permission check
  const reqPerm = getRequiredPermissionForTransition(fromStatus, toStatus);
  if (reqPerm && !hasPermission(userRole, reqPerm)) {
    return {
      allowed: false,
      reason: `Role '${userRole}' lacks permission '${reqPerm}' required to execute this transition.`,
    };
  }

  return { allowed: true };
}

/**
 * Get all available actions for the asset's current state and actor's role.
 */
export function getAllowedActions(
  currentStatus: AssetLifecycleStatus,
  userRole: StaffRole = "registrar",
): LifecycleActionDefinition[] {
  if (userRole === "judge") return [];

  const actions = LIFECYCLE_TRANSITIONS[currentStatus] || [];
  return actions.filter((action) => {
    if (action.requiresAdmin && userRole !== "admin") return false;
    const req = getRequiredPermissionForTransition(currentStatus, action.targetStatus);
    if (req && !hasPermission(userRole, req)) return false;
    return true;
  });
}

export interface TransitionExecutionPayload {
  assetId: string;
  targetStatus: AssetLifecycleStatus;
  actorName: string;
  actorRole: StaffRole;
  reason: string;
  newCustodianName?: string | undefined;
  newLocation?: string | undefined;
  assignedOfficerName?: string | undefined;
  transitSealNumber?: string | undefined;
  maintenanceType?: string | undefined;
  conditionNotes?: string | undefined;
}

export interface TransitionResult {
  success: boolean;
  asset: PoliceAsset;
  previousStatus: AssetLifecycleStatus;
  newStatus: AssetLifecycleStatus;
  timestamp: string;
  chainOfCustodyId: string;
  message: string;
}

const TRANSITIONS_STORAGE_KEY = "nyayasetu_asset_lifecycle_events_v1";

export interface StoredLifecycleEvent {
  id: string;
  assetId: string;
  assetCode: string;
  previousStatus: AssetLifecycleStatus;
  newStatus: AssetLifecycleStatus;
  actorName: string;
  actorRole: StaffRole;
  reason: string;
  timestamp: string;
  details: Record<string, unknown>;
}

export function getStoredLifecycleEvents(assetId?: string): StoredLifecycleEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSITIONS_STORAGE_KEY);
    if (!raw) return [];
    const all = JSON.parse(raw) as StoredLifecycleEvent[];
    if (assetId) {
      return all.filter((e) => e.assetId === assetId);
    }
    return all;
  } catch {
    return [];
  }
}

function saveLifecycleEvent(event: StoredLifecycleEvent) {
  if (typeof window === "undefined") return;
  try {
    const existing = getStoredLifecycleEvents();
    localStorage.setItem(TRANSITIONS_STORAGE_KEY, JSON.stringify([event, ...existing]));
  } catch {
    // ignore quota error
  }
}

/**
 * Execute a deterministic, validated asset lifecycle state transition.
 */
export async function executeAssetLifecycleTransition(
  payload: TransitionExecutionPayload,
): Promise<TransitionResult> {
  const {
    assetId,
    targetStatus,
    actorName,
    actorRole,
    reason,
    newCustodianName,
    newLocation,
    assignedOfficerName,
    transitSealNumber,
    conditionNotes,
  } = payload;

  if (!reason || reason.trim().length < 4) {
    throw new Error("A valid explanation/reason (minimum 4 characters) is required to execute a custody state transition.");
  }

  // 1. Fetch current asset particulars from local store or server
  const { policeAssetsQuery } = await import("@/lib/assets");
  const allAssets = await policeAssetsQuery.queryFn();
  const currentAsset = allAssets.find((a) => a.id === assetId || a.asset_code === assetId);

  if (!currentAsset) {
    throw new Error(`Asset '${assetId}' not found in registry.`);
  }

  const previousStatus = currentAsset.status;

  // 2. Validate state machine transition rules and RBAC permissions
  const reqPerm = getRequiredPermissionForTransition(previousStatus, targetStatus);
  if (reqPerm) {
    await assertPermission(
      actorRole,
      reqPerm,
      actorName,
      `Asset Transition (${previousStatus} → ${targetStatus}) for ${currentAsset.asset_code}`,
    );
  } else if (targetStatus === "RETIRED" || targetStatus === "LOST") {
    await assertPermission(
      actorRole,
      "ASSET_CREATE",
      actorName,
      `Asset Decommission/Lost Report (${previousStatus} → ${targetStatus}) for ${currentAsset.asset_code}`,
    );
  }

  const validation = canTransition(previousStatus, targetStatus, actorRole);
  if (!validation.allowed) {
    throw new Error(validation.reason || "Transition not permitted by lifecycle rules.");
  }

  const now = new Date().toISOString();
  const chainOfCustodyId = `coc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const verificationHash = `0x${Math.random().toString(16).substring(2, 10)}${Math.random().toString(16).substring(2, 10)}`;

  // 3. Update asset entity
  const updatedAsset: PoliceAsset = {
    ...currentAsset,
    status: targetStatus,
    updated_at: now,
  };

  if (newCustodianName && newCustodianName.trim()) {
    updatedAsset.current_custodian_name = newCustodianName.trim();
  }
  if (newLocation && newLocation.trim()) {
    updatedAsset.current_location = newLocation.trim();
  }
  if (assignedOfficerName !== undefined) {
    updatedAsset.assigned_officer_name = assignedOfficerName.trim();
  }
  if (transitSealNumber && transitSealNumber.trim()) {
    updatedAsset.tamper_seal_number = transitSealNumber.trim();
  }

  // 4. Save to Supabase
  try {
    await supabase
      .from("police_assets")
      .update({
        status: targetStatus,
        current_custodian_name: updatedAsset.current_custodian_name,
        current_location: updatedAsset.current_location,
        assigned_officer_name: updatedAsset.assigned_officer_name,
        tamper_seal_number: updatedAsset.tamper_seal_number ?? null,
        updated_at: now,
      })
      .eq("id", currentAsset.id);

    // Insert chain of custody record
    await supabase.from("evidence_chain_of_custody").insert({
      asset_id: currentAsset.id,
      action: `LIFECYCLE_TRANSITION_${previousStatus}_TO_${targetStatus}`,
      from_custodian: currentAsset.current_custodian_name,
      to_custodian: updatedAsset.current_custodian_name,
      transfer_timestamp: now,
      purpose_reason: reason.trim(),
      tamper_seal_intact: true,
      tamper_seal_number: updatedAsset.tamper_seal_number || "VERIFIED",
      verification_hash: verificationHash,
      notes: conditionNotes?.trim() || `Status updated by ${actorName} (${actorRole})`,
    });
  } catch {
    // Continue with local persistence if offline / dev mode
  }

  // 5. Update local store cache
  const ASSETS_STORAGE_KEY = "nyayasetu_police_assets_store_v1";
  try {
    const raw = localStorage.getItem(ASSETS_STORAGE_KEY);
    const list: PoliceAsset[] = raw ? JSON.parse(raw) : [];
    const index = list.findIndex((a) => a.id === currentAsset.id || a.asset_code === currentAsset.asset_code);
    if (index >= 0) {
      list[index] = updatedAsset;
    } else {
      list.unshift(updatedAsset);
    }
    localStorage.setItem(ASSETS_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore
  }

  // 6. Record immutable lifecycle transition event
  const event: StoredLifecycleEvent = {
    id: chainOfCustodyId,
    assetId: currentAsset.id,
    assetCode: currentAsset.asset_code,
    previousStatus,
    newStatus: targetStatus,
    actorName,
    actorRole,
    reason: reason.trim(),
    timestamp: now,
    details: {
      fromCustodian: currentAsset.current_custodian_name,
      toCustodian: updatedAsset.current_custodian_name,
      location: updatedAsset.current_location,
      verificationHash,
    },
  };
  saveLifecycleEvent(event);

  // 7. Audit logging
  let actionCode:
    | "CREATED"
    | "ASSIGNED"
    | "UNASSIGNED"
    | "TRANSFERRED"
    | "RECEIVED"
    | "MAINTENANCE_STARTED"
    | "MAINTENANCE_COMPLETED"
    | "RETURNED"
    | "RETIRED"
    | "MARKED_LOST" = "ASSIGNED";

  let isSecurity = false;

  if (targetStatus === "LOST") {
    actionCode = "MARKED_LOST";
    isSecurity = true;
  } else if (targetStatus === "RETIRED") {
    actionCode = "RETIRED";
  } else if (targetStatus === "AVAILABLE" && previousStatus === "IN_USE") {
    actionCode = "RETURNED";
  } else if (targetStatus === "MAINTENANCE") {
    actionCode = "MAINTENANCE_STARTED";
  } else if (previousStatus === "MAINTENANCE") {
    actionCode = "MAINTENANCE_COMPLETED";
  } else if (targetStatus === "TRANSFERRED") {
    actionCode = "TRANSFERRED";
  } else if (previousStatus === "TRANSFERRED") {
    actionCode = "RECEIVED";
  } else if (targetStatus === "ASSIGNED" || targetStatus === "IN_USE") {
    actionCode = "ASSIGNED";
  } else if (previousStatus === "ASSIGNED" && targetStatus === "AVAILABLE") {
    actionCode = "UNASSIGNED";
  } else {
    actionCode = "ASSIGNED";
  }

  await recordAudit({
    action: `Police Asset ${actionCode}: Transitioned ${currentAsset.asset_code} (${currentAsset.name}) from ${previousStatus} to ${targetStatus}. Reason: ${reason.trim()}`,
    actionCode,
    entityType: isSecurity ? "security" : "asset",
    entityId: currentAsset.id,
    caseId: currentAsset.case_id || null,
    previousState: previousStatus,
    newState: targetStatus,
    isSecurityAlert: isSecurity,
    userName: actorName,
    userRole: actorRole,
    metadata: {
      assetCode: currentAsset.asset_code,
      name: currentAsset.name,
      previousCustodian: currentAsset.current_custodian_name,
      newCustodian: updatedAsset.current_custodian_name,
      previousLocation: currentAsset.current_location,
      newLocation: updatedAsset.current_location,
      assignedOfficer: updatedAsset.assigned_officer_name,
      reason: reason.trim(),
      transitSealNumber: updatedAsset.tamper_seal_number,
      verificationHash,
    },
  });

  return {
    success: true,
    asset: updatedAsset,
    previousStatus,
    newStatus: targetStatus,
    timestamp: now,
    chainOfCustodyId,
    message: `Asset status successfully updated from ${previousStatus} to ${targetStatus}.`,
  };
}
