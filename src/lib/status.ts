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
  // Module 3: what the CUSTOMER sees while their file is being reviewed. The printer never
  // sees this order at all, so there is no printer-facing wording to reconcile.
  paused: 'Pending file review',
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

/**
 * Statuses that appear in a printer's live job queue.
 *
 * 'paused' is deliberately absent and must stay that way: an order awaiting preflight is
 * COMPLETELY invisible to the printer until it passes or the customer overrides (Module 3
 * §3.2). There is a test pinning this, because adding it here would silently break the rule.
 */
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

/* ------------------------------------------------------------------ */
/* Delivery fee gate                                                   */
/* ------------------------------------------------------------------ */

export type DeliveryFeeStatus = (typeof orders.$inferSelect)['deliveryFeeStatus'];

/**
 * A delivery order may only leave the shop once the customer has agreed to the fee, because
 * they pay the rider in cash on arrival — dispatching before that risks a wasted trip with a
 * printed job that cannot be resold. Collection orders never involve a fee at all.
 */
export function canDispatch(
  method: FulfillmentMethod,
  status: OrderStatus,
  feeStatus: DeliveryFeeStatus,
): boolean {
  if (method === 'collection') return false;
  if (status !== 'ready_for_dispatch') return false;
  return feeStatus === 'accepted';
}

/** Why dispatch is blocked, in words the printer can act on. */
export function dispatchBlockedReason(
  method: FulfillmentMethod,
  status: OrderStatus,
  feeStatus: DeliveryFeeStatus,
): string | null {
  if (method === 'collection') return 'The customer is sending their own rider — use Confirm handover.';
  if (status !== 'ready_for_dispatch') return 'Mark the job ready for dispatch first.';
  if (feeStatus === 'not_set') return 'Set your delivery fee so PrintRuns can confirm it with the customer.';
  if (feeStatus === 'quoted') return 'Waiting for PrintRuns to confirm the fee with the customer.';
  if (feeStatus === 'declined') return 'The customer declined the fee — this order is switching to Collection.';
  return null;
}

/** A printer can name or revise the fee any time after the job is under way, until it ships. */
export function canSetDeliveryFee(method: FulfillmentMethod, status: OrderStatus): boolean {
  if (method === 'collection') return false;
  return ['order_received', 'printer_assigned', 'printing_in_progress', 'printing_completed', 'ready_for_dispatch']
    .includes(status);
}
