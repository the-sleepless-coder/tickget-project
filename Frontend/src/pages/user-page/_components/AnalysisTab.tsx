import { useState, useEffect } from "react";
import { getUserReportLLM, getMatchHistory } from "@features/user-page/api";
import AnalysisLoader from "./AnalysisLoader";

export default function AnalysisTab() {
  const [analysisText, setAnalysisText] = useState<string>("");
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [multiMatchCount, setMultiMatchCount] = useState<number>(0);

  // 마크다운 텍스트를 파싱하여 렌더링 가능한 요소로 변환
  const parseAnalysisText = (text: string) => {
    if (!text) return [];

    // ### 제목으로 섹션 분리
    const sections = text.split(/(?=### )/g);
    const parsed: Array<{ type: "heading" | "content"; text: string }> = [];

    sections.forEach((section) => {
      const trimmed = section.trim();
      if (!trimmed) return;

      if (trimmed.startsWith("### ")) {
        // 제목 추출 (줄바꿈 또는 끝까지)
        const headingMatch = trimmed.match(/^### (.+?)(?:\n|$)/);
        if (headingMatch) {
          parsed.push({
            type: "heading",
            text: headingMatch[1].trim(),
          });
        }

        // 제목 다음 내용 추출
        const contentMatch = trimmed.match(/^### .+?\n(.*)/s);
        if (contentMatch && contentMatch[1].trim()) {
          parsed.push({
            type: "content",
            text: contentMatch[1].trim(),
          });
        }
      } else {
        // 제목 없는 내용 (첫 부분에만 있을 수 있음)
        parsed.push({
          type: "content",
          text: trimmed,
        });
      }
    });

    return parsed;
  };

  // multi 모드 경기 기록 개수 확인
  useEffect(() => {
    const checkMultiMatchCount = async () => {
      try {
        const matchData = await getMatchHistory("multi", 0);
        setMultiMatchCount(matchData.length);
      } catch (error) {
        console.error("경기 기록 조회 실패:", error);
        setMultiMatchCount(0);
      }
    };
    checkMultiMatchCount();
  }, []);

  // AI 분석 데이터 가져오기
  const fetchAnalysis = async () => {
    if (multiMatchCount < 5) {
      return;
    }
    setIsLoadingAnalysis(true);
    try {
      const data = await getUserReportLLM();
      const text = data.text;
      setAnalysisText(text);
      // 로컬 스토리지에 저장
      localStorage.setItem("ai_user_report", text);
    } catch (error) {
      console.error("AI 분석 불러오기 실패:", error);
      setAnalysisText("");
    } finally {
      setIsLoadingAnalysis(false);
    }
  };

  // 초기 로드 - 로컬 스토리지에서 불러오기
  useEffect(() => {
    const storedReport = localStorage.getItem("ai_user_report");
    if (storedReport) {
      setAnalysisText(storedReport);
    }
  }, []);

  const isDisabled = multiMatchCount < 5;

  return (
    <div className="space-y-4">
      {/* 새로 분석받기 버튼 */}
      <div className="flex justify-end">
        <div className="relative">
          <button
            onClick={fetchAnalysis}
            disabled={isLoadingAnalysis}
            onMouseEnter={() => isDisabled && setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            className={`rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-colors ${
              isDisabled
                ? "cursor-pointer bg-white text-neutral-400 hover:bg-neutral-50"
                : "cursor-pointer bg-white text-c-purple-250 hover:bg-neutral-50"
            }`}
          >
            새로 분석받기
          </button>
          {isDisabled && showTooltip && (
            <div className="absolute right-0 bottom-full z-10 mb-2 w-64 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-600 shadow-lg text-center">
              경기기록이 5개 이상이어야 합니다.
            </div>
          )}
        </div>
      </div>

      {/* 분석 내용 */}
      {isLoadingAnalysis ? (
        <AnalysisLoader />
      ) : isDisabled || !analysisText ? (
        <div className="flex items-center justify-center rounded-lg bg-white p-8">
          <div className="text-neutral-400">분석 데이터가 없습니다.</div>
        </div>
      ) : (
        <div className="space-y-4">
          {parseAnalysisText(analysisText).map((item, index) => {
            if (item.type === "heading") {
              return (
                <h3
                  key={index}
                  className="text-lg font-semibold text-c-purple-250"
                >
                  {item.text}
                </h3>
              );
            } else {
              // 줄바꿈 처리
              const lines = item.text.split("\n");
              return (
                <div key={index} className="rounded-lg bg-white p-6 shadow-sm">
                  {lines.map((line, lineIndex) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) {
                      return <div key={lineIndex} className="mb-2"></div>;
                    }

                    // 리스트 항목 처리 (숫자나 불릿)
                    if (
                      trimmedLine.match(/^\d+\.\s/) ||
                      trimmedLine.match(/^[-*]\s/)
                    ) {
                      // 볼드 텍스트 처리 (**텍스트**)
                      const processedText = trimmedLine
                        .replace(/^[-*\d.]+\s/, "")
                        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
                      return (
                        <div
                          key={lineIndex}
                          className="mb-2 ml-4"
                          dangerouslySetInnerHTML={{
                            __html: processedText,
                          }}
                        />
                      );
                    }

                    // 볼드 텍스트가 포함된 일반 텍스트
                    if (trimmedLine.includes("**")) {
                      const processedText = trimmedLine.replace(
                        /\*\*(.+?)\*\*/g,
                        "<strong>$1</strong>"
                      );
                      return (
                        <p
                          key={lineIndex}
                          className="mb-2 text-neutral-700 last:mb-0"
                          dangerouslySetInnerHTML={{
                            __html: processedText,
                          }}
                        />
                      );
                    }

                    // 일반 텍스트
                    return (
                      <p
                        key={lineIndex}
                        className="mb-2 whitespace-pre-wrap text-neutral-700 last:mb-0"
                      >
                        {trimmedLine}
                      </p>
                    );
                  })}
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}
