import SettingsIcon from "@mui/icons-material/Settings";

interface ProfileBannerProps {
  nickname: string;
  birthDate: string;
  email: string;
  profileImage?: string;
  isEditing?: boolean;
  tempNickname?: string;
  tempProfileImage?: string;
  onEdit?: () => void;
  onInfoManage?: () => void;
  onNicknameChange?: (value: string) => void;
  onProfileImageChange?: (file: File) => void;
  onSave?: () => void;
  onCancel?: () => void;
}

export default function ProfileBanner({
  nickname,
  birthDate,
  email,
  profileImage,
  isEditing,
  tempNickname,
  tempProfileImage,
  onEdit,
  onInfoManage,
  onNicknameChange,
  onProfileImageChange,
  onSave,
  onCancel,
}: ProfileBannerProps) {
  return (
    <div
      className="relative z-0 h-96 w-full overflow-hidden"
      style={{
        backgroundImage: `url('/mypage_banner.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-purple-900/40 to-transparent" />

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-6xl items-center gap-6 px-8 py-8">
        {/* Profile Image */}
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white">
            {isEditing ? (
              tempProfileImage || profileImage ? (
                <img
                  src={tempProfileImage || profileImage}
                  alt="Profile"
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <svg
                  className="h-20 w-20 text-purple-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              )
            ) : profileImage ? (
              <img
                src={profileImage}
                alt="Profile"
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <svg
                className="h-20 w-20 text-purple-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            )}
          </div>
          {isEditing && (
            <label className="cursor-pointer rounded-lg bg-white/90 px-4 py-2 text-xs font-medium text-purple-600 transition-colors hover:bg-white">
              사진 변경
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && onProfileImageChange) {
                    onProfileImageChange(file);
                  }
                }}
              />
            </label>
          )}
        </div>

        {/* User Info */}
        <div className="flex flex-col gap-2 text-white">
          <div className="flex items-center gap-3">
            {isEditing ? (
              <input
                type="text"
                value={tempNickname || nickname}
                onChange={(e) => onNicknameChange?.(e.target.value)}
                className="rounded-lg bg-white/90 px-4 py-2 text-2xl font-bold text-neutral-900"
              />
            ) : (
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-bold">{nickname}</h2>
                <span className="text-white/70">|</span>
                <button
                  onClick={onInfoManage}
                  className="text-sm text-white/90 hover:text-white underline transition-colors"
                >
                  내정보 관리
                </button>
              </div>
            )}
            {!isEditing && (
              <button
                onClick={onEdit}
                className="flex items-center justify-center rounded-full p-1 text-white transition-colors hover:bg-white/20"
                aria-label="프로필 수정"
              >
                <SettingsIcon fontSize="small" />
              </button>
            )}
          </div>
          {isEditing && (
            <div className="mt-2 flex gap-3">
              <button
                onClick={onSave}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-700"
              >
                저장
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg bg-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/30"
              >
                취소
              </button>
            </div>
          )}
          <div className="flex gap-6 text-sm">
            <span>생년월일: {birthDate}</span>
            <span>이메일: {email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
