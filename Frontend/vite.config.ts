import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: "https://tickget.kr",
        changeOrigin: true,
        secure: true,
      },
      // /auth는 프론트엔드 라우트이므로 프록시에서 제외
      // OAuth API는 /api/v1/dev/auth 경로를 사용하므로 /api 프록시로 처리됨
    },
  },
});
