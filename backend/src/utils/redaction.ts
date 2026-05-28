const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+\-/=]+/gi,
  /(Authorization\s*[:=]\s*)[^\s,}]+/gi,
  /(x-goog-api-key\s*[:=]\s*)[^\s,}]+/gi,
  /(api[_-]?key\s*[:=]\s*)[^\s,}]+/gi,
  /(token\s*[:=]\s*)[^\s,}]+/gi,
  /(password\s*[:=]\s*)[^\s,}]+/gi,
  /(DATABASE_URL\s*[:=]\s*)[^\s,}]+/gi,
  /(postgres(?:ql)?:\/\/)[^\s]+/gi,
  /sk-or-[A-Za-z0-9._\-]+/gi,
  /gsk_[A-Za-z0-9._\-]+/gi,
  /AIza[A-Za-z0-9_\-]+/g,
  /gh[psuor]_[A-Za-z0-9_]+/g,
  /\d{6,}:[A-Za-z0-9_\-]+/g
];

export function redactSensitiveText(value: string, maxLength = 300): string {
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, prefix) => `${typeof prefix === "string" ? prefix : ""}[REDACTED]`);
  }
  return redacted.length > maxLength ? `${redacted.slice(0, maxLength)}...` : redacted;
}

export function safeErrorMessage(error: unknown, fallback = "Erro interno"): string {
  if (error instanceof Error && error.message) {
    return redactSensitiveText(error.message);
  }
  if (typeof error === "string" && error.trim()) {
    return redactSensitiveText(error);
  }
  return fallback;
}

export function safeLogError(error: unknown): { name?: string; message: string } {
  if (error instanceof Error) {
    return { name: error.name, message: safeErrorMessage(error) };
  }
  return { message: safeErrorMessage(error) };
}
