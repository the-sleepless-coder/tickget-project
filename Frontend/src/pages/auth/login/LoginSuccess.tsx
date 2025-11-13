import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "@features/auth/store";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "";
const PROFILE_URL = `${API_ORIGIN}/api/v1/dev/user/myprofile`;

export default function LoginSuccess() {
  const location = useLocation();
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  useEffect(() => {
    const run = async () => {
      try {
        const params = new URLSearchParams(location.search);
        const accessToken = params.get("accessToken") || params.get("token");
        const refreshToken = params.get("refreshToken");
        const userIdParam = params.get("userId");
        const userId =
          userIdParam !== null && !Number.isNaN(Number(userIdParam))
            ? Number(userIdParam)
            : 0;
        const email = params.get("email") ?? "";
        const nickname = params.get("nickname") ?? "";
        const name = params.get("name") ?? "";

        if (!accessToken || userId <= 0) {
          navigate("/", { replace: true });
          return;
        }

        setAuth({
          accessToken,
          refreshToken: refreshToken ?? null,
          userId,
          email,
          nickname,
          name,
          profileImageUrl: null,
        } as any);

        // 프로필 이미지 조회
        let profileImageUrl: string | null = null;
        try {
          const res = await fetch(PROFILE_URL, {
            method: "GET",
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            profileImageUrl = data?.profileImageUrl || null;
          }
        } catch {
          // ignore
        }

        const hasNickname = !!(nickname || useAuthStore.getState().nickname)?.trim();
        const hasProfileImage = !!profileImageUrl;
        const hasName = !!(name || useAuthStore.getState().name)?.trim();

        if (hasNickname && hasProfileImage && !hasName) {
          // 이름이 없으면 '홍길동'으로 지정
          try {
            await fetch(PROFILE_URL, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({ name: "홍길동" }),
            });
          } catch {
            // ignore
          }
          const current = useAuthStore.getState();
          setAuth({
            accessToken: current.accessToken,
            refreshToken: current.refreshToken,
            userId: current.userId,
            email: current.email,
            nickname: current.nickname,
            name: "홍길동",
            profileImageUrl,
          } as any);
        } else if (hasProfileImage) {
          const current = useAuthStore.getState();
          setAuth({
            accessToken: current.accessToken,
            refreshToken: current.refreshToken,
            userId: current.userId,
            email: current.email,
            nickname: current.nickname,
            name: current.name,
            profileImageUrl,
          } as any);
        }

        // 팝업으로 열린 경우 메인 창에 알리고 닫기
        try {
          if (window.opener && !window.opener.closed) {
            const message = {
              type: "oauth-callback",
              href: window.location.href,
              search: window.location.search,
              hash: window.location.hash,
            };
            window.opener.postMessage(message, "*");
            setTimeout(() => {
              try {
                window.close();
              } catch {
                /* ignore */
              }
            }, 100);
            return;
          }
        } catch {
          /* ignore */
        }

        // 일반 창이라면 홈으로 이동
        navigate("/", { replace: true });
      } catch {
        navigate("/", { replace: true });
      }
    };
    run();
  }, [location.search, navigate, setAuth]);

  return null;
}


