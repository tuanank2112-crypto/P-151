import { SLA_HOURS } from "./constants";

const HOUR = 3_600_000;

export function slaHours(urgent: boolean): number {
  return urgent ? SLA_HOURS.urgent : SLA_HOURS.normal;
}

/** Whole hours elapsed since creation (rounded down) */
export function ageHours(createdAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / HOUR));
}

/** Open = not cancelled and the department has not reported done yet (01-CONTRACTS §2) */
export function isOpen(t: { cancelled: boolean; stage: number }): boolean {
  return !t.cancelled && t.stage < 5;
}

export function isLate(t: { cancelled: boolean; stage: number; urgent: boolean; createdAt: Date }, now: Date): boolean {
  return isOpen(t) && now.getTime() - t.createdAt.getTime() > slaHours(t.urgent) * HOUR;
}

/** Hours left before the deadline; negative when late (Technical.dc.html `left`) */
export function hoursLeft(t: { urgent: boolean; createdAt: Date }, now: Date): number {
  return slaHours(t.urgent) - ageHours(t.createdAt, now);
}

export function deadline(t: { urgent: boolean; createdAt: Date }): Date {
  return new Date(t.createdAt.getTime() + slaHours(t.urgent) * HOUR);
}
