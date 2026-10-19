import { resolveCaller, requireRole } from './lib/auth.js';
import { HttpError } from './lib/errors.js';
import * as reports from './handlers/reports.js';
import * as usersH from './handlers/users.js';

/** action → { roles: null (semua role sarpras) | [...], run } */
export const ACTIONS = {
  createReport: { roles: null, run: reports.createReport },
  updateReport: { roles: null, run: reports.updateReport },
  changeReportStatus: { roles: ['VERIFIKATOR', 'OWNER', 'ADMIN'], run: reports.changeReportStatus },
  deactivateReport: { roles: ['VERIFIKATOR', 'OWNER', 'ADMIN'], run: reports.deactivateReport },
  createUser: { roles: ['ADMIN'], run: usersH.createUser },
  updateUser: { roles: ['ADMIN'], run: usersH.updateUser },
  deactivateUser: { roles: ['ADMIN'], run: usersH.deactivateUser },
  setPassword: { roles: ['ADMIN'], run: usersH.setPassword },
  syncMyProfile: { roles: null, run: usersH.syncMyProfile }
};

/** Inti yang dapat diuji tanpa SDK: ctxBase = {store, users, now, newId}. */
export async function dispatch(ctxBase, userId, body) {
  const action = body && body.action;
  const def = Object.prototype.hasOwnProperty.call(ACTIONS, action) ? ACTIONS[action] : null;
  if (!def) throw new HttpError(400, `Action tidak dikenal: "${action}".`);
  const caller = await resolveCaller(ctxBase.users, userId);
  if (def.roles) requireRole(caller, def.roles);
  return def.run({ ...ctxBase, caller }, body);
}
