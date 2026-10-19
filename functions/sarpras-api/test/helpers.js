// Fake in-memory store + users untuk menguji handler tanpa Appwrite.
import { ROLE_LABELS } from '../src/lib/config.js';

export function createFakes() {
  const tables = {};
  let seq = 0;
  const store = {
    async getRow(t, id) { return (tables[t] && tables[t][id]) || null; },
    async createRow(t, id, data, permissions) {
      tables[t] = tables[t] || {};
      if (tables[t][id]) throw Object.assign(new Error('exists'), { code: 409 });
      return (tables[t][id] = { $id: id, $permissions: permissions, ...data });
    },
    async updateRow(t, id, data) { return Object.assign(tables[t][id], data); },
    async incrementRowColumn(t, id, col, v) { tables[t][id][col] += v; return tables[t][id]; }
  };
  const authUsers = {};
  const users = {
    async get({ userId }) {
      if (!authUsers[userId]) throw Object.assign(new Error('nf'), { code: 404 });
      return authUsers[userId];
    },
    async create({ userId, email, name }) { authUsers[userId] = { $id: userId, email, name, status: true, labels: [] }; },
    async updateLabels({ userId, labels }) { authUsers[userId].labels = labels; },
    async updateStatus({ userId, status }) { authUsers[userId].status = status; },
    async updatePassword({ userId, password }) { authUsers[userId].password = password; },
    async updateEmail({ userId, email }) { authUsers[userId].email = email; },
    async updateName({ userId, name }) { authUsers[userId].name = name; },
    async delete({ userId }) { delete authUsers[userId]; }
  };
  const ctxBase = { store, users, now: new Date('2026-10-19T10:00:00Z'), newId: () => `id${++seq}` };
  const addUser = (id, role, extra = {}) => {
    authUsers[id] = { $id: id, email: `${id}@x.id`, name: id, status: true, labels: [ROLE_LABELS[role]], ...extra };
  };
  const seed = (t, id, data) => { tables[t] = tables[t] || {}; tables[t][id] = { $id: id, ...data }; };
  return { tables, store, users, authUsers, ctxBase, addUser, seed };
}

export function seedMaster(f) {
  f.seed('sarpras_locations', 'LOC1', { is_active: true });
  f.seed('sarpras_categories', 'CAT1', { is_active: true });
  f.seed('sarpras_facilities', 'FAC1', { is_active: true });
  f.seed('sarpras_owners', 'OWN1', { is_active: true });
  f.seed('sarpras_sequences', 'REPORT', { sequence_name: 'REPORT', current_value: 0 });
}
