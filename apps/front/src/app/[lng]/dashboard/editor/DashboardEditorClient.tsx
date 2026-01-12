'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DashboardEditorSidebar } from '@/components/dashboard/DashboardEditorSidebar';
import { EditorCanvas } from '@/components/dashboard/EditorCanvas';

export function DashboardEditorClient() {
  const { t } = useTranslation();
  const params = useParams();
  const lng = params.lng as string || 'zh';
  const searchParams = useSearchParams();
  const dashboardId = searchParams.get('id') || 'draft';

  return (
    <main className="flex-1 flex min-h-0">
      {/* Sidebar */}
      <DashboardEditorSidebar dashboardId={dashboardId} />

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar p-8">
        <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6">
          {/* Back Button */}
          <Link
            href={`/${lng}/dashboard/?tab=saved`}
            className="flex items-center gap-2 text-[#8b949e] hover:text-white transition-colors text-sm w-fit"
                >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('dashboard.editor.backToList')}</span>
          </Link>

          {/* Editor Content */}
          <EditorCanvas dashboardId={dashboardId} />
        </div>
      </div>
    </main>
  );
}

