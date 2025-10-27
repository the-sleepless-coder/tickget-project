interface ProfileBannerProps {
  nickname: string;
  birthDate: string;
  email: string;
  profileImage?: string;
}

export default function ProfileBanner({
  nickname,
  birthDate,
  email,
  profileImage,
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
        <div className="flex h-32 w-32 items-center justify-center rounded-full bg-white">
          {profileImage ? (
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

        {/* User Info */}
        <div className="flex flex-col gap-2 text-white">
          <h2 className="text-3xl font-bold">{nickname}</h2>
          <div className="flex gap-6 text-sm">
            <span>생년월일: {birthDate}</span>
            <span>이메일: {email}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
