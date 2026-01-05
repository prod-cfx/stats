import React from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { DashboardEditorClient } from './DashboardEditorClient';

export default function DashboardEditorPage() {
  return (
    <div className="flex flex-col h-screen w-screen bg-[#0d1117] text-white overflow-hidden">
      <Navbar />
      <DashboardEditorClient />
    </div>
  );
}

