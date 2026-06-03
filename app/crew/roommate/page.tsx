"use client";

import dynamic from "next/dynamic";

const RoommateApp = dynamic(() => import("./RoommateApp"), { ssr: false });

export default function Page() {
  return <RoommateApp />;
}
