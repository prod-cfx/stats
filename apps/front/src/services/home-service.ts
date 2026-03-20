import type { HomePageData } from '@/types/home'

// Mock data for a generic frontend scaffold
const MOCK_HOME_DATA: HomePageData = {
  hero: {
    title: '前台应用脚手架',
    subtitle: '这是一个最小可用的前台应用示例，包含首页展示与登录/注册流程，可在此基础上快速搭建你的业务。',
    primaryAction: {
      label: '开始使用',
      href: '/register',
    },
    secondaryAction: {
      label: '查看控制台示例',
      href: '/dashboard',
    },
    bgGradientStart: '#396bff',
    bgGradientEnd: '#8b5cff',
  },
  whyCoinflux: {
    title: '为什么使用这个脚手架？',
    subtitle: '预置好认证、布局、UI 体系，让你专注在业务本身',
    items: [
      {
        title: '开发新项目常见痛点',
        icon: '/images/icon-user.svg',
        painPointsTitle: '从零起步的痛点',
        painPoints: [
          '每次新项目都要从头搭建登录、路由、UI 组件；',
          '环境配置、代码规范、构建脚本容易混乱；',
          '缺少一套可复用的前后端约定与接口结构。',
        ],
        solutionTitle: '脚手架能带来的改变',
        solutions: [
          '统一的登录/注册流程示例；',
          '预配置好的代码规范与构建脚本；',
          '示例 API 调用与错误处理模式，便于扩展。',
        ],
      },
      {
        title: '多人协作的痛点',
        icon: '/images/icon-developer.svg',
        painPointsTitle: '团队协作的挑战',
        painPoints: [
          '不同成员习惯不同，目录结构容易失控；',
          '缺乏统一的组件和布局约定；',
          '环境变量、接口地址在多人环境下难以管理。',
        ],
        solutionTitle: '脚手架提供统一约定',
        solutions: [
          '统一的目录结构和路由组织方式；',
          '基础布局和主题样式可直接复用；',
          '通过配置文件集中管理环境变量和运行参数。',
        ],
      },
    ],
  },
  features: {
    title: '脚手架的核心特性',
    subtitle: '围绕「快速起步」「易于扩展」「约定优于配置」设计',
    items: [
      {
        title: '预置认证流程',
        description: '内置邮箱登录/注册和基础会话管理示例，可直接接入后端 API 或替换为自有实现。',
        icon: '/images/feature-icon-1.png',
        iconColor: 'bg-[#396bff]/10 text-[#396bff]',
      },
      {
        title: '现代化 UI 布局',
        description: '基于 TailwindCSS 和 React 组件，提供响应式布局和常用页面结构，方便直接复用。',
        icon: '/images/feature-icon-2.png',
        iconColor: 'bg-[#8b5cff]/10 text-[#8b5cff]',
      },
      {
        title: '清晰的代码组织',
        description: '按 app/components/hooks/services 等分层组织代码，更利于长期维护和重构。',
        icon: '/images/feature-icon-3.png',
        iconColor: 'bg-[#00d084]/10 text-[#00d084]',
      },
      {
        title: '方便对接后端',
        description: '预置调用后端的 API 封装和错误处理模式，可无缝接入 NestJS 等服务端框架。',
        icon: '/images/feature-icon-4.png',
        iconColor: 'bg-[#60a5fa]/10 text-[#60a5fa]',
      },
    ],
  },
  roadmap: {
    title: '如何基于脚手架演进项目？',
    subtitle: '可以根据团队节奏逐步替换示例页面和服务',
    items: [
      {
        phase: 'Phase 1 - MVP',
        title: '快速搭建最小可用产品',
        items: [
          '保留现有登录/注册/首页结构；',
          '替换首页文案和品牌元素；',
          '接入你自己的后端 API。',
        ],
        color: 'text-[#396bff]',
      },
      {
        phase: 'Phase 2 - 扩展功能',
        title: '逐步接入真实业务模块',
        items: [
          '新增业务路由和页面；',
          '扩展组件库和 UI 模块；',
          '完善权限和多角色支持。',
        ],
        color: 'text-[#8b5cff]',
      },
      {
        phase: 'Phase 3 - 团队协作',
        title: '沉淀自己的工程体系',
        items: [
          '抽离通用组件和工具库；',
          '完善文档和开发规范；',
          '形成可复用的内部模板和最佳实践。',
        ],
        color: 'text-[#00d084]',
      },
    ],
  },
  cta: {
    title: '准备开始你的新项目？',
    description: '基于这个脚手架，你可以在几分钟内搭好前台和权限体系，把时间更多投入到真正的业务里。',
    primaryAction: {
      label: '创建账号',
      href: '/register',
    },
    secondaryAction: {
      label: '查看示例控制台',
      href: '/dashboard',
    },
  },
  footer: {
    productLinks: [
      { label: '控制台示例', href: '/dashboard' },
    ],
    supportLinks: [
      { label: '帮助中心', href: '/help' },
      { label: 'API文档', href: '/api-docs' },
      { label: '联系我们', href: '/contact' },
    ],
    supportedBy: [
      'Aster DEX',
      'Binance',
      'Hyperliquid',
    ],
  },
}

export async function getHomePageData(): Promise<HomePageData> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 100))
  return MOCK_HOME_DATA
}
