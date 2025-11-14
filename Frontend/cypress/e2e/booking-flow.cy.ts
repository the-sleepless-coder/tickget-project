describe("예매 플로우 E2E 테스트", () => {
  beforeEach(() => {
    // 테스트 실행 전 초기화
    cy.visit("/");
  });

  it("방 생성 후 예매하기 버튼 클릭까지 테스트", () => {
    // 로그인 상태 확인 및 로그아웃 처리
    cy.get("body").then(($body) => {
      // 로그아웃 버튼이 있으면 로그인된 상태
      const logoutButton = $body
        .find("button")
        .filter((i, el) => el.textContent?.includes("로그아웃"));
      if (logoutButton.length > 0) {
        cy.contains("button", "로그아웃").click();
        cy.wait(1000); // 로그아웃 처리 대기
      }
    });

    // 헤더의 로그인 버튼 클릭
    cy.contains("a", "로그인", { timeout: 5000 }).should("be.visible").click();

    // 로그인 페이지로 이동 확인
    cy.url().should("include", "/auth/login");

    // 오른쪽 위 관리자 계정 버튼 클릭
    cy.contains("button", "관리자 계정", { timeout: 10000 })
      .should("be.visible")
      .click();

    // 관리자 계정 선택 모달에서 '재원' 클릭
    cy.contains("button", "재원", { timeout: 5000 })
      .should("be.visible")
      .click();

    // 로그인 완료 후 홈으로 이동 대기
    cy.url({ timeout: 15000 }).should("eq", Cypress.config().baseUrl + "/");
    cy.wait(1500); // 로그인 완료 대기

    // 현재 시간에서 2분 뒤 계산
    const now = new Date();
    const twoMinutesLater = new Date(now.getTime() + 2 * 60 * 1000);
    const hours = String(twoMinutesLater.getHours()).padStart(2, "0");
    const minutes = String(twoMinutesLater.getMinutes()).padStart(2, "0");
    const timeString = `${hours}:${minutes}`;

    // 홈 페이지에서 방 만들기 버튼 클릭
    cy.contains("+ 방 만들기").click();

    // Step 1: 기본 정보 입력
    // 제목 입력
    cy.get('input[placeholder="방 제목을 입력해주세요"]')
      .clear()
      .type("테스트");

    // 모드: 대결 선택 (이미 기본값이므로 필요시 클릭)
    cy.contains("button", "대결").should("be.visible");

    // 인원수: 10명 입력
    cy.get('input[placeholder="참가 인원"]').clear().type("10");

    // 시간 선택: 현재 시간 + 2분
    // MUI TimePicker input 필드 찾기 (input 태그 중에서 시간 형식이 있는 것)
    cy.get(".MuiInputBase-input, input[type='text']")
      .filter((index, el) => {
        const input = el as HTMLInputElement;
        // 시간 형식(HH:mm)을 포함하거나 빈 값인 input 찾기
        return (
          input.value === "" ||
          /^\d{1,2}:\d{2}$/.test(input.value) ||
          input.getAttribute("aria-label")?.includes("시간") ||
          input.parentElement?.parentElement?.textContent?.includes("경기 시작")
        );
      })
      .first()
      .click({ force: true });

    // TimePicker가 열리면 시간 입력
    cy.get("body").then(($body) => {
      // MUI TimePicker가 열렸을 때 (MuiPickersPopper-root 또는 role="dialog")
      const timePickerOpen =
        $body.find('[role="dialog"]').length > 0 ||
        $body.find(".MuiPickersPopper-root").length > 0 ||
        $body
          .find(".MuiPaper-root")
          .filter(
            (i, el) =>
              el.textContent?.includes("시간") ||
              el.textContent?.includes("시") ||
              el.textContent?.includes("분")
          ).length > 0;

      if (timePickerOpen) {
        // TimePicker 다이얼로그 내에서 시간 입력
        cy.get('[role="dialog"], .MuiPickersPopper-root')
          .first()
          .within(() => {
            // 시(hour) 선택
            cy.get('input[type="text"], .MuiInputBase-input')
              .first()
              .clear({ force: true })
              .type(hours, { force: true });

            // 분(minute) 선택
            cy.get('input[type="text"], .MuiInputBase-input')
              .eq(1)
              .clear({ force: true })
              .type(minutes, { force: true });
          });

        // 다이얼로그 외부 클릭하여 닫기 (또는 확인 버튼 클릭)
        cy.get("body").click(0, 0, { force: true });
      } else {
        // TimePicker가 열리지 않은 경우 직접 입력 시도
        cy.get(".MuiInputBase-input")
          .filter((index, el) => {
            const input = el as HTMLInputElement;
            return input.value === "" || /^\d{1,2}:\d{2}$/.test(input.value);
          })
          .first()
          .clear({ force: true })
          .type(timeString, { force: true });
      }
    });

    // 플랫폼: 익스터파크 선택
    cy.contains("button", "익스터파크").click();

    // 다음으로 버튼 클릭
    cy.contains("button", "다음으로").click();

    // Step 2: 고급 설정
    // 공연장은 이미 기본값이 설정되어 있을 수 있음
    // 봇 인원수 선택 (필수 필드) - select 요소
    cy.contains("봇 인원수").parent().find("select").select("100");

    // 방만들기 버튼이 활성화될 때까지 대기
    cy.contains("button", "방만들기").should("not.be.disabled").click();

    // 방 생성 후 예매 페이지로 이동
    // URL이 /i-ticket/:roomId 형식으로 변경되는지 확인
    cy.url().should("include", "/i-ticket/");

    // roomId 저장 (나중에 방 나가기에 사용)
    cy.url().then((url) => {
      const roomIdMatch = url.match(/\/i-ticket\/(\d+)/);
      if (roomIdMatch && roomIdMatch[1]) {
        cy.wrap(roomIdMatch[1]).as("roomId");
      }
    });

    // 예매하기 버튼이 나타날 때까지 대기
    // 버튼이 카운트다운 후 활성화되므로 대기 필요
    cy.get("[data-reserve-button]", { timeout: 180000 }).should("be.visible");

    // 예매하기 버튼이 활성화될 때까지 대기 (disabled 속성 제거 대기)
    cy.get("[data-reserve-button]")
      .should("not.have.attr", "disabled")
      .should("be.visible");

    // window.open을 스텁하여 새 창 대신 현재 창에서 이동하도록 설정
    cy.window().then((win) => {
      cy.stub(win, "open").callsFake((url) => {
        // 새 창을 열지 않고 현재 창에서 이동
        win.location.href = url as string;
        // window.open의 반환값을 시뮬레이션 (null 반환)
        return null;
      });
    });

    // "BOOKING / 外國語" 버튼 클릭
    cy.contains("button", "BOOKING / 外國語", { timeout: 5000 })
      .should("be.visible")
      .click();

    // 버튼 클릭 후 잠시 대기
    cy.wait(2000);

    // 오류가 발생할 수 있으므로 방 나가기 버튼 클릭
    // roomId를 사용하여 예매 페이지로 이동 후 방 나가기
    cy.get("@roomId").then((roomId) => {
      // roomId로 예매 페이지로 이동
      cy.visit(`/i-ticket/${roomId}`, { timeout: 10000 });

      // 방 나가기 버튼 클릭
      cy.contains("button", "방 나가기", { timeout: 10000 })
        .should("be.visible")
        .click();

      // 방 나가기 후 홈으로 이동 확인
      cy.url({ timeout: 10000 }).should("eq", Cypress.config().baseUrl + "/");
    });
  });
});
