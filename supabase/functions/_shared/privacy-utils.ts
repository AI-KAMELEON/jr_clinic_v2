/**
 * Privacy utilities for sanitizing data before sending to voice agent
 * Ensures PESEL, phone numbers, and other sensitive data are never exposed
 */

export interface SanitizedPatient {
  id: string;
  imie: string;
  nazwisko: string;
}

export interface SanitizedAppointment {
  id: string;
  date: string;
  time: string;
  time_from: string;
  time_to: string;
  type: string;
  status: string;
}

export interface SanitizedSlot {
  id: string;
  time: string;
  time_from: string;
  time_to: string;
  type: string;
}

/**
 * Sanitizes patient data - returns ONLY id, imie, nazwisko
 * NEVER exposes: PESEL, phone, email, address, or any other sensitive data
 */
export function sanitizePatientData(patient: any): SanitizedPatient | null {
  if (!patient || !patient.id) {
    return null;
  }

  return {
    id: patient.id,
    imie: patient.imie || "",
    nazwisko: patient.nazwisko || "",
  };
}

/**
 * Masks PESEL - never expose it, even in error messages
 */
export function maskPESEL(pesel: string | null | undefined): string {
  if (!pesel) {
    return "";
  }
  // Never return PESEL - return empty string or masked version
  return "***";
}

/**
 * Sanitizes appointment data - returns only necessary fields
 * NEVER exposes: patient_id, PESEL, phone, or other sensitive data
 */
export function sanitizeAppointmentData(appointment: any): SanitizedAppointment | null {
  if (!appointment || !appointment.id) {
    return null;
  }

  return {
    id: appointment.id,
    date: appointment.data || "",
    time: appointment.godzina || "",
    time_from: appointment.godzina_od || "",
    time_to: appointment.godzina_do || "",
    type: appointment.rodzaj || "",
    status: appointment.status || "",
  };
}

/**
 * Sanitizes slot data - returns only necessary fields for booking
 */
export function sanitizeSlotData(slot: any): SanitizedSlot | null {
  if (!slot || !slot.id) {
    return null;
  }

  return {
    id: slot.id,
    time: slot.godzina || "",
    time_from: slot.godzina_od || "",
    time_to: slot.godzina_do || "",
    type: slot.rodzaj || "",
  };
}

/**
 * Sanitizes parameters for logging - removes sensitive data
 */
export function sanitizeParamsForLogging(params: any): any {
  if (!params) {
    return {};
  }

  const sanitized: any = { ...params };

  // Remove sensitive fields
  delete sanitized.telefon;
  delete sanitized.phone;
  delete sanitized.pesel;
  delete sanitized.email;
  delete sanitized.adres;

  // If patient_id exists, keep it (it's a UUID, not sensitive)
  // But remove any other patient-related data

  return sanitized;
}

/**
 * Validates UUID format
 */
export function isValidUUID(uuid: string | null | undefined): boolean {
  if (!uuid) {
    return false;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validates date format YYYY-MM-DD
 */
export function isValidDate(date: string | null | undefined): boolean {
  if (!date) {
    return false;
  }
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }
  const d = new Date(date);
  return d instanceof Date && !isNaN(d.getTime());
}

/**
 * Sanitizes string input - removes potential SQL injection attempts
 */
export function sanitizeStringInput(input: string | null | undefined): string {
  if (!input) {
    return "";
  }
  // Remove SQL injection patterns
  return input
    .replace(/['";\\]/g, "")
    .replace(/--/g, "")
    .replace(/\/\*/g, "")
    .replace(/\*\//g, "")
    .trim();
}

