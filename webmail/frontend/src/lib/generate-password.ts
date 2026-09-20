const CHARSET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";

export function generatePassword(length = 12): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < length; i++) {
    result += CHARSET[bytes[i]! % CHARSET.length];
  }
  return result;
}
