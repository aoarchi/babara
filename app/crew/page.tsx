"use client";

import dynamic from "next/dynamic";

const CrewApp = dynamic(() => import("./CrewApp"), { ssr: false });

export default function Page() {
  return <CrewApp />;
}
