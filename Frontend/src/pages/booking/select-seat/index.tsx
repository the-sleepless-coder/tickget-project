import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { paths } from "../../../app/routes/paths";
import {
  saveInitialReaction,
  setCaptchaEndNow,
  getCaptchaEndMs,
  recordSeatCompleteNow,
} from "../../../shared/utils/reserveMetrics";
import Viewport from "../_components/Viewport";
import CaptchaModal from "../_components/CaptchaModal";

type GradeKey = "SR" | "R" | "S";
type SelectedSeat = {
  id: string;
  grade: GradeKey;
  label: string;
  price: number;
};

const GRADE_META: Record<
  GradeKey,
  { name: string; color: string; price: number }
> = {
  SR: { name: "SR석", color: "#6f53e3", price: 143000 },
  R: { name: "R석", color: "#3da14b", price: 132000 },
  S: { name: "S석", color: "#59b3ea", price: 110000 },
};

type Block = { id: number; code: string; tier: GradeKey };

const BLOCKS: Block[] = [
  { id: 1, code: "001", tier: "R" },
  { id: 2, code: "002", tier: "SR" },
  { id: 3, code: "003", tier: "SR" },
  { id: 4, code: "004", tier: "SR" },
  { id: 5, code: "005", tier: "R" },
  { id: 6, code: "006", tier: "S" },
  { id: 7, code: "007", tier: "R" },
  { id: 8, code: "008", tier: "R" },
  { id: 9, code: "009", tier: "R" },
  { id: 10, code: "010", tier: "S" },
];

export default function SelectSeatPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selected, setSelected] = useState<SelectedSeat[]>([]);
  const eventTitle = "방 이름 입력";
  const [activeBlock, setActiveBlock] = useState<Block | null>(null);
  const [showCaptcha, setShowCaptcha] = useState<boolean>(true);
  const [captchaSec, setCaptchaSec] = useState<number | null>(null);
  const [captchaBackspaces, setCaptchaBackspaces] = useState<number>(0);
  const [captchaWrongAttempts, setCaptchaWrongAttempts] = useState<number>(0);
  const [captchaEndAtMs, setCaptchaEndAtMs] = useState<number | null>(null);
  const [seatCompleteAtMs, setSeatCompleteAtMs] = useState<number | null>(null);

  const totalPrice = useMemo(
    () => selected.reduce((sum, s) => sum + s.price, 0),
    [selected]
  );

  const openBlock = (block: Block) => setActiveBlock(block);

  const selectSeatCell = (block: Block, row: number, col: number) => {
    const seatId = `${block.code}-${row}-${col}`;
    // 이미 선택된 좌석이면 해제, 아니면 추가 (토글)
    if (selected.some((s) => s.id === seatId)) {
      setSelected((prev) => prev.filter((s) => s.id !== seatId));
      return;
    }
    const seat: SelectedSeat = {
      id: seatId,
      grade: block.tier,
      label: `${block.code} / ${row}열-${col}번`,
      price: GRADE_META[block.tier].price,
    };
    setSelected((prev) => [...prev, seat]);
  };

  const clearSelection = () => setSelected([]);
  const goPrev = () => navigate(paths.booking.selectSchedule);
  const complete = () => {
    const now = Date.now();
    setSeatCompleteAtMs(now);
    const durationSec = recordSeatCompleteNow();
    console.log("[ReserveTiming] Seat complete", {
      durationFromCaptchaSec: durationSec,
      captchaBackspaces,
      captchaWrongAttempts,
    });
    sessionStorage.setItem("reserve.capBackspaces", String(captchaBackspaces));
    sessionStorage.setItem("reserve.capWrong", String(captchaWrongAttempts));
    const nextUrl = new URL(window.location.origin + paths.booking.price);
    if (durationSec != null)
      nextUrl.searchParams.set("capToCompleteSec", String(durationSec));
    nextUrl.searchParams.set("capBackspaces", String(captchaBackspaces));
    nextUrl.searchParams.set("capWrong", String(captchaWrongAttempts));
    const rt =
      searchParams.get("rtSec") ?? sessionStorage.getItem("reserve.rtSec");
    const nrc =
      searchParams.get("nrClicks") ??
      sessionStorage.getItem("reserve.nrClicks");
    if (rt) nextUrl.searchParams.set("rtSec", rt);
    if (nrc) nextUrl.searchParams.set("nrClicks", nrc);
    const cap = sessionStorage.getItem("reserve.captchaDurationSec");
    if (cap) nextUrl.searchParams.set("captchaSec", cap);
    navigate(nextUrl.pathname + nextUrl.search);
  };

  useEffect(() => {
    const rtSec = searchParams.get("rtSec");
    const nrClicks = searchParams.get("nrClicks");
    console.log("[ReserveTiming] Captcha input stage", {
      reactionSec: rtSec ? Number(rtSec) : null,
      nonReserveClickCount: nrClicks ? Number(nrClicks) : null,
    });
    saveInitialReaction(rtSec, nrClicks);
    // load persisted captcha end timestamp if exists
    const end = getCaptchaEndMs();
    if (end != null) setCaptchaEndAtMs(end);
  }, [searchParams]);

  return (
    <Viewport>
      <CaptchaModal
        open={showCaptcha}
        onVerify={(durationMs, { backspaceCount, wrongAttempts }) => {
          const sec = Math.round(durationMs) / 1000;
          setCaptchaSec(sec);
          setCaptchaBackspaces(backspaceCount);
          setCaptchaWrongAttempts(wrongAttempts);
          const endMs = setCaptchaEndNow(sec, backspaceCount, wrongAttempts);
          setCaptchaEndAtMs(endMs);
          console.log("[ReserveTiming] Captcha verified", {
            captchaSec: sec,
            backspaceCount,
            wrongAttempts,
          });
          setShowCaptcha(false);
        }}
        onReselect={goPrev}
      />
      {/* 상단: 좌석 선택 헤더 (스샷 유사 스타일) */}
      <div className="bg-[linear-gradient(to_bottom,#f2f2f2,#dbdbdb)] border-b border-[#bdbdbd]">
        <div className="max-w-5xl mx-auto px-2 py-2 flex items-center gap-3">
          <div className="flex items-center bg-[#b02a2a] text-white rounded-none border border-[#8f1c1c] px-3 h-7 shadow-inner">
            <span className="bg-[#ffcc33] text-[#222] font-extrabold text-[11px] rounded-full w-6 h-6 flex items-center justify-center mr-2">
              02
            </span>
            <span className="text-sm font-bold">좌석 선택</span>
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-[#222]">
              {eventTitle}
            </div>
            <div className="flex items-center gap-2 text-[12px] text-[#555] mt-1">
              <span>› 다른 관람일자 선택 :</span>
              <label htmlFor="dateSel" className="sr-only">
                일자
              </label>
              <select
                id="dateSel"
                className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
              >
                <option>2025년 12월 20일(토)</option>
              </select>
              <span>시간</span>
              <label htmlFor="timeSel" className="sr-only">
                시간
              </label>
              <select
                id="timeSel"
                className="border border-[#cfcfcf] rounded px-1 py-0.5 bg-white"
              >
                <option>18시 00분</option>
              </select>
            </div>
          </div>
          <div>
            <button className="text-[11px] bg-[#f5f5f5] border border-[#cfcfcf] rounded px-2 py-1 text-[#777]">
              예매대기
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[920px] mx-auto p-3 flex gap-3">
        {/* 좌측: 좌석도 */}
        <div className="flex-1 bg-white rounded-md shadow p-3 border border-[#e3e3e3]">
          <div className="text-[12px] text-gray-600 border rounded px-3 py-2 bg-[#fafafa]">
            {activeBlock
              ? `${activeBlock.code} 영역의 좌석배치도입니다`
              : "원하시는 영역을 선택해주세요. 공연장에서 위치를 클릭하거나, 오른쪽의 좌석을 선택해 주세요."}
          </div>

          <div className="mt-3 grid grid-cols-[120px_1fr] gap-3">
            {/* 왼쪽 안내 */}
            <div className="space-y-2 text-[12px] text-gray-700">
              <div className="border p-2">
                <div className="font-semibold mb-1">구역이미지</div>
                <div className="h-16 bg-[repeating-linear-gradient(90deg,#9aa7,0, #9aa7 6px, #fff 6px, #fff 10px)]" />
              </div>
              <div className="bg-[#fff3f3] border border-[#e5bcbc] p-2 leading-5">
                구역내 상단이 무대와 가까운 쪽입니다.
                <div className="text-[11px] text-gray-600">
                  The upper end of the section is the closest area to the stage.
                </div>
              </div>
              <div className="bg-[#5c2121] text-white text-[12px] p-2 rounded">
                ※ 가로로(한줄로 나란히) 예매해 주세요.
              </div>
            </div>

            {/* 좌석 블록 or 상세 좌석배치 */}
            {!activeBlock ? (
              <div>
                <div className="mx-auto w-64 h-5 bg-[#d8d8d8] rounded-sm text-center text-gray-700 text-sm font-extrabold tracking-wider">
                  STAGE
                </div>
                <div className="mt-3 flex items-start justify-center gap-2">
                  <SeatBlock
                    block={BLOCKS[0]}
                    onSelect={openBlock}
                    size="narrow"
                  />
                  <SeatBlock
                    block={BLOCKS[1]}
                    onSelect={openBlock}
                    size="wide"
                    labelTop={2}
                  />
                  <SeatBlock
                    block={BLOCKS[2]}
                    onSelect={openBlock}
                    size="wide"
                    labelTop={3}
                  />
                  <SeatBlock
                    block={BLOCKS[3]}
                    onSelect={openBlock}
                    size="wide"
                    cutRight
                    labelTop={4}
                  />
                  <SeatBlock
                    block={BLOCKS[4]}
                    onSelect={openBlock}
                    size="narrow"
                  />
                </div>
                <div className="mt-3 flex items-end justify-center gap-2">
                  <SeatBlock
                    block={BLOCKS[5]}
                    onSelect={openBlock}
                    size="narrow"
                  />
                  <SeatBlock
                    block={BLOCKS[6]}
                    onSelect={openBlock}
                    size="wide"
                  />
                  <SeatBlock
                    block={BLOCKS[7]}
                    onSelect={openBlock}
                    size="wide"
                    bandBlue
                  />
                  <SeatBlock
                    block={BLOCKS[8]}
                    onSelect={openBlock}
                    size="wide"
                    bandBlue={false}
                  />
                  <SeatBlock
                    block={BLOCKS[9]}
                    onSelect={openBlock}
                    size="narrow"
                    bandBlue
                  />
                </div>
                <div className="mt-3 mx-auto w-40 h-5 bg-[#d8d8d8] rounded-sm text-center text-gray-700 text-sm font-extrabold tracking-wider">
                  CONSOLE
                </div>
              </div>
            ) : (
              <SeatGrid
                block={activeBlock}
                onBack={() => setActiveBlock(null)}
                onSelectSeat={selectSeatCell}
              />
            )}
          </div>
        </div>

        {/* 우측: 사이드 정보 */}
        <aside className="w-80 space-y-3">
          <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
            <div
              className="px-3 py-2 bg-[#b02a2a] text-white font-bold rounded-t-md flex items-center justify-between cursor-pointer"
              onClick={() => setActiveBlock(null)}
            >
              <span>좌석도 전체보기</span>
              <span>▶</span>
            </div>
            <div className="p-2 text-sm">
              <div className="font-semibold mb-2">좌석등급 / 잔여석</div>
              <ul className="space-y-1">
                {/** 데모이므로 잔여석 수치는 임의 표기 */}
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.SR.color }}
                    />{" "}
                    SR석 1,820석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.SR.price.toLocaleString()}원
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.R.color }}
                    />{" "}
                    R석 752석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.R.price.toLocaleString()}원
                  </div>
                </li>
                <li className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-3 h-3 rounded-sm"
                      style={{ background: GRADE_META.S.color }}
                    />{" "}
                    S석 436석
                  </div>
                  <div className="text-gray-700">
                    {GRADE_META.S.price.toLocaleString()}원
                  </div>
                </li>
              </ul>
            </div>
          </div>

          <div className="bg-white rounded-md border border-[#e3e3e3] shadow">
            <div className="px-3 py-2 text-[#b02a2a] text-right text-sm border-b">
              총 {selected.length}석 선택되었습니다.
            </div>
            <div className="p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-normal w-24 whitespace-nowrap">
                      좌석등급
                    </th>
                    <th className="text-left font-normal whitespace-nowrap">
                      좌석번호
                    </th>
                    <th className="text-right font-normal w-16 whitespace-nowrap">
                      삭제
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {selected.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="text-center text-gray-400 py-8"
                      >
                        선택된 좌석이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    selected.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2 whitespace-nowrap">
                          {GRADE_META[s.grade].name}
                        </td>
                        <td className="whitespace-nowrap">{s.label}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={() =>
                              setSelected((prev) =>
                                prev.filter((x) => x.id !== s.id)
                              )
                            }
                            className="inline-flex items-center justify-center w-7 h-7 rounded border border-[#e0e0e0] text-gray-500 hover:bg-[#f6f6f6]"
                            aria-label={`remove-${s.id}`}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <button
                disabled={selected.length === 0}
                onClick={complete}
                className="mt-3 w-full py-3 rounded font-bold bg-[#c62828] text-white hover:bg-[#b71c1c] disabled:hover:bg-[#c62828] disabled:cursor-not-allowed"
              >
                좌석선택완료 ▸
              </button>
              <div className="mt-2 flex items-center gap-2 text-sm">
                <button
                  onClick={goPrev}
                  className="flex-1 border rounded px-2 py-2 bg-[#f4f4f4] hover:bg-[#ececec]"
                >
                  이전단계
                </button>
                <button
                  onClick={clearSelection}
                  className="flex-1 border rounded px-2 py-2 bg-[#f4f4f4] hover:bg-[#ececec]"
                >
                  좌석 다시 선택
                </button>
              </div>
              <div className="mt-2 text-[12px] text-[#b02a2a]">
                ※ 좌석 선택시 유의사항
              </div>
            </div>
            <div className="px-3 py-2 text-right text-sm border-t bg-[#fafafa]">
              합계:{" "}
              <span className="font-semibold">
                {totalPrice.toLocaleString()}원
              </span>
            </div>
          </div>
        </aside>
      </div>
    </Viewport>
  );
}

function SeatBlock({
  block,
  onSelect,
  size = "wide",
  cutRight = false,
  bandBlue = false,
  labelTop,
}: {
  block: Block;
  onSelect: (b: Block) => void;
  size?: "narrow" | "wide";
  cutRight?: boolean; // 우측 모서리 컷 형태
  bandBlue?: boolean; // 하단 파란 밴드
  labelTop?: number; // 블록 상단 중앙의 숫자
}) {
  const { tier } = block;
  const bg = GRADE_META[tier].color;
  // 블록 크기 축소
  const widthClass = size === "narrow" ? "w-7" : "w-28";
  const heightClass = size === "narrow" ? "h-20" : "h-24";
  const bandHeightClass = size === "narrow" ? "h-2.5" : "h-3.5";
  const labelSizeClass = size === "narrow" ? "text-xs" : "text-sm";

  return (
    <button
      type="button"
      onClick={() => onSelect(block)}
      className={`relative ${widthClass} ${heightClass} rounded shadow-inner border border-[#e0e0e0] overflow-hidden`}
      aria-label={`block-${block.code}`}
    >
      {/* 주 색상 영역 */}
      <div
        className={`absolute inset-0 ${cutRight ? "[clip-path:polygon(0%_0%,85%_0%,100%_15%,100%_100%,0%_100%)]" : ""}`}
        style={{ background: bg }}
      />
      {/* 하단 파란 밴드 */}
      {bandBlue && (
        <div
          className={`absolute bottom-0 left-0 right-0 ${bandHeightClass} bg-[#59b3ea]`}
        />
      )}

      {/* 좌상단 블록 번호 */}
      <div className="absolute top-1 left-1 text-white text-xs font-bold drop-shadow">
        {block.id}
      </div>
      {/* 중앙 라벨 */}
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-white">
        {labelTop && (
          <div className={`${labelSizeClass} font-bold leading-none`}>
            {labelTop}
          </div>
        )}
        <div className="text-[10px] mt-1">{block.code}</div>
      </div>
    </button>
  );
}

function SeatGrid({
  block,
  onBack,
  onSelectSeat,
}: {
  block: Block;
  onBack: () => void;
  onSelectSeat: (block: Block, row: number, col: number) => void;
}) {
  // 임의 크기: 26행 x 26열, 오른쪽 상단 컷
  const rows = 26;
  const cols = 26;
  return (
    <div className="p-3">
      <div className="mb-2 flex items-center gap-2 text-[12px]">
        <button
          onClick={onBack}
          className="border px-2 py-1 rounded bg-[#f4f4f4] hover:bg-[#ececec]"
        >
          ◀ 영역으로
        </button>
        <span className="text-[#555]">
          <b className="text-[#004ce6]">{block.code}</b> 영역의 좌석배치도입니다
        </span>
      </div>
      <div className="flex">
        {/* 좌측 열 번호 */}
        <div className="text-[10px] text-gray-600 mr-2 space-y-1">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="h-4 leading-4">
              {r + 1}열
            </div>
          ))}
        </div>
        {/* 그리드 */}
        <div className="overflow-auto border rounded bg-white p-4">
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${cols}, 16px)`,
              gridAutoRows: "16px",
              gap: "2px",
            }}
          >
            {Array.from({ length: rows * cols }).map((_, i) => {
              const r = Math.floor(i / cols) + 1;
              const c = (i % cols) + 1;
              // 오른쪽 상단 컷 형태: 특정 삼각형 영역 비우기
              if (r < 6 && c > cols - r)
                return <div key={i} className="w-4 h-4" />;
              const bg = GRADE_META[block.tier].color;
              return (
                <button
                  key={i}
                  onClick={() => onSelectSeat(block, r, c)}
                  className="w-4 h-4 border border-white"
                  style={{ background: bg }}
                  aria-label={`${r}-${c}`}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
