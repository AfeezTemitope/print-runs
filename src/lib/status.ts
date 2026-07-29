import type { orders } from '@/db/schema';

export type OrderStatus = (typeof orders.$inferSelect)['status'];
export type FulfillmentMethod = (typeof orders.$inferSelect)['fulfillmentMethod'];

/**
 * V2 order lifecycle (decision 18). One source of truth for labels and ordering, used by
 * the customer tracker, the order pages and the printer queue alike.
 *
 * Delivery path:   order_received → printer_assigned → printing_in_progress →
 *                  printing_completed → ready_for_dispatch → out_for_delivery → delivered
 * Collection path: identical until ready_for_dispatch, then straight to delivered on
 *                  confirmed handover to the customer's own rider (28 Jul decision) —
 *                  'out_for_delivery' never applies, because PrintRuns isn't delivering it.
 */
export const DELIVERY_STEPS: OrderStatus[] = [
  'order_received',
  'printer_assigned',
  'printing_in_progress',
  'printing_completed',
  'ready_for_dispatch',
  'out_for_delivery',
  'delivered',
];

export const COLLECTION_STEPS: OrderStatus[] = [
  'order_received',
  'printer_assigned',
  'printing_in_progress',
  'printing_completed',
  'ready_for_dispatch',
  'delivered',
];

export function stepsFor(method: FulfillmentMethod): OrderStatus[] {
  return method === 'collection' ? COLLECTION_STEPS : DELIVERY_STEPS;
}

const LABELS: Record<OrderStatus, string> = {
  order_received: 'Order received',
  printer_assigned: 'Printer assigned',
  printing_in_progress: 'Printing',
  printing_completed: 'Printing done',
  ready_for_dispatch: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export function statusLabel(status: OrderStatus, method: FulfillmentMethod = 'delivery'): string {
  // On the collection path the final step is a handover to the customer's own rider,
  // not a PrintRuns delivery — say so plainly rather than reusing 'Delivered'.
  if (status === 'delivered' && method === 'collection') return 'Collected';
  if (status === 'ready_for_dispatch' && method === 'collection') return 'Ready for collection';
  return LABELS[status];
}

/** Terminal states — nothing in the printer queue should still be actionable here. */
export function isTerminal(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

/** Statuses that appear in a printer's live job queue. */
export const QUEUE_STATUSES: OrderStatus[] = [
  'order_received',
  'printer_assigned',
  'printing_in_progress',
  'printing_completed',
  'ready_for_dispatch',
  'out_for_delivery',
];

/**
 * A printer may only decline BEFORE any production work has happened. Once printing has
 * started, materials are committed and the Refund & Cancellation Policy treats it as
 * non-cancellable — so "Can't Fulfil" disappears from the UI at that point.
 */
export function canDecline(status: OrderStatus): boolean {
  return status === 'order_received' || status === 'printer_assigned';
}

/**
 * Settlement eligibility (decision 20): a printer's entitlement is triggered by confirmed
 * HANDOVER, not by delivery specifically — and is explicitly NOT delayed by a customer being
 * slow to collect. So a collection order becomes settleable once it is ready and the customer
 * has been notified; a delivery order becomes settleable once actually delivered.
 *
 * This reports eligibility only. Actual payout is an ops action (Batch 3) — nothing here
 * moves money on its own.
 */
export function isSettlementEligible(status: OrderStatus, method: FulfillmentMethod): boolean {
  if (status === 'delivered') return true;
  if (method === 'collection' && status === 'ready_for_dispatch') return true;
  return false;
}
