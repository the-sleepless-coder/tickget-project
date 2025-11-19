import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
} from "@mui/material";
import { CheckCircle, Error, Info, Warning } from "@mui/icons-material";

export type AlertType = "info" | "success" | "warning" | "error";

export type AlertVariant = "default" | "simple";

export interface CustomAlertProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
  variant?: AlertVariant;
  confirmColor?: string;
}

const typeConfig: Record<
  AlertType,
  { icon: React.ReactNode; color: string; bgColor: string }
> = {
  info: {
    icon: <Info sx={{ fontSize: 48, color: "#3b82f6" }} />,
    color: "#3b82f6",
    bgColor: "#eff6ff",
  },
  success: {
    icon: <CheckCircle sx={{ fontSize: 48, color: "#10b981" }} />,
    color: "#10b981",
    bgColor: "#ecfdf5",
  },
  warning: {
    icon: <Warning sx={{ fontSize: 48, color: "#f59e0b" }} />,
    color: "#f59e0b",
    bgColor: "#fffbeb",
  },
  error: {
    icon: <Error sx={{ fontSize: 48, color: "#ef4444" }} />,
    color: "#ef4444",
    bgColor: "#fef2f2",
  },
};

export default function CustomAlert({
  open,
  onClose,
  title,
  message,
  type = "info",
  confirmText = "확인",
  onConfirm,
  variant = "default",
  confirmColor,
}: CustomAlertProps) {
  const config = typeConfig[type];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  const buttonColor =
    confirmColor || (variant === "simple" ? "#6d28d9" : config.color);
  const buttonHoverColor = variant === "simple" ? "#5b21b6" : config.color;

  const messageLines = message.split("\n");
  const showIcon = variant !== "simple";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: variant === "simple" ? "18px" : "16px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
        },
      }}
    >
      <DialogContent
        sx={{
          px: variant === "simple" ? 3.5 : 4,
          py: variant === "simple" ? 3.5 : 4,
          textAlign: variant === "simple" ? "left" : "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: variant === "simple" ? "flex-start" : "center",
            gap: 2,
          }}
        >
          {showIcon && (
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                backgroundColor: config.bgColor,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                mb: 1,
              }}
            >
              {config.icon}
            </Box>
          )}

          {title && (
            <Typography
              variant="h6"
              sx={{
                fontWeight: 600,
                color: variant === "simple" ? "#111827" : "#1f2937",
                fontSize: "20px",
              }}
            >
              {title}
            </Typography>
          )}

          <Box sx={{ mt: title ? 0 : 1 }}>
            {messageLines.map((line, index) => (
              <Typography
                key={index}
                variant="body1"
                sx={{
                  color: variant === "simple" ? "#1f2937" : "#4b5563",
                  fontSize: "16px",
                  lineHeight: 1.6,
                  whiteSpace: "pre-line",
                  textAlign: variant === "simple" ? "left" : "center",
                }}
              >
                {line}
              </Typography>
            ))}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions
        sx={{
          px: variant === "simple" ? 3.5 : 4,
          pb: 3,
          justifyContent: variant === "simple" ? "flex-end" : "center",
          width: "100%",
        }}
      >
        <Button
          variant="contained"
          onClick={handleConfirm}
          sx={{
            borderRadius: "12px",
            px: 4,
            py: 1.5,
            minWidth: 120,
            fontSize: "16px",
            fontWeight: 600,
            backgroundColor: buttonColor,
            "&:hover": {
              backgroundColor: buttonHoverColor || buttonColor,
              opacity: 0.95,
            },
            boxShadow: `0 4px 12px ${buttonColor}40`,
          }}
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
