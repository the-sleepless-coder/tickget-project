import { Button as BaseButton } from "../../../../shared/ui/base/Button";

type Props = {
  onClick?: () => void;
};

export default function GoogleSignInButton({ onClick }: Props) {
  return (
    <BaseButton onClick={onClick} className="bg-red-500 hover:bg-red-600">
      Continue with Google
    </BaseButton>
  );
}
