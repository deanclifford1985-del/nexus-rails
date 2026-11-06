// Calls to the Nexus Rail server. The sign-in layer installs a token getter (Clerk) or a test user.
let tokenOf = async () => null;
let testUser = null;

export function configureApi({ getToken = null, devUser = null } = {}) {
  if (getToken) tokenOf = getToken;
  testUser = devUser;
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, body) {
  const headers = { 'content-type': 'application/json' };
  const token = await tokenOf();
  if (token) headers.authorization = `Bearer ${token}`;
  if (testUser) {
    headers['x-dev-user'] = testUser.id;
    if (testUser.email) headers['x-dev-email'] = testUser.email;
  }
  let res;
  try {
    res = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError("Can't reach the Nexus Rail server. Check your connection.", 0);
  }
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError("The Nexus Rail server isn't running here.", res.status);
  }
  if (!res.ok) throw new ApiError(json?.error ?? 'Something went wrong.', res.status);
  return json;
}
