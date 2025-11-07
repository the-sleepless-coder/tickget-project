import Viewport from "./_components/Viewport";
import { Link, useSearchParams } from "react-router-dom";
import {
  readMetricsWithFallback,
  formatSecondsHuman,
} from "../../../../shared/utils/reserveMetrics";
import { paths } from "../../../../app/routes/paths";

export default function BookingGameResultPage() {
  const [searchParams] = useSearchParams();
  const {
    rtSec,
    nrClicks,
    captchaSec,
    capBackspaces,
    capWrong,
    capToCompleteSec,
  } = readMetricsWithFallback(searchParams);
  const totalSec = rtSec + captchaSec + (capToCompleteSec ?? 0);
  const fmtTime = formatSecondsHuman;
  return (
    <Viewport>
      <div className="mx-auto max-w-[960px] p-4">
        <div className="rounded-md bg-[#2f56a5] text-white px-4 py-2 text-center font-semibold">
          2분 뒤 자동으로 로비로 돌아갑니다.
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <Card title="예매 버튼 클릭">
            <Row label="반응 속도" value={`${rtSec.toFixed(2)} 초`} />
            <Row label="클릭 실수" value={`${nrClicks}회`} />
          </Card>
          <Card title="보안 문자">
            <Row label="소요 시간" value={`${captchaSec.toFixed(2)} 초`} />
            <Row label="백스페이스" value={`${capBackspaces}회`} />
            <Row label="틀린 횟수" value={`${capWrong}회`} />
          </Card>
          <Card title="좌석 선정">
            <Row
              label="소요 시간"
              value={`${capToCompleteSec.toFixed(2)} 초`}
            />
            <Row label="클릭 실수" value="3회" />
            <Row label="이선좌" value="2회" />
          </Card>
        </div>

        <div className="mt-3 text-right text-[#2f56a5] font-extrabold">
          총 소요시간: {fmtTime(totalSec)}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Link
            to={paths.mypage.reservations}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-[#2f56a5] border border-[#2f56a5]"
          >
            예매 확인
          </Link>
          <Link
            to={paths.rooms}
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
