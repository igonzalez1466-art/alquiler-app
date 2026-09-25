type Booking = {
  ownerId: string;
  renterId: string;
  shippedAt: Date | null;
  returnShippedAt: Date | null;
};

type Photo = {
  stage: "DELIVERY" | "RETURN";
  uploaderId: string;
};

export function canViewBookingEvidencePhoto(booking: Booking, photo: Photo, viewerId: string): boolean {
  if (![booking.ownerId, booking.renterId].includes(viewerId) ||
    ![booking.ownerId, booking.renterId].includes(photo.uploaderId)) return false;

  if (photo.uploaderId === viewerId) return true;
  return photo.stage === "DELIVERY" ? booking.shippedAt !== null : booking.returnShippedAt !== null;
}
