import { useState } from "react";
import { showAlert } from "../../shared/utils/alert";
import CustomAlert, {
  type AlertType,
} from "../../shared/ui/common/CustomAlert";
import SeatTakenAlert from "../../components/SeatTakenAlert";
import {
  Button,
  Box,
  Typography,
  Paper,
  Snackbar,
  Alert as MuiAlert,
} from "@mui/material";
import { showConfirm } from "../../shared/utils/confirm";

export default function DesignTestPage() {
  const [customAlertOpen, setCustomAlertOpen] = useState(false);
  const [customAlertType, setCustomAlertType] = useState<AlertType>("info");
  const [customAlertMessage, setCustomAlertMessage] = useState("");
  const [customAlertTitle, setCustomAlertTitle] = useState("");
  const [seatTakenAlertOpen, setSeatTakenAlertOpen] = useState(false);
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSeverity, setToastSeverity] = useState<
    "success" | "info" | "warning" | "error"
  >("info");
  const [confirmResult, setConfirmResult] = useState<string | null>(null);

  const handleShowAlert = (type: AlertType, title: string, message: string) => {
    showAlert(message, {
      type,
      title,
    });
  };

  const handleShowCustomAlert = (
    type: AlertType,
    title: string,
    message: string
  ) => {
    setCustomAlertType(type);
    setCustomAlertTitle(title);
    setCustomAlertMessage(message);
    setCustomAlertOpen(true);
  };

  const handleShowToast = (
    message: string,
    severity: "success" | "info" | "warning" | "error" = "info"
  ) => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  };

  const handleCustomConfirm = async () => {
    const result = await showConfirm(
      "정말 방을 나가시겠습니까?\n취소하면 현재 화면을 유지합니다.",
      {
        confirmText: "방 나가기",
        cancelText: "취소",
        type: "warning",
      }
    );
    setConfirmResult(
      result ? "커스텀 Confirm: 확인 선택" : "커스텀 Confirm: 취소 선택"
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <Typography
          variant="h4"
          sx={{ mb: 4, fontWeight: 700, color: "#1f2937" }}
        >
          디자인 테스트 페이지
        </Typography>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            전역 Alert (showAlert)
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "#6b7280" }}>
            전역으로 사용 가능한 커스텀 Alert입니다.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "info",
                  "정보",
                  "이것은 정보 알림입니다.\n\n여러 줄 메시지도 표시할 수 있습니다."
                )
              }
              sx={{ bgcolor: "#3b82f6", "&:hover": { bgcolor: "#2563eb" } }}
            >
              Info Alert
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "success",
                  "성공",
                  "작업이 성공적으로 완료되었습니다!"
                )
              }
              sx={{ bgcolor: "#10b981", "&:hover": { bgcolor: "#059669" } }}
            >
              Success Alert
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "warning",
                  "경고",
                  "주의가 필요한 상황입니다.\n\n이 작업을 계속하시겠습니까?"
                )
              }
              sx={{ bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }}
            >
              Warning Alert
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "error",
                  "오류",
                  "오류가 발생했습니다.\n\n다시 시도해주세요."
                )
              }
              sx={{ bgcolor: "#ef4444", "&:hover": { bgcolor: "#dc2626" } }}
            >
              Error Alert
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "info",
                  "경기 종료",
                  "경기가 종료되었습니다.\n\n결과 화면으로 이동합니다."
                )
              }
              sx={{ bgcolor: "#6366f1", "&:hover": { bgcolor: "#4f46e5" } }}
            >
              경기 종료 알림
            </Button>
            <Button
              variant="contained"
              onClick={() =>
                handleShowAlert(
                  "warning",
                  "방 퇴장",
                  "방에서 퇴장되었습니다.\n홈 화면으로 이동합니다."
                )
              }
              sx={{ bgcolor: "#f59e0b", "&:hover": { bgcolor: "#d97706" } }}
            >
              방 퇴장 알림
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            CustomAlert 컴포넌트 직접 사용
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "#6b7280" }}>
            CustomAlert 컴포넌트를 직접 사용하는 예시입니다.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowCustomAlert(
                  "info",
                  "정보",
                  "커스텀 Alert 컴포넌트입니다."
                )
              }
            >
              Info (커스텀)
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowCustomAlert(
                  "success",
                  "성공",
                  "작업이 완료되었습니다!"
                )
              }
            >
              Success (커스텀)
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowCustomAlert("warning", "경고", "주의가 필요합니다.")
              }
            >
              Warning (커스텀)
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowCustomAlert("error", "오류", "오류가 발생했습니다.")
              }
            >
              Error (커스텀)
            </Button>
          </Box>

          <CustomAlert
            open={customAlertOpen}
            onClose={() => setCustomAlertOpen(false)}
            message={customAlertMessage}
            title={customAlertTitle}
            type={customAlertType}
          />
        </Paper>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            SeatTakenAlert (좌석 선택 불가)
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "#6b7280" }}>
            이미 선택된 좌석을 선택하려고 할 때 표시되는 알림입니다.
          </Typography>
          <Button
            variant="outlined"
            color="warning"
            onClick={() => setSeatTakenAlertOpen(true)}
          >
            좌석 선택 불가 알림
          </Button>

          <SeatTakenAlert
            open={seatTakenAlertOpen}
            onClose={() => setSeatTakenAlertOpen(false)}
          />
        </Paper>

        <Paper sx={{ p: 4, mb: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            Toast (Snackbar)
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "#6b7280" }}>
            현재 사용 중인 MUI Snackbar 기반 토스트 알림입니다.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowToast(
                  "이미지는 jpg/png만 업로드 가능합니다.",
                  "warning"
                )
              }
            >
              업로드 경고 토스트
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowToast(
                  "시작 30초 전에는 입장이 불가능합니다. 방 목록을 새로고침했습니다.",
                  "info"
                )
              }
            >
              시작 준비 토스트
            </Button>
            <Button
              variant="outlined"
              onClick={() =>
                handleShowToast("방 설정이 저장되었습니다.", "success")
              }
            >
              설정 저장 토스트
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 4 }}>
          <Typography variant="h5" sx={{ mb: 3, fontWeight: 600 }}>
            커스텀 Confirm 다이얼로그
          </Typography>
          <Typography variant="body2" sx={{ mb: 3, color: "#6b7280" }}>
            방 나가기 등에서 사용하는 커스텀 Confirm입니다.
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mb: 2 }}>
            <Button variant="outlined" onClick={handleCustomConfirm}>
              방 나가기 Confirm 보기
            </Button>
          </Box>
          {confirmResult ? (
            <Typography variant="body2" sx={{ color: "#4b5563" }}>
              {confirmResult}
            </Typography>
          ) : null}
        </Paper>
      </div>

      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <MuiAlert
          onClose={() => setToastOpen(false)}
          severity={toastSeverity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toastMessage}
        </MuiAlert>
      </Snackbar>
    </div>
  );
}
