/** `value` in CPC hexadecimal, as `#C000`. */
export function hex(value: number, digits = 4): string {
  return `#${value.toString(16).toUpperCase().padStart(digits, "0")}`;
}

export const ADDRESS_TAKES = "#0000 to #FFFF";

/** Whether `value` is a 16-bit address, or a value as wide, such as a port mask. */
export function isAddress(value: unknown): value is number {
  return isWholeIn(value, 0, 0xffff);
}

export const BYTE_TAKES = "0 to 255";

export function isByte(value: unknown): value is number {
  return isWholeIn(value, 0, 0xff);
}

/** Whether `value` is a whole number from `min` to `max`. */
export function isWholeIn(
  value: unknown,
  min: number,
  max: number,
): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= min &&
    (value as number) <= max
  );
}
