"use client";

import dynamic from "next/dynamic";

const ListingMap = dynamic(() => import("./components/ListingMap"), {
  ssr: false,
});

export default function MapClient(props: { markers: unknown[] }) {
  return <ListingMap {...props} />;
}
