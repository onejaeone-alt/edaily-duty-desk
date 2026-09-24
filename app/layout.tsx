import './globals.css';

export const metadata = {
  title: '이데일리 당직 데스크',
  description: '통신사·타사 단독·이데일리 기출고를 한 화면에서 확인하는 당직용 뉴스 모니터'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="ko"><body>{children}</body></html>;
}
