export const bookingActionFeedbackEvent = "booking-action-feedback";

export type BookingActionFeedbackDetail = { bookingId: string; message: string };

export function announceBookingAction(bookingId: string, message: string) {
  const detail: BookingActionFeedbackDetail = { bookingId, message };
  try {
    sessionStorage.setItem(`${bookingActionFeedbackEvent}:${bookingId}`, JSON.stringify({ ...detail, at: Date.now() }));
  } catch { /* Feedback still works while the page is open. */ }
  window.dispatchEvent(new CustomEvent(bookingActionFeedbackEvent, { detail }));
  window.dispatchEvent(new Event("profile-tasks-updated"));
}
