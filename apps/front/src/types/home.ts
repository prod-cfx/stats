import type { Route } from 'next'

export interface LinkItem {
  label: string
  href: Route | string
}

export interface HeroSectionData {
  title: string
  subtitle: string
  primaryAction: LinkItem
  secondaryAction: LinkItem
  bgGradientStart: string
  bgGradientEnd: string
}

export interface PainPointSolution {
  title: string
  icon?: string
  painPointsTitle: string
  painPoints: string[]
  solutionTitle: string
  solutions: string[]
}

export interface FeatureItem {
  title: string
  description: string
  icon: string // path to svg
  iconColor: string // e.g., "bg-blue-500/10 text-blue-500"
}

export interface RoadmapPhase {
  phase: string
  title: string
  items: string[]
  color: string // e.g., "text-blue-500"
}

export interface CtaSectionData {
  title: string
  description: string
  primaryAction: LinkItem
  secondaryAction: LinkItem
}

export interface FooterSectionData {
  productLinks: LinkItem[]
  supportLinks: LinkItem[]
  supportedBy: string[]
}

export interface HomePageData {
  hero: HeroSectionData
  whyCoinflux: {
    title: string
    subtitle: string
    items: PainPointSolution[]
  }
  features: {
    title: string
    subtitle: string
    items: FeatureItem[]
  }
  roadmap: {
    title: string
    subtitle: string
    items: RoadmapPhase[]
  }
  cta: CtaSectionData
  footer: FooterSectionData
}
