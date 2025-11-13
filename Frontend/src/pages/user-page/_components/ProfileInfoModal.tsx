import { useState, useEffect } from "react";
import { Modal } from "../../../shared/ui/common/Modal";

interface ProfileInfoModalProps {
  open: boolean;
  onClose: () => void;
  initialData: {
    gender?: string;
    name?: string;
    address?: string;
    phoneNumber?: string;
  };
  onSave: (data: {
    gender?: string;
    name?: string;
    address?: string;
    phoneNumber?: string;
  }) => void;
}

export default function ProfileInfoModal({
  open,
  onClose,
  initialData,
  onSave,
}: ProfileInfoModalProps) {
  const [formData, setFormData] = useState(initialData);

  // 모달이 열릴 때마다 initialData를 formData에 반영
  useEffect(() => {
    if (open) {
      setFormData(initialData);
    }
  }, [open, initialData]);

  // 수정 사항이 있는지 확인
  const hasChanges =
    formData.name !== initialData.name ||
    formData.gender !== initialData.gender ||
    formData.address !== initialData.address ||
    formData.phoneNumber !== initialData.phoneNumber;

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="내정보 관리"
      footer={
        <div className="h-full flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md text-gray-700 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="submit"
            form="profile-info-form"
            disabled={!hasChanges}
            className={`px-4 py-1.5 rounded-md transition-colors ${
              hasChanges
                ? "bg-purple-600 text-white hover:bg-purple-700 cursor-pointer"
                : "bg-transparent text-gray-400 cursor-not-allowed"
            }`}
          >
            저장
          </button>
        </div>
      }
    >
      <form
        id="profile-info-form"
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        {/* 이름 (좌측) + 성별 (우측) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              이름 <span className="text-gray-400 text-xs">(선택사항)</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={formData.name || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="이름을 입력하세요"
            />
          </div>

          <div>
            <label
              htmlFor="gender"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              성별 <span className="text-gray-400 text-xs">(선택사항)</span>
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender || ""}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">선택하지 않음</option>
              <option value="남성">남성</option>
              <option value="여성">여성</option>
            </select>
          </div>
        </div>

        {/* 연락처 */}
        <div>
          <label
            htmlFor="phoneNumber"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            연락처<span className="text-gray-400 text-xs">(선택사항)</span>
          </label>
          <input
            id="phoneNumber"
            name="phoneNumber"
            type="tel"
            value={formData.phoneNumber || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="연락처를 입력하세요"
          />
        </div>

        {/* 주소 */}
        <div>
          <label
            htmlFor="address"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            주소 <span className="text-gray-400 text-xs">(선택사항)</span>
          </label>
          <input
            id="address"
            name="address"
            type="text"
            value={formData.address || ""}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            placeholder="주소를 입력하세요"
          />
        </div>
      </form>
    </Modal>
  );
}
