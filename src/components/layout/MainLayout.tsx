import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNavigation } from "./BottomNavigation";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col overflow-hidden text-slate-100">
      <Header />
      <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4 scrollbar-hide bg-slate-950">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
