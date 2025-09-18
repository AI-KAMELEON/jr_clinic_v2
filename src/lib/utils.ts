import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Walidacja numeru PESEL
export function validatePESEL(pesel: string): boolean {
  // Sprawdź czy to 11 cyfr
  if (!/^\d{11}$/.test(pesel)) {
    return false;
  }

  // Walidacja cyfry kontrolnej
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  
  for (let i = 0; i < 10; i++) {
    sum += parseInt(pesel[i]) * weights[i];
  }
  
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === parseInt(pesel[10]);
}

// Wyciągnij datę urodzenia z PESEL
export function extractDateFromPESEL(pesel: string): Date | null {
  if (!validatePESEL(pesel)) return null;
  
  const year = parseInt(pesel.substring(0, 2));
  const month = parseInt(pesel.substring(2, 4));
  const day = parseInt(pesel.substring(4, 6));
  
  // Określ stulecie na podstawie miesiąca
  let fullYear = 1900 + year;
  if (month >= 21 && month <= 32) fullYear += 100; // 2000-2099
  else if (month >= 41 && month <= 52) fullYear += 200; // 2100-2199
  else if (month >= 61 && month <= 72) fullYear += 300; // 2200-2299
  else if (month >= 81 && month <= 92) fullYear += 400; // 2300-2399
  
  // Normalizuj miesiąc
  const normalizedMonth = month % 20;
  
  // Sprawdź czy data jest prawidłowa
  const date = new Date(fullYear, normalizedMonth - 1, day);
  if (date.getFullYear() !== fullYear || 
      date.getMonth() !== normalizedMonth - 1 || 
      date.getDate() !== day) {
    return null;
  }
  
  return date;
}

// Formatuj PESEL z myślnikami dla lepszej czytelności
export function formatPESEL(pesel: string): string {
  if (!/^\d{11}$/.test(pesel)) return pesel;
  return `${pesel.substring(0, 6)}-${pesel.substring(6, 11)}`;
}
