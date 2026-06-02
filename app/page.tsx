"use client";

import dynamic from "next/dynamic";

const GuestApp = dynamic(() => import("./GuestApp"), { ssr: false });

export default function Page() {
  return <GuestApp />;
}
