import { roleFromLabels } from './rules.js';
import { forbidden } from './errors.js';

/**
 * Identitas pemanggil DIAMBIL ULANG dari server (Users API) pada setiap
 * request: status akun dan label dibaca langsung, bukan dari klien.
 * userId berasal dari header x-appwrite-user-id yang diisi Appwrite.
 */
export async function resolveCaller(users, userId) {
  if (!userId) throw forbidden('Silakan login.');
  let user;
  try {
    user = await users.get({ userId });
  } catch (e) {
    throw forbidden('Sesi tidak valid.');
  }
  if (!user.status) throw forbidden('Akun dinonaktifkan.');
  const role = roleFromLabels(user.labels);
  if (!role) throw forbidden('Akun ini tidak memiliki akses ke SIGAP SARPRAS.');
  return { id: user.$id, role, name: user.name, email: user.email, labels: user.labels };
}

export function requireRole(caller, roles) {
  if (!roles.includes(caller.role)) throw forbidden(`Peran "${caller.role}" tidak diizinkan melakukan aksi ini.`);
}
