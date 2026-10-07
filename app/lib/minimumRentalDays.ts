export const MINIMUM_RENTAL_DAYS = 3;
export const MAXIMUM_RENTAL_DAYS = 2147483647;
export function isValidMinimumRentalDays(value: number): boolean {
  return Number.isInteger(value) && value >= MINIMUM_RENTAL_DAYS && value <= MAXIMUM_RENTAL_DAYS;
}
export function effectiveMinimumRentalDays(value: number): number {
  return Number.isInteger(value) ? Math.max(MINIMUM_RENTAL_DAYS, value) : MINIMUM_RENTAL_DAYS;
}
