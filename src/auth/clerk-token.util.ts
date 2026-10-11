export function extractEmailFromClerkPayload(
  payload: Record<string, unknown>,
): string | undefined {
  const direct = payload.email;
  if (typeof direct === 'string' && direct) return direct.toLowerCase();

  const primary = payload.primary_email_address;
  if (typeof primary === 'string' && primary) return primary.toLowerCase();

  return undefined;
}

export function extractClerkUserId(
  payload: Record<string, unknown>,
): string | undefined {
  const sub = payload.sub;
  if (typeof sub === 'string' && sub) return sub;
  return undefined;
}
