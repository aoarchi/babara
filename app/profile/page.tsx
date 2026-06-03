"use client";

import dynamic from "next/dynamic";

const ProfileApp = dynamic(() => import("./ProfileApp"), { ssr: false });

export default function Page() {
  return <ProfileApp />;
}
