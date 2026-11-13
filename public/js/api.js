// fetch wrapper: JSON in and out, uniform errors, and a redirect to login on 401.

export class ApiError extends Error {
  constructor(message, status, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

const LOGIN_ENDPOINT = '/api/auth/login';

/**
 * Calls the API. Resolves with the parsed JSON (null for 204) or throws ApiError.
 * A File/Blob body is sent as is (application/octet-stream): only the backup upload uses it.
 */
export async function api(path, { method = 'GET', body } = {}) {
  const isFile = body instanceof Blob;
  let res;
  try {
    // Writes always declare JSON: browsers send Content-Length: 0 on empty POSTs, which the server treats as a body.
    res = await fetch(path, {
      method,
      headers:
        method === 'GET'
          ? {}
          : { 'Content-Type': isFile ? 'application/octet-stream' : 'application/json' },
      body: body === undefined || isFile ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor', 0);
  }

  // A failed login is also a 401, but it must show its message instead of redirecting.
  if (res.status === 401 && path !== LOGIN_ENDPOINT) {
    location.replace('/');
    throw new ApiError('Sesión expirada', 401);
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(data?.error ?? 'Error inesperado', res.status, data?.field);
  }
  return data;
}
