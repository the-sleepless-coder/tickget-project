import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

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
    <Dialog open={open} onClose={onClose} aria-labelledby="seat-taken-title">
      <DialogContent dividers>
        <Typography>{message}</Typography>
      </DialogContent>
      <DialogActions>
        <Button
          variant="contained"
          color="primary"
          onClick={onClose}
          sx={{ borderRadius: "24px", px: 3 }}
        >
          확인
        </Button>
      </DialogActions>
    </Dialog>
  );
}
