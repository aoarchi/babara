"use client";

import dynamic from "next/dynamic";

const FriendsApp = dynamic(() => import("./FriendsApp"), { ssr: false });

export default function Page() {
  return <FriendsApp />;
}
