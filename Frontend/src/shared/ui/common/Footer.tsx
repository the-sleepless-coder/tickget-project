export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white text-gray-600">
      <div className="mx-auto max-w-7xl px-4 py-6 text-xs">
        <div className="flex flex-col items-start gap-6 md:flex-row md:items-start md:justify-between">
          {/* 브랜드/소개 */}
          <div className="min-w-[220px] space-y-2">
            <div className="text-base font-semibold text-gray-900">Tickget</div>
            <div>Get Your Ticket!</div>
            <div>티켓팅 연습 사이트, 틱겟입니다.</div>
            <div className="flex items-center gap-2 text-[11px] text-gray-500">
              <span>© {new Date().getFullYear()} 이선좌</span>
              <span>All right reserved</span>
            </div>
          </div>

          {/* 링크/연락처 */}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <div className="text-sm font-semibold text-gray-900">
                고객지원
              </div>
              <a href="#" className="hover:text-gray-900">
                자주 묻는 질문
              </a>
              <a href="#" className="hover:text-gray-900">
                이용 가이드
              </a>
              <a href="#" className="hover:text-gray-900">
                공지사항
              </a>
              <a href="#" className="hover:text-gray-900">
                문의하기
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
              <div className="text-sm font-semibold text-gray-900">연락처</div>
              <a
                href="mailto:support@tickget.co.kr"
                className="hover:text-gray-900"
              >
                support@tickget.co.kr
              </a>
              <span>1588-0000</span>
            </div>
          </div>

          {/* 소셜 아이콘 */}
          <div className="ml-auto flex items-center gap-3">
            <a
              href="#"
              aria-label="Facebook"
              className="grid h-9 w-9 place-items-center rounded-md bg-black text-white"
            >
              f
            </a>
            <a
              href="#"
              aria-label="Twitter"
              className="grid h-9 w-9 place-items-center rounded-md bg-black text-white"
            >
              t
            </a>
            <a
              href="#"
              aria-label="Instagram"
              className="grid h-9 w-9 place-items-center rounded-md bg-black text-white"
            >
              ◎
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
