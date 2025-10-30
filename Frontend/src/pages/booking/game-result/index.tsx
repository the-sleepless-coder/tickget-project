import Viewport from "../_components/Viewport";
import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

export default function BookingGameResultPage() {
  return (
    <Viewport>
      <div className="mx-auto max-w-[960px] p-4">
        <div className="rounded-md bg-[#2f56a5] text-white px-4 py-2 text-center font-semibold">
          2분 뒤 자동으로 로비로 돌아갑니다.
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <Card title="예매 버튼 클릭">
            <Row label="반응 속도" value="00:02.56" />
            <Row label="클릭 실수" value="3회" />
          </Card>
          <Card title="보안 문자">
            <Row label="소요 시간" value="00:23.01" />
            <Row label="틀린 횟수" value="3회" />
          </Card>
          <Card title="좌석 선정">
            <Row label="소요 시간" value="01:03.21" />
            <Row label="클릭 실수" value="3회" />
            <Row label="이선좌" value="2회" />
          </Card>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            to={paths.mypage.reservations}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[#2f56a5] border border-[#2f56a5]"
          >
            예매 확인
          </Link>
          <Link
            to={paths.home}
            className="inline-flex items-center gap-2 rounded-md bg-[#2f56a5] px-4 py-2 text-white"
          >
            로비로
          </Link>
        </div>
      </div>
    </Viewport>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-md border bg-white">
      <div className="rounded-t-md border-b bg-[#eef2ff] px-3 py-2 font-semibold text-[#2f56a5]">
        {title}
      </div>
      <div className="p-4 space-y-2 text-gray-800">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span>{label} :</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}
