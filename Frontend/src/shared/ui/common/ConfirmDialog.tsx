import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import type { AlertType } from "./CustomAlert";

const TYPE_COLOR: Record<AlertType, string> = {
  info: "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};

export interface ConfirmDialogProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: AlertType;
}

export default function ConfirmDialog({
  open,
  title = "tickget.kr 내용:",
  message,
  confirmText = "확인",
  cancelText = "취소",
  onConfirm,
  onCancel,
  type = "warning",
}: ConfirmDialogProps) {
  const color = TYPE_COLOR[type] ?? TYPE_COLOR.warning;

  const messageLines = message.split("\n");

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: "18px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.12)",
        },
      }}
    >
      <DialogContent
        sx={{
          px: 3.5,
          pt: 3.5,
          pb: 1,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            color: "#111827",
            mb: 1.5,
          }}
        >
          {title}
        </Typography>
        <Box sx={{ mt: 1 }}>
          {messageLines.map((line, index) => (
            <Typography
              key={index}
              variant="body1"
              sx={{
                color: "#1f2937",
                fontSize: "15px",
                lineHeight: 1.5,
              }}
            >
              {line}
            </Typography>
          ))}
        </Box>
      </DialogContent>
      <DialogActions
        sx={{
          px: 3,
          pb: 2.5,
          pt: 1,
          justifyContent: "flex-end",
          gap: 1.5,
        }}
      >
        <Button
          variant="outlined"
          onClick={onCancel}
          sx={{
            borderRadius: "9999px",
            px: 3,
            textTransform: "none",
            borderColor: "#d1d5db",
            color: "#374151",
            "&:hover": {
              borderColor: "#9ca3af",
              backgroundColor: "#f3f4f6",
            },
          }}
        >
          {cancelText}
        </Button>
        <Button
          variant="contained"
          onClick={onConfirm}
          sx={{
            borderRadius: "9999px",
            px: 3.5,
            textTransform: "none",
            fontWeight: 600,
            backgroundColor: color,
            "&:hover": {
              backgroundColor: color,
              opacity: 0.9,
            },
            boxShadow: `0 6px 18px ${color}33`,
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
