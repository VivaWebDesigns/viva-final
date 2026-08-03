export type SalesPriorityLevel = 1 | 2 | 3;

export interface SalesPrioritySnapshot {
  priority: SalesPriorityLevel;
  reason: string | null;
}

export function parseSalesPriority(value: unknown): SalesPriorityLevel | null {
  const parsed = Number(value);
  return parsed === 1 || parsed === 2 || parsed === 3 ? parsed : null;
}
