export type TraccarCredentials = {
  token?: string;
  username?: string;
  password?: string;
};

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function traccarAuthorization(credentials: TraccarCredentials) {
  const token = credentials.token?.trim();
  if (token) return `Bearer ${token}`;

  const username = credentials.username?.trim();
  const password = credentials.password;
  if (username && password) return `Basic ${utf8Base64(`${username}:${password}`)}`;

  return null;
}
