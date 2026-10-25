export function backoffSeconds(attempt) {
  return Math.min(3600, 30 * (2 ** Math.max(0, attempt - 1)));
}

export function isTerminalAttempt(attempt, maxAttempts) {
  return attempt >= maxAttempts;
}
