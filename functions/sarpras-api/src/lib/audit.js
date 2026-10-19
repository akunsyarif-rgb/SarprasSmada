import { TABLES } from './config.js';
import { auditMetadata } from './rules.js';

export async function writeAudit(ctx, action, entityType, entityId, metadata) {
  await ctx.store.createRow(TABLES.AUDIT, ctx.newId(), {
    user_id: ctx.caller.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    metadata: auditMetadata(metadata)
  }, []);
}

export async function writeHistory(ctx, report, entry) {
  await ctx.store.createRow(TABLES.HISTORY, ctx.newId(), {
    report_id: report.$id,
    previous_status: entry.previous_status || '',
    new_status: entry.new_status,
    action: entry.action,
    notes: entry.notes || '',
    performed_by: ctx.caller.id
  }, [`read("user:${report.reporter_id}")`]);
}
