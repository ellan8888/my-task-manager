"use client";

import AdminSidebar from "../components/AdminSidebar";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { PushNotificationButton } from "../components/PushNotificationButton";
import ChatDock from "../components/ChatDock";
import VersionWatcher from "@/app/components/VersionWatcher";
import { usePathname } from "next/navigation";

function LayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarOpen, setSidebarOpen } = useSidebar();
  const pathname = usePathname();

  return (
    <div className="h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col relative">
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          sidebarOpen ? "md:ml-72" : "md:ml-0"
        }`}
      >
        {/* key = halaman → tiap pindah menu, isi halaman masuk dengan animasi */}
        <div key={pathname} className="page-enter flex-1 flex flex-col min-h-0">
          {children}
        </div>
      </main>
      <ChatDock />
      <VersionWatcher />
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <LayoutInner>{children}</LayoutInner>
    </SidebarProvider>
  );
}