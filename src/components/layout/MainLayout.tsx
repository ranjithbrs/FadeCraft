import { ReactNode } from "react";
import { Header } from "./Header";
import { BottomNavigation } from "./BottomNavigation";

interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="min-h-screen bg-white flex flex-col overflow-hidden">
      <Header />
      <main className="flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-4 scrollbar-hide">
        {children}
      </main>
      <BottomNavigation />
    </div>
  );
};
