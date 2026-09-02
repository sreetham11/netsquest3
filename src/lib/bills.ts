// Pure display helper for the Bills page's due-date urgency styling.
//
// RecurringBill.dueDayOfMonth is a recurrence marker (1-31), not a real
// calendar date, so "days until due" is a simple day-of-month subtraction —
// consistent with how the rest of the Bills feature already treats it (see
// BillCard's `ordinal(bill.dueDayOfMonth)`), not a Date object with
// month-length/rollover handling.
//
// A negative result (the due day already passed this month) still counts as
// "due soon" — an unpaid overdue bill is at least as urgent as one due in 3
// days, not less. A bill already paid this cycle is never due soon: there's
// nothing left to act on until next month resets it.
const DUE_SOON_WINDOW_DAYS = 3;

export function isDueSoon(
  dueDayOfMonth: number,
  paidThisMonth: boolean,
  today: Date = new Date(),
): boolean {
  if (paidThisMonth) return false;
  const daysUntilDue = dueDayOfMonth - today.getDate();
  return daysUntilDue <= DUE_SOON_WINDOW_DAYS;
}
