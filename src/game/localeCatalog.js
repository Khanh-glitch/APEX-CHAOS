// APEX CHAOS localization catalog — source copy is always the accepted Gold English.
// Do not change gameplay IDs, hero names, weapon IDs, or canonical owner-locked Vietnamese dialogue.
// Vietnamese copy has been edited for natural in-game usage rather than word-by-word translation.
export const COPY = Object.freeze(Object.fromEntries([
  // HOME / global navigation
  ['Player','Người chơi'],['PROFILE','HỒ SƠ'],['Player profile','Hồ sơ người chơi'],
  ['Player and economy','Người chơi và tài nguyên'],['Settings','Cài đặt'],
  ['Current story','Cốt truyện hiện tại'],['Main routes','Điều hướng chính'],
  ['Primary actions','Thao tác chính'],['QUEST 01','NHIỆM VỤ 01'],
  ['THE ONES','NHỮNG KẺ'],['THROWN AWAY','BỊ VỨT BỎ'],
  ['THE ONES THROWN AWAY','NHỮNG KẺ BỊ VỨT BỎ'],
  ['Discarded machines, forgotten by the world.','Những cỗ máy bị vứt bỏ, bị cả thế giới lãng quên.'],
  ['But here, in the Scrap Basin,','Nhưng tại Scrap Basin,'],['they move again.','chúng lại cử động.'],
  ['CONTINUE STORY','TIẾP TỤC CỐT TRUYỆN'],['FREE BATTLE','ĐẤU TỰ DO'],
  ['Fighter Shop','Cửa hàng đấu sĩ'],['Lucky Draw','Vòng quay may mắn'],
  ['Upgrade','Nâng cấp'],['Dictionary','Từ điển'],['Missions','Nhiệm vụ'],['Account','Tài khoản'],
  ['Achievements','Thành tích'],['Fighter Upgrade','Nâng cấp đấu sĩ'],
  ['Account / Profile','Tài khoản / Hồ sơ'],['Quest 01','Nhiệm vụ 01'],
  ['Fighter Shop (locked)','Cửa hàng đấu sĩ (chưa mở)'],
  ['Upgrade (locked)','Nâng cấp (chưa mở)'],
  ['Dictionary (locked)','Từ điển (chưa mở)'],
  ['Missions (locked)','Nhiệm vụ (chưa mở)'],
  ['Account (locked)','Tài khoản (chưa mở)'],
  ['Apex Credits','Điểm Apex'],
  // mode selection
  ['MODE SELECT','CHỌN CHẾ ĐỘ'],['Free Battle mode select','Chọn chế độ Đấu tự do'],
  ['Battle mode','Chế độ thi đấu'],
  ['Choose how the next fight begins. Same arena. Different opponent.','Chọn đối thủ cho trận đấu. Vẫn đấu trường ấy, nhưng cách đối đầu khác nhau.'],
  ['01 / SOLO','01 / ĐẤU ĐƠN'],['VS BOT','ĐẤU VỚI MÁY'],
  ['Fight against an AI opponent','Đối đầu với máy'],
  ['02 / LOCAL','02 / CÙNG MÁY'],['1 VS 1','1 ĐẤU 1'],
  ['Two players. One device.','Hai người chơi trên cùng một thiết bị.'],
  ['BACK','QUAY LẠI'],['SELECT','CHỌN'],['ENTER','ENTER'],['ESC','ESC'],['LOCK','KHÓA'],
  // Fighter Select
  ['FIGHTER SELECT','CHỌN ĐẤU SĨ'],['Fighter select','Chọn đấu sĩ'],
  ['CHOOSE YOUR FIGHTER','CHỌN ĐẤU SĨ CỦA BẠN'],['Fighter','Đấu sĩ'],
  ['FIGHTER','ĐẤU SĨ'],['P1 SELECTING','P1 ĐANG CHỌN'],
  ['P2 SELECTING','P2 ĐANG CHỌN'],['BOT SELECTING','ĐANG CHỌN CHO MÁY'],
  ['DUEL LOCKED','ĐÃ KHÓA ĐỘI HÌNH'],
  ['6 FIGHTERS // ONE CONFLICT','6 ĐẤU SĨ // MỘT TRẬN CHIẾN'],
  ['LOCK IN','XÁC NHẬN'],['LOCK P1','KHÓA P1'],['LOCK P2','KHÓA P2'],
  ['LOCK BOT','KHÓA ĐẤU SĨ MÁY'],['BOT LOCKED','ĐÃ KHÓA MÁY'],
  ['READY','SẴN SÀNG'],['LOCKED','CHƯA MỞ'],['UNLOCKED','ĐÃ MỞ'],
  ['LOCKED — EXTENSION POINT','CHƯA MỞ — NỘI DUNG TƯƠNG LAI'],
  ['LOCK P1 TO DEPLOY','KHÓA P1 ĐỂ TIẾP TỤC'],['AWAITING FIGHTER','ĐANG CHỜ ĐẤU SĨ'],
  ['CPU OPPONENT','ĐỐI THỦ MÁY'],['BOT CHOICE','ĐẤU SĨ CỦA MÁY'],
  ['SELECT BOT FIGHTER','CHỌN ĐẤU SĨ CHO MÁY'],['BATTLE HANDOFF READY','SẴN SÀNG VÀO TRẬN'],
  ['BOTH FIGHTERS LOCKED','CẢ HAI ĐÃ KHÓA CHỌN'],
  ['PASSIVE','NỘI TẠI'],['ABILITY 1','KỸ NĂNG 1'],['ABILITY 2','KỸ NĂNG 2'],
  ['ACTIVE WINDOW','THỜI GIAN HIỆU LỰC'],['COOLDOWN','HỒI CHIÊU'],
  ['Player 1 fighter','Đấu sĩ người chơi 1'],['Player 2 fighter','Đấu sĩ người chơi 2'],
  ['Hero roster','Danh sách đấu sĩ'],['LOCAL 1 VS 1','1 ĐẤU 1 CÙNG MÁY'],
  ['COMBAT UNIT','ĐƠN VỊ CHIẾN ĐẤU'],['MANTIS ASSASSIN','SÁT THỦ BỌ NGỰA'],
  ['ANCIENT KEEPER','HỘ VỆ CỔ ĐẠI'],['ECHO DUPLICATE','ẢO ẢNH PHẢN CHIẾU'],
  ['APEX COMBAT FRAME','KHUNG CHIẾN ĐẤU APEX'],
  ['PREDATORY','BẢN NĂNG SĂN MỒI'],
  ['ROLLING BURST','BÙNG NỔ LIÊN HOÀN'],
  ['TRAP DEPLOY','ĐẶT BẪY'],['DASH / STRIKE','LƯỚT VÀ CHÉM'],
  ['CRYSTAL CORE','LÕI PHA LÊ'],
  ['TRAJECTORY CONTROL','ĐIỀU KHIỂN QUỸ ĐẠO'],
  ['MAGNETIC ATTRACTION','LỰC HÚT TỪ TRƯỜNG'],
  ['MAGNETIC REPEL','LỰC ĐẨY TỪ TRƯỜNG'],
  ['FROZEN BULLET','ĐẠN BĂNG'],['FROST BREATH','HƠI THỞ BĂNG GIÁ'],
  ['FROST RUSH','LAO BĂNG'],['MIRROR SHARDS','MẢNH GƯƠNG'],
  ['Player 1 combat panel','Bảng chiến đấu người chơi 1'],
  ['Player 2 combat panel','Bảng chiến đấu người chơi 2'],
  // fight transitions / HUD
  ['P1 // FIGHTER','P1 // ĐẤU SĨ'],['P2 // FIGHTER','P2 // ĐẤU SĨ'],
  ['CPU // TARGET','MÁY // MỤC TIÊU'],['TARGET ACQUIRED','ĐÃ KHÓA MỤC TIÊU'],
  ['COMBAT LOCK','SẴN SÀNG GIAO CHIẾN'],
  ['COMBAT CHANNEL OPEN','KÊNH CHIẾN ĐẤU ĐÃ MỞ'],
  ['ARSENAL BATTLE','TRẬN CHIẾN KHO VŨ KHÍ'],
  ['RAGE ACTIVE','ĐANG CUỒNG NỘ'],['RECENT PRESSURE','ÁP LỰC GẦN ĐÂY'],
  ['ROLLING 1.2S','CỘNG DỒN 1,2 GIÂY'],['BURST 1.2S','BÙNG NỔ 1,2 GIÂY'],
  ['DMG','SÁT THƯƠNG'],['HITS','ĐÒN TRÚNG'],['CRIT','CHÍ MẠNG'],
  ['CURRENT LOADOUT','VŨ KHÍ HIỆN TẠI'],['UNARMED','TAY KHÔNG'],
  ['ENERGY','NĂNG LƯỢNG'],['COMBAT RESOURCE','TÀI NGUYÊN CHIẾN ĐẤU'],
  ['HP','HP'],['RELOAD','NẠP ĐẠN'],['RELOADING','ĐANG NẠP ĐẠN'],
  ['AMMO','ĐẠN'],['EQUIPPED','ĐANG TRANG BỊ'],
  ['ROUND','HIỆP'],['MATCH','TRẬN'],['TIME','THỜI GIAN'],
  ['PAUSED','TẠM DỪNG'],['RESUME','TIẾP TỤC'],['QUIT','THOÁT'],
  ['EXIT','THOÁT'],['RETURN HOME','VỀ TRANG CHỦ'],
  ['VICTORY','CHIẾN THẮNG'],['DEFEAT','THẤT BẠI'],
  ['K.O.','HẠ GỤC'],['WINNER','NGƯỜI THẮNG'],
  ['DAMAGE DEALT','SÁT THƯƠNG GÂY RA'],['DAMAGE TAKEN','SÁT THƯƠNG NHẬN VÀO'],
  ['TOTAL DAMAGE','TỔNG SÁT THƯƠNG'],['MOST USED WEAPON','VŨ KHÍ DÙNG NHIỀU NHẤT'],
  ['MVP GUN','VŨ KHÍ GÂY SÁT THƯƠNG CAO NHẤT'],['MATCH RESULT','KẾT QUẢ TRẬN ĐẤU'],
  ['PLAY AGAIN','CHƠI LẠI'],['NEXT','TIẾP THEO'],
  ['FIRE','BẮN'],['HEAL','HỒI MÁU'],['SHIELD','LÁ CHẮN'],
  ['SKILL READY','KỸ NĂNG ĐÃ SẴN SÀNG'],['SKILL LOCKED','KỸ NĂNG CHƯA MỞ'],
  ['COOLING DOWN','ĐANG HỒI CHIÊU'],
  // Lucky Draw
  ['DRAW BAY','KHU VỰC QUAY THƯỞNG'],['DRAW BAY · ACTIVE','KHU QUAY THƯỞNG · ĐANG HOẠT ĐỘNG'],
  ['APEX CHAOS · DRAW BAY','APEX CHAOS · KHU QUAY THƯỞNG'],
  ['LUCKY DRAW','QUAY MAY MẮN'],['DRAW','QUAY'],
  ['POSSIBLE FIGHTERS','ĐẤU SĨ CÓ THỂ NHẬN'],
  ['Possible fighters','Đấu sĩ có thể nhận'],['CLOSE ✕','ĐÓNG ✕'],
  ['CLOSE','ĐÓNG'],['Back','Quay lại'],['DRAW UNAVAILABLE','HIỆN KHÔNG THỂ QUAY'],
  ['DRAW ASSETS UNAVAILABLE','CHƯA TẢI ĐƯỢC DỮ LIỆU VÒNG QUAY'],
  ['Draw one fighter, cost 350','Quay một đấu sĩ, tốn 350 AC'],
  ['MOTION LANE → LOCK','HƯỚNG CHUYỂN ĐỘNG → KHÓA'],
  ['HERO SAFE BOX','VÙNG HIỂN THỊ ĐẤU SĨ'],
  ['LAYOUT','BỐ CỤC'],['SAFE AREA','VÙNG AN TOÀN'],['LED WALL','BẢNG LED'],
  ['CONTROLS','ĐIỀU KHIỂN'],['CH','MÃ'],
  // Quest hub and story
  ['QUEST 01 // THE ONES THROWN AWAY','NHIỆM VỤ 01 // NHỮNG KẺ BỊ VỨT BỎ'],
  ['QUEST 01 · THE ONES THROWN AWAY','NHIỆM VỤ 01 · NHỮNG KẺ BỊ VỨT BỎ'],
  ['Quest 01 story checkpoint','Điểm lưu cốt truyện nhiệm vụ 01'],
  ['Quest story scene','Cảnh cốt truyện nhiệm vụ'],
  ['WHY THIS CHAPTER','VÌ SAO CÓ CHƯƠNG NÀY'],
  ['START QUEST 01 · OPENING','BẮT ĐẦU NHIỆM VỤ 01 · MỞ ĐẦU'],
  ['BEGIN FIRST WAKE · E02','BẮT ĐẦU THỨC TỈNH · E02'],
  ['ENTER SCRAP SWARM · E03','BƯỚC VÀO BẦY PHẾ LIỆU · E03'],
  ['ENTER WEAPON RAIN · E04','VÀO CƠN MƯA VŨ KHÍ · E04'],
  ['CHARGE THE BREAKER · E05','NẠP NĂNG LƯỢNG CHO BREAKER · E05'],
  ['DEFEND THE BREACH · E06','BẢO VỆ LỐI THỦNG · E06'],
  ['FACE RIVET · E07','ĐỐI MẶT RIVET · E07'],
  ['T.O.T · LAST CHOICE · E08','T.O.T · LỰA CHỌN CUỐI · E08'],
  ['PLAYTEST FIRST WAKE · CP04','CHƠI THỬ THỨC TỈNH · CP04'],
  ['PLAYTEST REFLEX · Q4A','CHƠI THỬ PHẢN XẠ · Q4A'],
  ['REFLEX · STORY PREVIEW','PHẢN XẠ · XEM TRƯỚC CỐT TRUYỆN'],
  ['QUEST STAGES / REPLAY','CÁC CHẶNG NHIỆM VỤ / CHƠI LẠI'],
  ['Quest encounter replay','Chơi lại các màn nhiệm vụ'],
  ['SKIP ›','BỎ QUA ›'],['CONTINUE ›','TIẾP TỤC ›'],
  ['STORY','CỐT TRUYỆN'],
  ['WAKE','THỨC TỈNH'],['REFLEX','PHẢN XẠ'],
  ['FIRST WAKE','LẦN THỨC TỈNH ĐẦU TIÊN'],['SCRAP SWARM','BẦY PHẾ LIỆU'],
  ['WEAPON RAIN','MƯA VŨ KHÍ'],['CHARGE THE BREAKER','NẠP NĂNG LƯỢNG CHO BREAKER'],
  ['BREACH WAVES','NHỮNG ĐỢT TẤN CÔNG'],['RIVET OVERRIDDEN','RIVET BỊ CHIẾM QUYỀN'],
  ['T.O.T · LAST CHOICE','T.O.T · LỰA CHỌN CUỐI'],
  ['THREE FAILURES','BA KẺ THẤT BẠI'],
  ['FIRST IMPACT','PHÁT ĐẠN ĐẦU TIÊN'],
  ['RETURN FIRE','BẮN TRẢ'],['UNKNOWN ROUTINE','CHUỖI LỆNH LẠ'],
  ['UNKNOWN ROUTINE — J','CHUỖI LỆNH LẠ — J'],
  ['SECOND ROUTINE','CHUỖI LỆNH THỨ HAI'],
  ['COMBAT INTERRUPTED','GIAO TRANH BỊ GIÁN ĐOẠN'],
  ['GROUND SUPPRESSION','KHỐNG CHẾ MẶT ĐẤT'],
  ['NO VALID NETWORK ID','KHÔNG CÓ MÃ MẠNG HỢP LỆ'],
  ['THE PERIMETER HOLDS','VÒNG PHÒNG THỦ VẪN VỮNG'],
  ['NEWBOT DOWN','NEWBOT GỤC NGÃ'],
  ['TWO WAVES STOPPED','ĐÃ CHẶN HAI ĐỢT TẤN CÔNG'],
  ['SIGNAL LOST','MẤT TÍN HIỆU'],
  ['TWO HOSTILES DOWN','ĐÃ HẠ HAI KẺ ĐỊCH'],
  ['RELAY ANSWERS','TRẠM TIẾP SÓNG ĐÃ PHẢN HỒI'],
  ['RIG LOCK · FRONTLINE HANDOFF','GIỮ GIÀN ĐIỀU KHIỂN · TIẾP QUẢN TUYẾN ĐẦU'],
  ['THREE WAVES HALTED','ĐÃ ĐẨY LÙI BA ĐỢT TẤN CÔNG'],
  ['RELAY RESPONSE','PHẢN HỒI TỪ TRẠM TIẾP SÓNG'],
  ['SIGNAL OUTSIDE THE WORKSHOP','TÍN HIỆU BÊN NGOÀI XƯỞNG'],
  ['IDENTITY SCAN','QUÉT DANH TÍNH'],
  ['REGISTERED / NO VALID NETWORK ID','ĐÃ ĐĂNG KÝ / KHÔNG CÓ MÃ MẠNG HỢP LỆ'],
  ['REGISTERED','ĐÃ ĐĂNG KÝ'],
  ['RIG CONNECTION','KẾT NỐI GIÀN ĐIỀU KHIỂN'],
  ['RIVET RETURNS TO THE CABLE','RIVET QUAY LẠI NỐI CÁP'],
  ['OVERRIDE','CHIẾM QUYỀN ĐIỀU KHIỂN'],
  ['CONTROL IS NOT HIS','QUYỀN ĐIỀU KHIỂN KHÔNG CÒN THUỘC VỀ RIVET'],
  ['COMMAND INTERFERENCE','LỆNH BỊ CAN THIỆP'],
  ['RESISTANCE CONTINUES','VẪN ĐANG CHỐNG CỰ'],
  ['STOPPED — NOT DESTROYED','ĐÃ DỪNG LẠI — KHÔNG BỊ PHÁ HỦY'],
  ['AFTER THE OVERRIDE','SAU KHI BỊ CHIẾM QUYỀN'],
  ['THE RIG FALLS SILENT','GIÀN ĐIỀU KHIỂN IM BẶT'],
  ['TWO FRIENDS · OPPOSING COMMANDS','HAI NGƯỜI BẠN · HAI MỆNH LỆNH ĐỐI LẬP'],
  ['THE ONE STORMBREAKER','STORMBREAKER DUY NHẤT'],
  ['700 HP · WEAPON AVAILABLE','700 HP · VŨ KHÍ XUẤT HIỆN'],
  ['THE WEAPON RETURNS','VŨ KHÍ TRỞ VỀ'],
  ['ONE REAL RELEASE · CRADLE RETURN','MỘT LẦN PHÓNG THẬT · TRỞ LẠI GIÁ ĐỠ'],
  ['120 HP · NOT A K.O.','120 HP · KHÔNG BỊ HẠ GỤC'],
  ['ALL THREE WITHDREW','CẢ BA ĐÃ RÚT LUI'],
  ['RETRY','THỬ LẠI'],['CHECKPOINT','ĐIỂM LƯU'],
  ['HOSTILES DOWN','KẺ ĐỊCH ĐÃ BỊ HẠ'],
  ['THREE ALLIES','BA ĐỒNG MINH'],
  ['TWO HOSTILES','HAI KẺ ĐỊCH'],
  ['DISTANT NETWORK','MẠNG TỪ XA'],
  ['CONTROL RIG','GIÀN ĐIỀU KHIỂN'],
  ['UNKNOWN COMMAND','LỆNH KHÔNG RÕ NGUỒN'],
  ['CONTROL SIGNAL','TÍN HIỆU ĐIỀU KHIỂN'],
  ['NETWORK SIGNAL','TÍN HIỆU MẠNG'],
  ['SCRAP BOTS','ROBOT PHẾ LIỆU'],
  ['IMPACT ACCUMULATOR','BỘ TÍCH LŨY LỰC VA CHẠM'],
  ['WORKSHOP','XƯỞNG'],
  // result gold: owner-approved award naming, without altering award IDs/rules
  ['NO ESCAPE','KHÔNG THỂ TRỐN THOÁT'],
  ['COMEBACK','LỘI NGƯỢC DÒNG'],
  ['SURE SHOT','BÁCH PHÁT BÁCH TRÚNG'],
  ['ASSASSIN','SÁT THỦ'],
  ['LEGEND SURVIVOR','SỐNG DAI THÀNH HUYỀN THOẠI'],
  ['PACIFIST','YÊU CHUỘNG HÒA BÌNH'],
  ['SKILL FOCUS','KỸ NĂNG LÀ CHÍNH'],
  ['FIRST BLOOD','ĐỔ MÁU ĐẦU TIÊN'],['OVERKILL','SÁT THƯƠNG ÁP ĐẢO'],
  ['EXECUTIONER','KẺ KẾT LIỄU'],['GLASS CANNON','CÔNG CAO THỦ THẤP'],
  ['EAGLE EYE','MẮT ĐẠI BÀNG'],['STEADY HAND','TAY SÚNG VỮNG VÀNG'],
  ['POINT BLANK','BẮN SÁT THƯƠNG'],['FINAL ROUND','VIÊN ĐẠN CUỐI'],
  ['RICOCHET','ĐẠN NẢY'],['WEAPON SWAP','ĐỔI VŨ KHÍ'],
  ['IRON WALL','BỨC TƯỜNG SẮT'],['LAST STAND','KHÁNG CỰ ĐẾN CÙNG'],
  ['UNTOUCHABLE','KHÔNG THỂ CHẠM TỚI'],['SCAVENGER','KẺ NHẶT NHẠNH'],
  ['SECOND WIND','SỨC BẬT THỨ HAI'],['THICK SKIN','DA DÀY'],
  ['ONE BREATH','MỘT HƠI THỞ'],['KITER','CAO THỦ THẢ DIỀU'],
  ['TRICKSTER','BẬC THẦY MƯU MẸO'],['COMBO ARTIST','BẬC THẦY LIÊN HOÀN'],
  ['ADRENALINE','BÙNG NỔ ADRENALINE'],['CLUTCH','LẬT KÈO PHÚT CHÓT'],
  ['NEVER SURRENDER','KHÔNG BAO GIỜ ĐẦU HÀNG'],
  ['SPEED WIN','CHIẾN THẮNG THẦN TỐC'],
  ['CHAOS BRINGER','KẺ GIEO HỖN LOẠN'],
]));
// Owner-locked Vietnamese story dialogue is canonical; the English option
// provides a separate display-only rendering without mutating story receipts.
export const VIETNAMESE_DIALOGUE_EN = Object.freeze({
  'Lùi lại.':'Get back.',
  'Chúng ta là bạn à?':'Are we friends?',
  'Tôi nghĩ vậy.':'I think so.',
  'Tôi không đánh nữa!':"I'm done fighting!",
  'Cậu phải đánh.':'You have to fight.',
  'Nếu cậu dừng...':'If you stop...',
  '...tôi sẽ không.':"...I won't.",
  'Từ lúc tỉnh dậy đến giờ... tôi chưa từng chọn được mình có nhặt súng hay không.':"Ever since I woke up... I never had a choice about picking up a gun.",
  'Nhưng tôi có thể chọn mình làm gì với nó.':'But I can choose what I do with it.',
  'Đi.':'Go.',
  'Cậu muốn biết mình là ai mà.':'You wanted to know who you are.',
  'Lần này...':'This time...',
  '...tôi dừng được rồi.':'...I can finally stop.'
});
export const PROPER_NAMES = Object.freeze([
  'APEX CHAOS','APEX','NEWBOT','ROBOT','HUNTER','CRYSTALA','CRYSTAL',
  'MAGNET','FROST','MIRROR','T.O.T','RIVET','SCRAP BASIN','STORMBREAKER',
  'FORWARD DRIVE','EAX-01','P1','P2','A1','A2','J','K','NUM1','NUM2','AC','BOT'
]);
const PRESERVE = new Set(PROPER_NAMES.map(v=>v.toUpperCase()));
const LOOKUP = new Map(Object.entries(COPY).map(([en,vi])=>[en.toUpperCase(),vi]));
function phrase(value){
  const t=value.trim();
  if(!t||PRESERVE.has(t.toUpperCase()))return t;
  const exact=LOOKUP.get(t.toUpperCase());
  if(exact!==undefined)return exact;
  const count=t.match(/^(\d+) (HITS?|CRITS?|HOSTILES DOWN|FIGHTERS?)$/i);
  if(count){const unit=phrase(count[2]);return count[1]+' '+unit;}
  const stage=t.match(/^STORY\s*·\s*(\d+)$/i);
  if(stage)return 'CỐT TRUYỆN · '+stage[1];
  const code=t.match(/^(CH|LV|LEVEL)\s*(\d+)$/i);
  if(code)return (code[1].toUpperCase()==='CH'?'MÃ':'CẤP')+' '+code[2];
  // Only split known UI separators; do not split hyphens in names or dialogue.
  const bits=t.split(/(\s+\/\/\s+|\s+·\s+|\s+\|\s+)/);
  if(bits.length>1){
    let changed=false;
    const out=bits.map((part,i)=>{
      if(i%2)return part;
      const mapped=phrase(part);
      if(mapped!==part)changed=true;
      return mapped;
    }).join('');
    if(changed)return out;
  }
  return t;
}
export function translateCopy(input,language='eng'){
  if(typeof input!=='string')return input;
  const match=input.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if(!match||!match[2])return input;
  return match[1]+(language==='vie'?phrase(match[2]):(VIETNAMESE_DIALOGUE_EN[match[2]]||match[2]))+match[3];
}
