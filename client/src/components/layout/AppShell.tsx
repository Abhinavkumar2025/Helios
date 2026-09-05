import React from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";
import { DemoControlBar } from "./DemoControlBar";
import { EmergencyAlertModal } from "./EmergencyAlertModal";
import { motion } from "framer-motion";

export const AppShell: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-helios-950 text-slate-100 selection:bg-solar-500 selection:text-helios-950 font-sans">
      {/* Persistent Left Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        <TopNav />
        <DemoControlBar />

        {/* Emergency Alert Modal mounted for immediate event broadcast reaction */}
        <EmergencyAlertModal />

        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  );
};
