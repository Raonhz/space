import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Orbital Lofi Station — 실시간 ISS 궤도 카메라 & 로파이 비트",
  description: "NASA 실시간 ISS 외부 카메라 피드와 텔레메트리 현황을 감상하세요. 차분한 로파이 음악과 함께 궤도 여행을 떠나보세요.",
  openGraph: {
    title: "Orbital Lofi Station — 실시간 ISS 궤도 카메라 & 로파이 비트",
    description: "NASA 실시간 ISS 외부 카메라 피드와 텔레메트리 현황을 감상하세요. 차분한 로파이 음악과 함께 궤도 여행을 떠나보세요.",
  },
  twitter: {
    title: "Orbital Lofi Station — 실시간 ISS 궤도 카메라 & 로파이 비트",
    description: "NASA 실시간 우주 카메라 스트림과 로파이 음악.",
  }
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
