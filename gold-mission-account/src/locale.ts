// Gold-specific display strings. Authoritative gameplay data is still supplied by the parent game.
export type Language = "eng" | "vie";
const TEXT: Record<string, {eng:string;vie:string}> = {
  "back": {
    "eng": "Return to APEX CHAOS",
    "vie": "Trở về APEX CHAOS"
  },
  "profile": {
    "eng": "Player profile",
    "vie": "Hồ sơ người chơi"
  },
  "unavailable": {
    "eng": "Open this screen from APEX CHAOS. Game data is not available yet.",
    "vie": "Hãy mở màn hình từ APEX CHAOS. Dữ liệu game chưa sẵn sàng."
  },
  "missions.kicker": {
    "eng": "APEX CHAOS // MISSIONS",
    "vie": "APEX CHAOS // NHIỆM VỤ"
  },
  "missions.title": {
    "eng": "MISSIONS",
    "vie": "NHIỆM VỤ"
  },
  "account.kicker": {
    "eng": "APEX CHAOS // PLAYER PROFILE",
    "vie": "APEX CHAOS // HỒ SƠ NGƯỜI CHƠI"
  },
  "account.title": {
    "eng": "ACCOUNT",
    "vie": "TÀI KHOẢN"
  },
  "contracts": {
    "eng": "CONTRACTS",
    "vie": "HỢP ĐỒNG"
  },
  "mastery": {
    "eng": "MASTERY",
    "vie": "TINH THÔNG"
  },
  "ready.short": {
    "eng": "READY",
    "vie": "SẴN SÀNG"
  },
  "earn.ac": {
    "eng": "EARN AC",
    "vie": "NHẬN AC"
  },
  "status.active": {
    "eng": "IN PROGRESS",
    "vie": "ĐANG TIẾN HÀNH"
  },
  "status.ready": {
    "eng": "READY TO CLAIM",
    "vie": "SẴN SÀNG NHẬN"
  },
  "status.claimed": {
    "eng": "CLAIMED",
    "vie": "ĐÃ NHẬN"
  },
  "progress": {
    "eng": "PROGRESS",
    "vie": "TIẾN ĐỘ"
  },
  "reward": {
    "eng": "REWARD",
    "vie": "PHẦN THƯỞNG"
  },
  "claim": {
    "eng": "CLAIM REWARD",
    "vie": "NHẬN THƯỞNG"
  },
  "claimed": {
    "eng": "✓ CLAIMED",
    "vie": "✓ ĐÃ NHẬN"
  },
  "remaining": {
    "eng": "REMAINING",
    "vie": "CÒN"
  },
  "wins": {
    "eng": "WINS",
    "vie": "CHIẾN THẮNG"
  },
  "matches": {
    "eng": "MATCHES",
    "vie": "TRẬN"
  },
  "claimable": {
    "eng": "READY TO CLAIM",
    "vie": "SẴN SÀNG NHẬN"
  },
  "completed": {
    "eng": "COMPLETED",
    "vie": "HOÀN THÀNH"
  },
  "claim.all": {
    "eng": "CLAIM ALL",
    "vie": "NHẬN TẤT CẢ"
  },
  "missions.empty": {
    "eng": "Loading missions from the game. No demo data is used.",
    "vie": "Đang tải nhiệm vụ từ game. Không sử dụng dữ liệu mẫu."
  },
  "tier.common": {
    "eng": "COMMON",
    "vie": "THƯỜNG"
  },
  "tier.rare": {
    "eng": "RARE",
    "vie": "HIẾM"
  },
  "tier.epic": {
    "eng": "EPIC",
    "vie": "SỬ THI"
  },
  "tier.legendary": {
    "eng": "LEGENDARY",
    "vie": "HUYỀN THOẠI"
  },
  "achievements": {
    "eng": "ACHIEVEMENTS",
    "vie": "THÀNH TỰU"
  },
  "medal.collection": {
    "eng": "MEDAL COLLECTION",
    "vie": "BỘ SƯU TẬP HUY CHƯƠNG"
  },
  "medal.info.1": {
    "eng": "Achievements recognize combat performance and",
    "vie": "Thành tựu dùng để ghi nhận thành tích và"
  },
  "medal.info.2": {
    "eng": "unlock skins",
    "vie": "mở khóa trang phục"
  },
  "medal.info.3": {
    "eng": "Achievements do not grant AC",
    "vie": "Thành tựu không thưởng AC"
  },
  "medal.info.4": {
    "eng": "— earn AC through missions only.",
    "vie": "— AC chỉ đến từ nhiệm vụ."
  },
  "medals.earned": {
    "eng": "MEDALS EARNED",
    "vie": "HUY CHƯƠNG ĐÃ ĐẠT"
  },
  "earned": {
    "eng": "EARNED",
    "vie": "ĐÃ ĐẠT"
  },
  "real.achievements": {
    "eng": "VERIFIED ACHIEVEMENTS",
    "vie": "THÀNH TỰU THẬT"
  },
  "medals": {
    "eng": "MEDALS",
    "vie": "HUY CHƯƠNG"
  },
  "total": {
    "eng": "TOTAL",
    "vie": "TỔNG"
  },
  "left": {
    "eng": "LEFT",
    "vie": "CÒN"
  },
  "mastery.skin": {
    "eng": "GAME-VERIFIED MASTERY SKINS",
    "vie": "TRANG PHỤC TINH THÔNG ĐƯỢC GAME XÁC NHẬN"
  },
  "mastery.no.skin": {
    "eng": "No verified Mastery skin for this fighter yet. Achievement progress is still tracked.",
    "vie": "Tướng này hiện chưa có trang phục Tinh thông được xác nhận. Tiến độ thành tựu vẫn được ghi nhận."
  },
  "tracked.fighters": {
    "eng": "FIGHTERS TRACKED",
    "vie": "TƯỚNG ĐƯỢC THEO DÕI"
  },
  "hero.mastery": {
    "eng": "FIGHTER MASTERY",
    "vie": "ĐỘ TINH THÔNG"
  },
  "battle.achievements": {
    "eng": "COMBAT ACHIEVEMENTS",
    "vie": "THÀNH TỰU CHIẾN ĐẤU"
  },
  "medal.wall": {
    "eng": "MEDAL WALL",
    "vie": "BỨC TƯỜNG HUY CHƯƠNG"
  },
  "all": {
    "eng": "ALL",
    "vie": "TẤT CẢ"
  },
  "status.all": {
    "eng": "ALL STATUS",
    "vie": "MỌI TRẠNG THÁI"
  },
  "status.unlocked": {
    "eng": "UNLOCKED",
    "vie": "ĐÃ MỞ"
  },
  "status.locked": {
    "eng": "LOCKED",
    "vie": "CHƯA MỞ"
  },
  "medal.none": {
    "eng": "No medals match these filters.",
    "vie": "Không có huy chương nào khớp bộ lọc."
  },
  "close": {
    "eng": "Close",
    "vie": "Đóng"
  },
  "unlocked": {
    "eng": "✓ UNLOCKED",
    "vie": "✓ ĐÃ MỞ KHÓA"
  },
  "locked": {
    "eng": "LOCKED",
    "vie": "CHƯA MỞ KHÓA"
  },
  "reward.skin": {
    "eng": "REWARD · SKIN",
    "vie": "PHẦN THƯỞNG · TRANG PHỤC"
  },
  "medal.no.skin": {
    "eng": "This medal recognizes performance. No skin reward.",
    "vie": "Huy chương ghi nhận thành tích. Không kèm trang phục."
  },
  "achievements.no.ac": {
    "eng": "Achievements do not award AC.",
    "vie": "Thành tựu không thưởng AC."
  },
  "name.length": {
    "eng": "Name must be 3–16 characters.",
    "vie": "Tên phải có từ 3 đến 16 ký tự."
  },
  "name.characters": {
    "eng": "Use letters, numbers, spaces and underscores only.",
    "vie": "Chỉ dùng chữ, số, khoảng trắng và dấu gạch dưới."
  },
  "name.changed": {
    "eng": "Display name changed to",
    "vie": "Đã đổi tên hiển thị thành"
  },
  "copy.denied": {
    "eng": "Browser blocked automatic copying.",
    "vie": "Trình duyệt không cho phép sao chép tự động."
  },
  "copy.id": {
    "eng": "Player ID copied.",
    "vie": "Đã sao chép mã người chơi."
  },
  "copy.id.warning": {
    "eng": "Player ID copied. This is not a recovery code.",
    "vie": "Đã sao chép mã người chơi. Đây không phải mã khôi phục."
  },
  "current.browser": {
    "eng": "this device",
    "vie": "thiết bị hiện tại"
  },
  "pilot.license": {
    "eng": "PILOT LICENSE",
    "vie": "THẺ PHI CÔNG"
  },
  "guest": {
    "eng": "GUEST",
    "vie": "KHÁCH"
  },
  "display.name": {
    "eng": "DISPLAY NAME",
    "vie": "TÊN HIỂN THỊ"
  },
  "rename": {
    "eng": "Edit name",
    "vie": "Đổi tên"
  },
  "save.name": {
    "eng": "Save name",
    "vie": "Lưu tên"
  },
  "cancel": {
    "eng": "Cancel",
    "vie": "Hủy"
  },
  "new.name": {
    "eng": "New display name",
    "vie": "Tên hiển thị mới"
  },
  "name.hint": {
    "eng": "3–16 characters · letters, numbers, spaces, _",
    "vie": "3–16 ký tự · chữ, số, khoảng trắng, _"
  },
  "player.id": {
    "eng": "PLAYER ID",
    "vie": "MÃ NGƯỜI CHƠI"
  },
  "local.account": {
    "eng": "ACCOUNT SAVED ON THIS DEVICE",
    "vie": "TÀI KHOẢN LƯU TRÊN THIẾT BỊ"
  },
  "avatar.choose": {
    "eng": "CHOOSE AVATAR",
    "vie": "CHỌN ẢNH ĐẠI DIỆN"
  },
  "not.owned": {
    "eng": "Not owned",
    "vie": "Chưa sở hữu"
  },
  "ac.balance": {
    "eng": "APEX CREDITS BALANCE",
    "vie": "SỐ DƯ APEX CREDITS"
  },
  "fighters.owned": {
    "eng": "FIGHTERS OWNED",
    "vie": "TƯỚNG SỞ HỮU"
  },
  "lucky.spins": {
    "eng": "TOTAL LUCKY DRAWS",
    "vie": "TỔNG LƯỢT VÒNG QUAY"
  },
  "wheel.demo": {
    "eng": "Spin decorative wheel",
    "vie": "Xoay vòng quay minh họa"
  },
  "storage.failed": {
    "eng": "LOCAL SAVE UNAVAILABLE",
    "vie": "KHÔNG GHI ĐƯỢC BỘ NHỚ"
  },
  "storage.sync": {
    "eng": "SAVING PROGRESS…",
    "vie": "ĐANG LƯU TIẾN TRÌNH…"
  },
  "storage.saved": {
    "eng": "SAVED ON THIS DEVICE",
    "vie": "ĐÃ LƯU TRÊN THIẾT BỊ"
  },
  "storage.note": {
    "eng": "APEX CHAOS saves progress on this device. Cloud sync is not available.",
    "vie": "APEX CHAOS lưu tiến trình trên thiết bị này. Chưa hỗ trợ đồng bộ đám mây."
  },
  "storage.check": {
    "eng": "CHECK SAVED DATA",
    "vie": "KIỂM TRA LƯU"
  },
  "storage.checked": {
    "eng": "Checked saved game progress.",
    "vie": "Đã kiểm tra dữ liệu tiến trình đang lưu trong game."
  },
  "player.id.copy": {
    "eng": "COPY PLAYER ID",
    "vie": "SAO CHÉP MÃ NGƯỜI CHƠI"
  },
  "guest.account": {
    "eng": "GUEST ACCOUNT",
    "vie": "TÀI KHOẢN KHÁCH"
  },
  "guest.warning": {
    "eng": "Progress is saved only on this device. Online sign-in is not yet available. Clearing game data or uninstalling may erase progress. Your Player ID is not a recovery code.",
    "vie": "Dữ liệu chỉ được lưu trên thiết bị này, chưa có đăng nhập trực tuyến. Xóa dữ liệu ứng dụng hoặc gỡ game có thể làm mất tiến trình. Mã người chơi không phải mã khôi phục dữ liệu."
  },
  "online.soon": {
    "eng": "LINK ONLINE ACCOUNT · COMING SOON",
    "vie": "LIÊN KẾT TÀI KHOẢN TRỰC TUYẾN · SẮP RA MẮT"
  },
  "online.unavailable": {
    "eng": "Online sign-in is not available in this version.",
    "vie": "Đăng nhập trực tuyến chưa khả dụng trong phiên bản này."
  }
};
export function tr(lang: Language, key: string): string {
  const match = TEXT[key];
  if (!match) throw new Error("Missing Gold translation: " + key);
  return match[lang];
}
