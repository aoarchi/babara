"use client";

import dynamic from "next/dynamic";

const MapApp = dynamic(() => import("./MapApp"), { ssr: false });

export default function Page() {
  return <MapApp />;
}
