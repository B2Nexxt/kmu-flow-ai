"use client";

import { usePathname } from "next/navigation";

import Sidebar from "./sidebar";

const PUBLIC_PATHS = ["/login", "/kein-zugang", "/mandant-waehlen"];

function isPublicOperativePath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export default function AppChrome({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();

  if (isPublicOperativePath(pathname)) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-zinc-950">{children}</main>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">{children}</main>
    </div>
  );
}
