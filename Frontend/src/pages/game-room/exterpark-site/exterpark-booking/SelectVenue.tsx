import { paths } from "../../../../app/routes/paths";

export default function SelectVenuePage() {
  const openSeatPopup = (venue: "small" | "medium" | "large") => {
    const url = new URL(window.location.origin + paths.booking.selectSeat);
    url.searchParams.set("venue", venue);
    const features = [
      "popup=yes",
      "noopener=yes",
      "toolbar=no",
      "menubar=no",
      "location=no",
      "status=no",
      "scrollbars=no",
      "resizable=yes",
      "width=900",
      "height=680",
      "left=100",
      "top=80",
    ].join(",");
    const win = window.open(url.toString(), "seat-selection", features);
    if (!win) {
      window.location.href = url.toString();
    } else {
      win.focus();
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">공연장 선택</h1>
      <div className="space-y-2">
        <button
          type="button"
          className="block w-full text-left border rounded p-3 hover:bg-gray-50"
          onClick={() => openSeatPopup("small")}
        >
          소형 공연장으로 이동 (팝업)
        </button>
        <button
          type="button"
          className="block w-full text-left border rounded p-3 hover:bg-gray-50"
          onClick={() => openSeatPopup("medium")}
        >
          중형 공연장으로 이동 (팝업)
        </button>
        <button
          type="button"
          className="block w-full text-left border rounded p-3 hover:bg-gray-50"
          onClick={() => openSeatPopup("large")}
        >
          대형 공연장으로 이동 (팝업)
        </button>
      </div>
    </div>
  );
}
