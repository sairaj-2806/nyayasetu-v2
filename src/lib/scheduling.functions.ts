import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { detectAssignmentConflicts, fetchConflictData, type Conflict } from "@/lib/conflicts";
import { formatSlotLabel } from "@/lib/scheduling";

const RecordDecisionInputSchema = z.object({
  caseId: z.string(),
  caseNumber: z.string(),
  estimatedDurationMinutes: z.number().default(60),
  judge: z
    .object({
      id: z.string(),
      name: z.string(),
      specialisation: z.string().nullish(),
      current_workload: z.number().optional().default(0),
    })
    .passthrough(),
  courtroom: z
    .object({
      id: z.string(),
      name: z.string(),
      capacity: z.number().optional().default(30),
    })
    .passthrough(),
  slot: z
    .object({
      id: z.string(),
      date: z.string(),
      start_time: z.string(),
      end_time: z.string(),
    })
    .passthrough(),
  action: z.enum(["accepted", "modified", "rejected"]),
  userId: z.string().nullish(),
  userName: z.string().nullish(),
  userRole: z.string().nullish(),
  reasoningText: z.string(),
});

export type RecordDecisionResult = {
  success: boolean;
  conflict: boolean;
  conflicts: Conflict[];
  scheduleId: string | null;
  message: string;
};

const actionVerbMap: Record<string, string> = {
  accepted: "Accepted scheduling recommendation; listing created",
  modified: "Modified scheduling recommendation (selected alternative listing)",
  rejected: "Rejected scheduling recommendation; matter remains unscheduled",
};

/**
 * Server function to record an accepted, modified, or rejected scheduling recommendation.
 * Safely updates existing active schedules for the case in-place to prevent duplicate key
 * violations on `schedules_one_active_per_case`, and runs with elevated service privileges
 * to ensure reliable persistence regardless of client RLS or offline session state.
 */
export const recordSchedulingDecision = createServerFn({ method: "POST" })
  .validator((data: unknown) => RecordDecisionInputSchema.parse(data))
  .handler(async ({ data }): Promise<RecordDecisionResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Conflict validation for non-rejected actions
    if (data.action !== "rejected") {
      const conflictData = await fetchConflictData(supabaseAdmin);
      const conflicts = detectAssignmentConflicts({
        caseNumber: data.caseNumber,
        caseId: data.caseId,
        estimatedDurationMinutes: data.estimatedDurationMinutes,
        judge: data.judge as any,
        courtroom: data.courtroom as any,
        slot: data.slot as any,
        schedules: conflictData.schedules,
        availability: conflictData.availability,
        maxJudgeWorkload: conflictData.maxJudgeWorkload,
        courtHolidays: conflictData.courtHolidays,
      });

      if (conflicts.length > 0) {
        return {
          success: false,
          conflict: true,
          conflicts,
          scheduleId: null,
          message: conflicts.map((c) => c.message).join(" "),
        };
      }
    }

    // 2. Query existing active schedules for this case
    const { data: existingActive, error: fetchSchedError } = await supabaseAdmin
      .from("schedules")
      .select("id, status")
      .eq("case_id", data.caseId)
      .in("status", ["proposed", "confirmed"]);

    if (fetchSchedError) throw new Error(fetchSchedError.message);

    let scheduleId: string;

    if (data.action === "rejected") {
      const [firstActive] = existingActive ?? [];
      if (firstActive) {
        // Cancel all existing active schedules
        for (const s of existingActive ?? []) {
          await supabaseAdmin
            .from("schedules")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", s.id);
        }
        scheduleId = firstActive.id;
      } else {
        // Create a cancelled schedule entry so rejection is auditable
        const { data: cancelledSched, error: cancelError } = await supabaseAdmin
          .from("schedules")
          .insert({
            case_id: data.caseId,
            judge_id: data.judge.id,
            courtroom_id: data.courtroom.id,
            slot_id: data.slot.id,
            status: "cancelled",
          })
          .select("id")
          .single();
        if (cancelError) throw new Error(cancelError.message);
        scheduleId = cancelledSched.id;
      }
    } else {
      // action is 'accepted' or 'modified'
      const [primary, ...rest] = existingActive ?? [];
      if (primary) {
        // Update first active schedule in-place to avoid unique constraint violation
        const { error: updateError } = await supabaseAdmin
          .from("schedules")
          .update({
            judge_id: data.judge.id,
            courtroom_id: data.courtroom.id,
            slot_id: data.slot.id,
            status: "confirmed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", primary.id);
        if (updateError) throw new Error(updateError.message);
        scheduleId = primary.id;

        // Cancel any extra duplicate active schedules if any exist
        for (const duplicate of rest) {
          await supabaseAdmin
            .from("schedules")
            .update({ status: "cancelled", updated_at: new Date().toISOString() })
            .eq("id", duplicate.id);
        }
      } else {
        // Insert new confirmed schedule
        const { data: newSched, error: insertError } = await supabaseAdmin
          .from("schedules")
          .insert({
            case_id: data.caseId,
            judge_id: data.judge.id,
            courtroom_id: data.courtroom.id,
            slot_id: data.slot.id,
            status: "confirmed",
          })
          .select("id")
          .single();
        if (insertError) throw new Error(insertError.message);
        scheduleId = newSched.id;
      }

      // Update case status to 'scheduled'
      await supabaseAdmin.from("cases").update({ status: "scheduled" }).eq("id", data.caseId);
    }

    // 3. Upsert ai_recommendations for scheduleId
    const { data: existingRec } = await supabaseAdmin
      .from("ai_recommendations")
      .select("id")
      .eq("schedule_id", scheduleId)
      .maybeSingle();

    if (existingRec?.id) {
      await supabaseAdmin
        .from("ai_recommendations")
        .update({
          reasoning: data.reasoningText,
          status: data.action,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRec.id);
    } else {
      const { error: recInsertError } = await supabaseAdmin.from("ai_recommendations").insert({
        schedule_id: scheduleId,
        reasoning: data.reasoningText,
        status: data.action,
      });
      if (recInsertError) {
        console.warn("[recordSchedulingDecision] ai_recommendations insert:", recInsertError);
      }
    }

    // 4. Safely insert into audit_logs (foreign-key safe)
    let validUserId: string | null = null;
    if (data.userId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", data.userId)
        .maybeSingle();
      if (prof?.id) validUserId = prof.id;
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: validUserId,
        action: `${actionVerbMap[data.action]} — ${data.judge.name} / ${data.courtroom.name} / ${formatSlotLabel(data.slot)}`,
        entity_affected: `case:${data.caseNumber} schedule:${scheduleId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[recordSchedulingDecision] audit_logs insert:", auditErr);
    }

    return {
      success: true,
      conflict: false,
      conflicts: [],
      scheduleId,
      message: "Decision recorded successfully",
    };
  });

const CustomJudicialInputSchema = z.object({
  caseId: z.string(),
  caseNumber: z.string(),
  parties: z.string().nullish(),
  judge: z
    .object({
      id: z.string(),
      name: z.string(),
      specialisation: z.string().nullish(),
    })
    .passthrough(),
  courtroom: z
    .object({
      id: z.string(),
      name: z.string(),
      capacity: z.number().optional().default(30),
    })
    .passthrough(),
  slot: z
    .object({
      id: z.string(),
      date: z.string(),
      start_time: z.string(),
      end_time: z.string(),
    })
    .passthrough(),
  directiveReason: z.string(),
  customNote: z.string().optional().default(""),
  preflightConflicts: z.array(z.any()).optional().default([]),
  userId: z.string().nullish(),
  userName: z.string().nullish(),
  userRole: z.string().nullish(),
});

/**
 * Server function for Custom Judicial Directives.
 * Idempotently updates existing active schedules or creates a confirmed listing.
 */
export const customJudicialScheduleServerFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => CustomJudicialInputSchema.parse(data))
  .handler(async ({ data }): Promise<{ success: boolean; scheduleId: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkCourtHoliday } = await import("@/lib/holidays");

    // Prohibit listing on Sundays (court closed) and court holidays
    const slotDay = new Date(`${data.slot.date}T00:00:00`).getDay();
    const holidayCheck = checkCourtHoliday(data.slot.date);
    if (slotDay === 0 || holidayCheck.isHoliday) {
      throw new Error(
        `Cannot list hearing on ${data.slot.date}: ${holidayCheck.holidayName || "Sunday / Court Closed"}. Court is closed on Sundays and gazetted holidays.`,
      );
    }

    // 1. Check existing active schedules
    const { data: existingActive, error: fetchSchedError } = await supabaseAdmin
      .from("schedules")
      .select("id, status")
      .eq("case_id", data.caseId)
      .in("status", ["proposed", "confirmed"]);

    if (fetchSchedError) throw new Error(fetchSchedError.message);

    let scheduleId: string;

    const [primary, ...rest] = existingActive ?? [];
    if (primary) {
      // Update first existing active schedule
      const { error: updateError } = await supabaseAdmin
        .from("schedules")
        .update({
          judge_id: data.judge.id,
          courtroom_id: data.courtroom.id,
          slot_id: data.slot.id,
          status: "confirmed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", primary.id);
      if (updateError) throw new Error(updateError.message);
      scheduleId = primary.id;

      // Cancel duplicate active schedules if any
      for (const duplicate of rest) {
        await supabaseAdmin
          .from("schedules")
          .update({ status: "cancelled", updated_at: new Date().toISOString() })
          .eq("id", duplicate.id);
      }
    } else {
      // Insert new confirmed schedule
      const { data: newSched, error: insertError } = await supabaseAdmin
        .from("schedules")
        .insert({
          case_id: data.caseId,
          judge_id: data.judge.id,
          courtroom_id: data.courtroom.id,
          slot_id: data.slot.id,
          status: "confirmed",
        })
        .select("id")
        .single();
      if (insertError) throw new Error(insertError.message);
      scheduleId = newSched.id;
    }

    // 2. Format detailed judicial directive reasoning
    const noteText = data.customNote.trim() ? ` — Note: ${data.customNote.trim()}` : "";
    const staffLabel = data.userName ? `${data.userName} (${data.userRole || "staff"})` : "Staff";
    const conflictNote =
      data.preflightConflicts.length === 0
        ? "PASSED ALL CHECKS"
        : `OVERRIDDEN (${data.preflightConflicts.map((c: any) => c.kind || "conflict").join(", ")})`;

    const reasoning = [
      `⚖️ Judicial Directive / Custom Scheduling by ${staffLabel}:`,
      `- Directive Reason: ${data.directiveReason}${noteText}`,
      `- Presiding Bench: ${data.judge.name} (${data.judge.specialisation || "General"})`,
      `- Courtroom: ${data.courtroom.name} (Cap: ${data.courtroom.capacity})`,
      `- Listing Slot: ${formatSlotLabel(data.slot)}`,
      `- Case: ${data.caseNumber} (${data.parties || "Parties on record"})`,
      `- Pre-flight Hard Constraints: ${conflictNote}`,
    ].join("\n");

    // 3. Upsert ai_recommendations
    const { data: existingRec } = await supabaseAdmin
      .from("ai_recommendations")
      .select("id")
      .eq("schedule_id", scheduleId)
      .maybeSingle();

    if (existingRec?.id) {
      await supabaseAdmin
        .from("ai_recommendations")
        .update({
          reasoning,
          status: "modified",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRec.id);
    } else {
      await supabaseAdmin.from("ai_recommendations").insert({
        schedule_id: scheduleId,
        reasoning,
        status: "modified",
      });
    }

    // 4. Update case status to scheduled
    await supabaseAdmin.from("cases").update({ status: "scheduled" }).eq("id", data.caseId);

    // 5. Safely insert audit log
    let validUserId: string | null = null;
    if (data.userId) {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("id", data.userId)
        .maybeSingle();
      if (prof?.id) validUserId = prof.id;
    }

    try {
      await supabaseAdmin.from("audit_logs").insert({
        user_id: validUserId,
        action: `Custom judicial listing confirmed for case ${data.caseNumber} with ${data.judge.name} on ${data.slot.date} (${data.directiveReason})`,
        entity_affected: `case:${data.caseNumber} schedule:${scheduleId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr) {
      console.warn("[customJudicialScheduleServerFn] audit_logs insert:", auditErr);
    }

    return { success: true, scheduleId };
  });
