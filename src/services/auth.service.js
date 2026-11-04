import { env } from '../config/env.js';
import * as authRepository from '../repositories/auth.repository.js';
import { compactName } from '../utils/names.js';
import { verifyPassword } from '../utils/password.js';

export const ROLES = { ADMIN: 'ADMIN', CLIENTE: 'CLIENTE' };

export function listEntities() {
  return authRepository.findEntities();
}

const sessionUser = (entity, fields) => ({
  entityId: entity.id,
  entityCode: entity.code,
  entityName: entity.name,
  entityIbanCode: entity.ibanCode,
  ...fields,
});

/** Returns the session user, or null on any failure. The caller never learns which check failed. */
export async function login({ entityId, username, password }) {
  const entity = await authRepository.findEntity(entityId);
  const isAdmin = username === env.appUser;
  const client =
    entity && !isAdmin ? await authRepository.findClientLogin(entityId, username) : null;

  // Always run scrypt, with the admin hash as a decoy, so an unknown user takes as long as a known one.
  const passwordOk = await verifyPassword(password, client?.password_hash ?? env.appPasswordHash);
  if (!entity || !passwordOk) return null;

  if (isAdmin) {
    return sessionUser(entity, {
      role: ROLES.ADMIN,
      clientId: null,
      username,
      displayName: username,
    });
  }

  if (client?.estado !== 'ACTIVO') return null;
  return sessionUser(entity, {
    role: ROLES.CLIENTE,
    clientId: client.id_cliente,
    username: client.usuario,
    displayName: compactName(client.nombres, client.primer_apellido),
  });
}
