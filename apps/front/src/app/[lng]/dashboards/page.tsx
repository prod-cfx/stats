'use client'

import type { DashboardDoc } from '@/features/dashboards/store/dashboardStore'
import { Bookmark, ChevronDown, Edit2, Grid3x3, Plus, Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExploreDashboards } from '@/components/dashboard/ExploreDashboards'
import { DashboardCanvas } from '@/features/dashboards/components/DashboardCanvas'
import {
  createNewDashboard,
  DASHBOARD_UPDATED_EVENT,
  getMyDashboards,
  getSavedDashboards,
} from '@/features/dashboards/store/dashboardStore'
import { useRef } from 'react'

type TabView = 'explore' | 'my' | 'saved'

export default function DashboardsPage() {
  useTranslation()
  const [currentTab, setCurrentTab] = useState<TabView>('explore')
  const [myDashboards, setMyDashboards] = useState<DashboardDoc[]>([])
  const [savedDashboards, setSavedDashboards] = useState<DashboardDoc[]>([])
  const [activeDashboard, setActiveDashboard] = useState<DashboardDoc | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const activeIdRef = useRef<string | null>(null)

  const loadDashboards = () => {
    setMyDashboards(getMyDashboards())
    setSavedDashboards(getSavedDashboards())
  }

  useEffect(() => {
    loadDashboards()
    
    // Auto-select first saved dashboard if exists
    const saved = getSavedDashboards()
    if (saved.length > 0) {
      setActiveDashboard(saved[0])
    }

    const handler = () => {
      loadDashboards()
      // Update active dashboard if it was modified
      if (activeDashboard) {
        const updated = getSavedDashboards().find(d => d.id === activeDashboard.id)
        if (updated) {
          setActiveDashboard(updated)
        }
      }
    }
    window.addEventListener(DASHBOARD_UPDATED_EVENT, handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener(DASHBOARD_UPDATED_EVENT, handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

  useEffect(() => {
    activeIdRef.current = activeDashboard?.id ?? null
  }, [activeDashboard?.id])

  const handleCreateDashboard = () => {
    const newDash = createNewDashboard()
    setActiveDashboard(newDash)
    setCurrentTab('saved') // Switch to "Saved Dashboards" tab
    loadDashboards()
  }

  const displayDashboards = currentTab === 'explore' ? [] : currentTab === 'my' ? myDashboards : savedDashboards

  return (
    <div className="flex h-screen w-screen bg-[#0a0e14] text-white overflow-hidden">
      {/* Left Sidebar */}
      <div
        className={`flex-none bg-[#0d1117] border-r border-[#30363d] transition-all duration-300 ${
          sidebarCollapsed ? 'w-0' : 'w-72'
        } flex flex-col overflow-hidden`}
      >
        {/* Sidebar Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex items-center gap-2 text-white hover:text-primary transition-colors"
          >
            <Grid3x3 className="w-5 h-5" />
            <span className="text-sm font-medium">我的看板</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Dashboard List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {savedDashboards.map((dash) => (
            <button
              key={dash.id}
              onClick={() => setActiveDashboard(dash)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                activeDashboard?.id === dash.id
                  ? 'bg-[#21262d] text-white border border-primary/30'
                  : 'text-[#8b949e] hover:bg-[#161b22] hover:text-white'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="truncate">{dash.name}</span>
                <Edit2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />
              </div>
            </button>
          ))}
        </div>

        {/* Saved Dashboards Section */}
        <div className="border-t border-[#30363d]">
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="w-full flex items-center justify-between p-4 text-[#8b949e] hover:text-white transition-colors text-sm"
          >
            <div className="flex items-center gap-2">
              <Bookmark className="w-4 h-4" />
              <span>已保存的看板</span>
            </div>
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* Create Dashboard Button */}
        <div className="p-3 border-t border-[#30363d]">
          <button
            onClick={handleCreateDashboard}
            className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            CREATE DASHBOARD +
          </button>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#30363d] text-xs text-[#8b949e] text-center">
          ARKHAM INTELLIGENCE - © 2026
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navigation Tabs */}
        <div className="flex-none bg-[#0d1117] border-b border-[#30363d] px-8 py-4">
          <div className="flex items-center gap-8">
            <button
              onClick={() => setCurrentTab('explore')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'explore'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              Explore Dashboards
            </button>
            <button
              onClick={() => setCurrentTab('my')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'my'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <Grid3x3 className="w-4 h-4" />
              My Dashboards
            </button>
            <button
              onClick={() => setCurrentTab('saved')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                currentTab === 'saved'
                  ? 'text-white border-b-2 border-primary'
                  : 'text-[#8b949e] hover:text-white'
              }`}
            >
              <Bookmark className="w-4 h-4" />
              Saved Dashboards
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {currentTab === 'explore' ? (
            <ExploreDashboards />
          ) : displayDashboards.length === 0 ? (
            <div className="text-center text-[#8b949e] py-20">
              <Grid3x3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h2 className="text-xl font-medium mb-2">还没有看板</h2>
              <button
                onClick={handleCreateDashboard}
                className="mt-4 bg-primary hover:bg-primary/90 text-white px-6 py-2 rounded-lg transition-colors"
              >
                创建第一个看板
              </button>
            </div>
          ) : activeDashboard ? (
            <div>
              <DashboardCanvas dashboardId={activeDashboard.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
