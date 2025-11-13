import Viewport from "./_components/Viewport";

export default function BookingLoadingPage() {
  return (
    <Viewport>
      <div className="w-full h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-8 h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-gray-500" />
          <div className="text-xl font-extrabold text-gray-900 tracking-tight">
            예매 화면을 불러오는 중입니다.
          </div>
          <div className="mt-2 text-lg text-blue-600 font-extrabold">
            조금만 기다려주세요.
          </div>
        </div>
      </div>
    </Viewport>
  );
}
