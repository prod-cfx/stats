import { ProfileClient } from './ProfileClient';

export function generateStaticParams() {
  // 定义在构建时预渲染的地址
  // 在静态导出模式下，必须提供可能的动态参数列表
  return [
    { address: '0xb31754025d57d727218ef86b97828135899983ae' },
    { address: '0x1234567890abcdef1234567890abcdef12345678' }
  ];
}

export default function WhaleProfilePage({ params }: { params: { address: string } }) {
  return <ProfileClient address={params.address} />;
}
