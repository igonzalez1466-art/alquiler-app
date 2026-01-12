-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."Estado" AS ENUM ('NUEVO', 'COMO_NUEVO', 'USADO', 'MUY_USADO');

-- CreateEnum
CREATE TYPE "public"."MetodoEnvio" AS ENUM ('RECOGIDA_LOCAL', 'ENVIO_CORREOS', 'MENSAJERIA', 'OTRO');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('WOMAN', 'MAN', 'UNISEX', 'KIDS');

-- CreateEnum
CREATE TYPE "public"."GarmentType" AS ENUM ('ABRIGO', 'CHAQUETA', 'CAMISA', 'BLUSA', 'VESTIDO', 'PANTALON', 'FALDA', 'TRAJE', 'SUDADERA', 'JERSEY', 'MONO', 'ACCESORIO', 'CHAMARRA', 'OTRO', 'ZAPATO');

-- CreateEnum
CREATE TYPE "public"."Color" AS ENUM ('CZARNY', 'BIALY', 'SZARY', 'BEZOWY', 'BRAZOWY', 'CZERWONY', 'ROZOWY', 'POMARANCZOWY', 'ZOLTY', 'ZIELONY', 'NIEBIESKI', 'GRANATOWY', 'FIOLETOWY', 'ZLOTY', 'SREBRNY', 'WIELOKOLOROWY');

-- CreateEnum
CREATE TYPE "public"."BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ReviewRole" AS ENUM ('OWNER', 'RENTER');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'REFUNDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('CARD', 'BANK_TRANSFER', 'BIZUM', 'CASH', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ShippingStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'READY', 'SHIPPED', 'DELIVERED', 'RETURN_PENDING', 'RETURNED', 'LOST', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ConversationCloseReason" AS ENUM ('BOOKING_CANCELLED_BY_OWNER', 'LISTING_UNAVAILABLE', 'OTHER');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationCode" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "role" "public"."Role" NOT NULL DEFAULT 'USER',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Listing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pricePerDay" INTEGER NOT NULL,
    "city" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "estado" "public"."Estado" NOT NULL DEFAULT 'USADO',
    "fianza" INTEGER,
    "metodoEnvio" "public"."MetodoEnvio" NOT NULL DEFAULT 'RECOGIDA_LOCAL',
    "marca" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "country" TEXT,
    "postalCode" TEXT,
    "color" "public"."Color",
    "garmentType" "public"."GarmentType",
    "gender" "public"."Gender",
    "materials" JSONB,
    "size" TEXT,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Image" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Image_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buyerLastReadAt" TIMESTAMP(3),
    "sellerLastReadAt" TIMESTAMP(3),
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedReason" "public"."ConversationCloseReason",

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Booking" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentStatus" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentMethod" "public"."PaymentMethod",
    "paymentRef" TEXT,
    "amountCents" INTEGER,
    "depositCents" INTEGER,
    "paidAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "shippingStatus" "public"."ShippingStatus" NOT NULL DEFAULT 'PENDING',
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnStatus" "public"."ShippingStatus" NOT NULL DEFAULT 'RETURN_PENDING',
    "returnCarrier" TEXT,
    "returnTrackingNumber" TEXT,
    "returnShippedAt" TIMESTAMP(3),
    "returnDeliveredAt" TIMESTAMP(3),

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "revieweeId" TEXT NOT NULL,
    "role" "public"."ReviewRole" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE INDEX "Listing_createdAt_idx" ON "public"."Listing"("createdAt");

-- CreateIndex
CREATE INDEX "Listing_city_idx" ON "public"."Listing"("city");

-- CreateIndex
CREATE INDEX "Listing_marca_idx" ON "public"."Listing"("marca");

-- CreateIndex
CREATE INDEX "Listing_lat_lng_idx" ON "public"."Listing"("lat", "lng");

-- CreateIndex
CREATE INDEX "Listing_postalCode_idx" ON "public"."Listing"("postalCode");

-- CreateIndex
CREATE INDEX "Listing_country_idx" ON "public"."Listing"("country");

-- CreateIndex
CREATE INDEX "Listing_gender_idx" ON "public"."Listing"("gender");

-- CreateIndex
CREATE INDEX "Listing_size_idx" ON "public"."Listing"("size");

-- CreateIndex
CREATE INDEX "Listing_color_idx" ON "public"."Listing"("color");

-- CreateIndex
CREATE INDEX "Listing_garmentType_idx" ON "public"."Listing"("garmentType");

-- CreateIndex
CREATE INDEX "Image_listingId_idx" ON "public"."Image"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Conversation_buyerId_idx" ON "public"."Conversation"("buyerId");

-- CreateIndex
CREATE INDEX "Conversation_sellerId_idx" ON "public"."Conversation"("sellerId");

-- CreateIndex
CREATE INDEX "Conversation_listingId_idx" ON "public"."Conversation"("listingId");

-- CreateIndex
CREATE INDEX "Conversation_status_idx" ON "public"."Conversation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_listingId_buyerId_key" ON "public"."Conversation"("listingId", "buyerId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "public"."Message"("conversationId");

-- CreateIndex
CREATE INDEX "Booking_listingId_idx" ON "public"."Booking"("listingId");

-- CreateIndex
CREATE INDEX "Booking_renterId_idx" ON "public"."Booking"("renterId");

-- CreateIndex
CREATE INDEX "Booking_paymentStatus_idx" ON "public"."Booking"("paymentStatus");

-- CreateIndex
CREATE INDEX "Booking_shippingStatus_idx" ON "public"."Booking"("shippingStatus");

-- CreateIndex
CREATE INDEX "Booking_returnStatus_idx" ON "public"."Booking"("returnStatus");

-- CreateIndex
CREATE INDEX "Booking_carrier_trackingNumber_idx" ON "public"."Booking"("carrier", "trackingNumber");

-- CreateIndex
CREATE INDEX "Booking_returnCarrier_returnTrackingNumber_idx" ON "public"."Booking"("returnCarrier", "returnTrackingNumber");

-- CreateIndex
CREATE INDEX "Review_revieweeId_idx" ON "public"."Review"("revieweeId");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_reviewerId_revieweeId_key" ON "public"."Review"("bookingId", "reviewerId", "revieweeId");

-- AddForeignKey
ALTER TABLE "public"."Listing" ADD CONSTRAINT "Listing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Image" ADD CONSTRAINT "Image_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "public"."Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Booking" ADD CONSTRAINT "Booking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_revieweeId_fkey" FOREIGN KEY ("revieweeId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "public"."Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
