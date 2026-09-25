-- Only a party to the booking may be recorded as the uploader. The database,
-- not the browser, fixes the upload time for every new evidence photo.
CREATE FUNCTION "set_booking_evidence_photo_provenance"()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "Booking" b
    WHERE b."id" = NEW."bookingId"
      AND NEW."uploaderId" IN (b."ownerId", b."renterId")
  ) THEN
    RAISE EXCEPTION 'Evidence uploader must be a party to the booking';
  END IF;
  NEW."createdAt" := clock_timestamp();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BookingEvidencePhoto_set_provenance"
BEFORE INSERT ON "BookingEvidencePhoto"
FOR EACH ROW
EXECUTE FUNCTION "set_booking_evidence_photo_provenance"();

-- Evidence photos are append-only. A saved image and its booking, uploader,
-- stage and server-generated upload time cannot be changed in place.
CREATE FUNCTION "prevent_booking_evidence_photo_update"()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Booking evidence photos cannot be updated';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "BookingEvidencePhoto_no_update"
BEFORE UPDATE ON "BookingEvidencePhoto"
FOR EACH ROW
EXECUTE FUNCTION "prevent_booking_evidence_photo_update"();
