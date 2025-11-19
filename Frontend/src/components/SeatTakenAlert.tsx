import CustomAlert from "../shared/ui/common/CustomAlert";

export default function SeatTakenAlert({
  open,
  onClose,
  message = "다른 고객님께서 이미 선택한 좌석 입니다.",
}: {
  open: boolean;
  onClose: () => void;
  domain?: string;
  message?: string;
}) {
  return (
    <CustomAlert
      open={open}
      onClose={onClose}
      message={message}
      type="warning"
      title="tickget.kr 내용:"
      variant="simple"
      confirmColor="#6d28d9"
    />
  );
}
