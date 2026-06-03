"use client";

import dynamic from "next/dynamic";

const SuperAdminApp = dynamic(() => import("./SuperAdminApp"), { ssr: false });

export default function Page() {
  return <SuperAdminApp />;
}
