import { TABLES } from '../lib/config.js';
import { badRequest, notFound } from '../lib/errors.js';
import {
  validateProfileFields, validatePassword, labelsWithRole, roleFromLabels, str
} from '../lib/rules.js';
import { writeAudit } from '../lib/audit.js';
import { ROLE_LABELS } from '../lib/config.js';

const profilePerms = (userId) => [`read("user:${userId}")`];

async function loadUser(ctx, userId) {
  const id = str(userId, 'user_id', { max: 36, required: true });
  try {
    return await ctx.users.get({ userId: id });
  } catch (e) {
    throw notFound(`Pengguna tidak ditemukan: "${id}".`);
  }
}

export async function createUser(ctx, input) {
  const fields = validateProfileFields(input, { partial: false });
  const password = validatePassword(input.password);
  const userId = ctx.newId();

  await ctx.users.create({ userId, email: fields.email, password, name: fields.full_name });
  try {
    await ctx.users.updateLabels({ userId, labels: [ROLE_LABELS[fields.role]] });
    const profile = await ctx.store.createRow(
      TABLES.USERS, userId, { ...fields, is_active: true, legacy_user_id: '' }, profilePerms(userId)
    );
    await writeAudit(ctx, 'CREATE_USER', 'user', userId, { role: fields.role });
    return profile;
  } catch (e) {
    // Kompensasi: jangan tinggalkan akun Auth tanpa profil/label.
    await ctx.users.delete({ userId }).catch(() => {});
    throw e;
  }
}

export async function updateUser(ctx, input) {
  const user = await loadUser(ctx, input.user_id);
  const updates = input.updates;
  if (!updates || typeof updates !== 'object' || Array.isArray(updates)) throw badRequest('"updates" wajib berupa object.');
  const allowed = ['email', 'full_name', 'role', 'student_id', 'class_name', 'owner_id'];
  for (const k of Object.keys(updates)) {
    if (!allowed.includes(k)) throw badRequest(`Kolom "${k}" tidak dapat diubah.`);
  }
  const patch = validateProfileFields(updates, { partial: true });
  if (Object.keys(patch).length === 0) throw badRequest('Tidak ada kolom yang diubah.');

  if (patch.role && user.$id === ctx.caller.id && patch.role !== 'ADMIN') {
    throw badRequest('Admin tidak dapat menurunkan perannya sendiri.');
  }
  if (patch.email && patch.email !== user.email) await ctx.users.updateEmail({ userId: user.$id, email: patch.email });
  if (patch.full_name && patch.full_name !== user.name) await ctx.users.updateName({ userId: user.$id, name: patch.full_name });
  if (patch.role && patch.role !== roleFromLabels(user.labels)) {
    await ctx.users.updateLabels({ userId: user.$id, labels: labelsWithRole(user.labels, patch.role) });
  }

  const profile = await ctx.store.getRow(TABLES.USERS, user.$id);
  const saved = profile
    ? await ctx.store.updateRow(TABLES.USERS, user.$id, patch)
    : await ctx.store.createRow(TABLES.USERS, user.$id, {
        email: user.email, full_name: user.name, role: roleFromLabels(user.labels) || patch.role,
        student_id: '', class_name: '', owner_id: '', is_active: user.status, legacy_user_id: '', ...patch
      }, profilePerms(user.$id));
  await writeAudit(ctx, 'UPDATE_USER', 'user', user.$id, { fields: Object.keys(patch) });
  return saved;
}

export async function deactivateUser(ctx, input) {
  const user = await loadUser(ctx, input.user_id);
  if (user.$id === ctx.caller.id) throw badRequest('Anda tidak dapat menonaktifkan akun sendiri.');
  await ctx.users.updateStatus({ userId: user.$id, status: false });
  const profile = await ctx.store.getRow(TABLES.USERS, user.$id);
  const saved = profile ? await ctx.store.updateRow(TABLES.USERS, user.$id, { is_active: false }) : null;
  await writeAudit(ctx, 'DEACTIVATE_USER', 'user', user.$id, {});
  return saved;
}

export async function setPassword(ctx, input) {
  const user = await loadUser(ctx, input.user_id);
  const password = validatePassword(input.new_password);
  await ctx.users.updatePassword({ userId: user.$id, password });
  await writeAudit(ctx, 'SET_PASSWORD', 'user', user.$id, {});
  return null;
}

/** Membuat profil untuk pemanggil yang sudah berlabel tetapi belum punya baris profil (mis. admin pertama). */
export async function syncMyProfile(ctx) {
  const existing = await ctx.store.getRow(TABLES.USERS, ctx.caller.id);
  if (existing) return existing;
  return ctx.store.createRow(TABLES.USERS, ctx.caller.id, {
    email: ctx.caller.email, full_name: ctx.caller.name || ctx.caller.email, role: ctx.caller.role,
    student_id: '', class_name: '', owner_id: '', is_active: true, legacy_user_id: ''
  }, profilePerms(ctx.caller.id));
}
