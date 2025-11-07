import { Alert, Snackbar } from "@mui/material";

type AnchorOrigin = {
  vertical: "top" | "bottom";
  horizontal: "left" | "center" | "right";
};

export default function Toast({
  open,
  onClose,
  message,
  severity = "error",
  autoHideDuration = 2000,
  anchorOrigin = { vertical: "top", horizontal: "center" },
  variant = "filled",
}: {
  open: boolean;
  onClose: () => void;
  message: string;
  severity?: "error" | "success" | "info" | "warning";
  autoHideDuration?: number;
  anchorOrigin?: AnchorOrigin;
  variant?: "filled" | "outlined" | "standard";
}) {
  return (
    <Snackbar
      open={open}
      autoHideDuration={autoHideDuration}
      onClose={onClose}
      anchorOrigin={anchorOrigin}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        variant={variant}
        sx={{ width: "100%" }}
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
