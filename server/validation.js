export const validBloodTypes = new Set(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);
export const validUrgencies = new Set(['Urgente', 'Normal']);
export const validFinalStatuses = new Set(['Fulfilled', 'Cancelled']);

export function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    const error = new Error(`${field} is required`);
    error.statusCode = 400;
    throw error;
  }
  return value.trim();
}

export function requireChoice(value, field, choices) {
  const normalized = requireText(value, field);
  if (!choices.has(normalized)) {
    const error = new Error(`${field} is invalid`);
    error.statusCode = 400;
    throw error;
  }
  return normalized;
}
