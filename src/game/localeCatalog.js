import {englishAwardRule} from './localeAwardRules.js';
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
  ['CONTINUE STORY','TIẾP TỤC CỐT TRUYỆN'],['STORY — COMING SOON','CỐT TRUYỆN — SẮP RA MẮT'],['FREE BATTLE','ĐẤU TỰ DO'],
  ['ACCOUNT CENTER','TRUNG TÂM TÀI KHOẢN'],['PLAYER ACCOUNT','TÀI KHOẢN NGƯỜI CHƠI'],['APEX CREDITS','TÍN DỤNG APEX'],
  ['LOCAL GUEST','KHÁCH TRÊN MÁY'],['GUEST PROFILE','HỒ SƠ KHÁCH'],['SIGNED IN','ĐÃ ĐĂNG NHẬP'],['SIGNED OUT','ĐÃ ĐĂNG XUẤT'],
  ['SIGN IN WITH GOOGLE','ĐĂNG NHẬP BẰNG GOOGLE'],['SIGN IN WITH EMAIL CODE','ĐĂNG NHẬP BẰNG MÃ EMAIL'],
  ['EMAIL ADDRESS','ĐỊA CHỈ EMAIL'],['SEND CODE','GỬI MÃ'],['ENTER CODE','NHẬP MÃ'],['VERIFY CODE','XÁC THỰC MÃ'],['SIGN OUT','ĐĂNG XUẤT'],
  ['CONTINUE PLAYING','TIẾP TỤC CHƠI'],['CLOUD NOT CONFIGURED','ĐÁM MÂY CHƯA CẤU HÌNH'],
  ['Progress is saved on this device only.','Tiến trình chỉ được lưu trên thiết bị này.'],
  ['OWNED FIGHTERS','ĐẤU SĨ ĐÃ SỞ HỮU'],['OWNED','ĐÃ SỞ HỮU'],['TOTAL DRAWS','TỔNG LƯỢT QUAY'],
  ['DISPLAY NAME','TÊN HIỂN THỊ'],['SAVE NAME','LƯU TÊN'],['PLAYER ID','MÃ NGƯỜI CHƠI'],
  ['SYNC STATUS','TRẠNG THÁI ĐỒNG BỘ'],['LOCAL ONLY','CHỈ TRÊN MÁY'],['SAVED','ĐÃ LƯU'],['SYNCING','ĐANG ĐỒNG BỘ'],
  ['OFFLINE','NGOẠI TUYẾN'],['CONFLICT','XUNG ĐỘT'],['UPLOAD SNAPSHOT','TẢI BẢN SAO LÊN ĐÁM MÂY'],
  ['REQUEST DELETION','YÊU CẦU XÓA TÀI KHOẢN'],['CONFIRM REQUEST','XÁC NHẬN YÊU CẦU'],
  ['DELETION PENDING','ĐANG CHỜ XÓA'],['DELETION REQUESTED — PENDING','ĐÃ GỬI YÊU CẦU XÓA — ĐANG CHỜ XỬ LÝ'],
  ['Deletion is processed by the backend. Until then, your account and data still exist and sign-in still works.','Việc xóa do hệ thống máy chủ xử lý. Trước thời điểm đó, tài khoản và dữ liệu của bạn vẫn tồn tại và bạn vẫn đăng nhập được.'],
  ['ADMIN','QUẢN TRỊ'],
  ['Fighter Shop','Cửa hàng đấu sĩ'],['Lucky Draw','Vòng quay may mắn'],
  ['Upgrade','Nâng cấp'],['Archive','Kho hồ sơ'],['Missions','Nhiệm vụ'],['Account','Tài khoản'],
  ['Achievements','Thành tích'],['Fighter Upgrade','Nâng cấp đấu sĩ'],
  ['Account / Profile','Tài khoản / Hồ sơ'],['Quest 01','Nhiệm vụ 01'],
  ['Fighter Shop (locked)','Cửa hàng đấu sĩ (chưa mở)'],
  ['Upgrade (locked)','Nâng cấp (chưa mở)'],
  ['Open Field Archive','Mở Kho hồ sơ'],
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
  ['LOCK P1 TO DEPLOY','KHÓA P1 ĐỂ TIẾP TỤC'],['AWAITING FIGHTER','ĐANG CHỜ ĐẤU SĨ'],
  ['CPU OPPONENT','ĐỐI THỦ MÁY'],['BOT CHOICE','ĐẤU SĨ CỦA MÁY'],
  ['SELECT BOT FIGHTER','CHỌN ĐẤU SĨ CHO MÁY'],['BATTLE READY','SẴN SÀNG VÀO TRẬN'],
  ['BOTH FIGHTERS LOCKED','CẢ HAI ĐÃ KHÓA CHỌN'],
  ['HOME','TRANG CHỦ'],['← HOME','← TRANG CHỦ'],
  ['LV1 · ROLE PROFILE','LV1 · HỒ SƠ VAI TRÒ'],
  ['ARSENAL RECORD ·','HỒ SƠ KHO VŨ KHÍ ·'],
  ['APPEARANCE ONLY — NO COMBAT EFFECT','CHỈ ĐỔI NGOẠI HÌNH — KHÔNG ẢNH HƯỞNG CHIẾN ĐẤU'],
  ['EQUIP APPLIES INSTANTLY','TRANG BỊ CÓ HIỆU LỰC NGAY'],
  ['The laughing warhead keeps its full face in frame, trailing thick theatrical smoke.','Đầu đạn mặt cười hiện trọn khuôn mặt, kéo theo làn khói sân khấu dày đặc.'],
  ['Forest-jade mechanical layers over a spring-driven NEWBOT frame.','Các lớp cơ khí xanh ngọc rừng phủ trên khung NEWBOT vận hành bằng lò xo.'],
  ['COMING SOON','SẮP RA MẮT'],
  ['Fighter locked — dossier incomplete.','Đấu sĩ chưa mở — hồ sơ chưa hoàn chỉnh.'],
  ['Tier marks drop rarity: T1 29% · T2 29% · T3 23% · T4 12% · T5 5% · T6 2%.','Cấp thể hiện độ hiếm khi rơi: T1 29% · T2 29% · T3 23% · T4 12% · T5 5% · T6 2%.'],
  ['Every 300 damage dealt or taken grants 3s of Heat: empowered casts and double cooldown recovery.','Mỗi 300 sát thương gây ra hoặc nhận vào cho 3 giây Nhiệt: chiêu được cường hóa và hồi chiêu nhanh gấp đôi.'],
  ['Launch a rebounding glove for up to 5s and recall it anytime. In Heat, a hit starts a 24-hit two-glove flurry.','Phóng một chiếc găng nảy trong tối đa 5 giây và thu hồi bất cứ lúc nào. Khi có Nhiệt, đòn trúng mở ra liên hoàn 24 cú bằng hai găng.'],
  ['Guard for 1s. A blocked attack triggers a disarming counter that stuns for 2s; Heat adds a finisher.','Thủ thế 1 giây. Chặn được đòn sẽ phản công làm rơi vũ khí và choáng 2 giây; Nhiệt cộng thêm đòn kết liễu.'],
  ['Recycle each finished held T1–T5 gun into Scrap equal to its tier.','Tái chế mỗi khẩu súng T1–T5 cầm tay đã dùng hết thành Scrap bằng đúng cấp của nó.'],
  ['Plant a bomb and build anchor, then recoil away. Its shock stuns, disarms, and recycles the enemy gun.','Đặt bom và điểm neo xây dựng rồi giật lùi ra xa. Vụ sốc làm choáng, đánh rơi vũ khí và tái chế súng của địch.'],
  ['Spend Scrap to build or repair her machine; it can mount a finished gun to auto-fire, or shelter SHURI to heal.','Dùng Scrap để xây hoặc sửa máy; máy có thể gắn súng đã hết đạn để tự bắn, hoặc che chở SHURI hồi máu.'],
  ['PASSIVE','NỘI TẠI'],['ABILITY 1','KỸ NĂNG 1'],['ABILITY 2','KỸ NĂNG 2'],
  ['SKILL DETAILS','CHI TIẾT KỸ NĂNG'],['ALWAYS ACTIVE','LUÔN KÍCH HOẠT'],
  ['ACTIVE WINDOW','THỜI GIAN HIỆU LỰC'],['COOLDOWN','HỒI CHIÊU'],
  ['Player 1 fighter','Đấu sĩ người chơi 1'],['Player 2 fighter','Đấu sĩ người chơi 2'],
  ['Hero roster','Danh sách đấu sĩ'],['LOCAL 1 VS 1','1 ĐẤU 1 CÙNG MÁY'],
  ['COMBAT UNIT','ĐƠN VỊ CHIẾN ĐẤU'],['MANTIS ASSASSIN','SÁT THỦ BỌ NGỰA'],
  ['ANCIENT KEEPER','HỘ VỆ CỔ ĐẠI'],['ECHO DUPLICATE','ẢO ẢNH PHẢN CHIẾU'],
  ['APEX COMBAT FRAME','KHUNG CHIẾN ĐẤU APEX'],
  ['ANCIENT CRYSTAL ENTITY','THỰC THỂ PHA LÊ CỔ ĐẠI'],
  ['FIELD CONTROL UNIT','ĐƠN VỊ ĐIỀU KHIỂN TRƯỜNG LỰC'],
  ['CRYO EDGE UNIT','ĐƠN VỊ BĂNG GIÁ'],
  ['WEAPON DASH','LAO TỚI VŨ KHÍ'],
  ['VIRTUAL ARMOR','GIÁP ẢO'],
  ['CONTEXT CONSTRUCT','KIẾN TẠO THÍCH ỨNG'],
  ['AWAKENING','THỨC TỈNH'],
  ['MIRROR ARSENAL','KHO VŨ KHÍ PHẢN CHIẾU'],
  ['MIRROR EXCHANGE','HOÁN ĐỔI PHẢN CHIẾU'],

  ['SHOCK RECOIL','GIẬT LÙI ĐIỆN TỪ'],
  ['RECYCLE SNAP','TÁI CHẾ TỨC THÌ'],
  ['MECHANICAL GENESIS','KHỞI NGUYÊN CƠ KHÍ'],
  ['BLOCK & HIT','ĐỠ VÀ PHẢN ĐÒN'],
  ['SCRAP ENGINEER','KỸ SƯ PHẾ LIỆU'],
  ['NOT YET AWAKENED','CHƯA THỨC TỈNH'],
  ["PREDATOR'S LAW",'LUẬT KẺ SĂN MỒI'],
  ['REFRACTION','KHÚC XẠ'],
  ['HEXA CONSTRUCT','KIẾN TẠO HEXA'],
  ['MAGNETIC ACCELERATION','GIA TỐC TỪ TRƯỜNG'],
  ['ATOMIC EXCHANGE','HOÁN ĐỔI NGUYÊN TỬ'],
  ['GRAVITY TRANSIT','DỊCH CHUYỂN TRỌNG LỰC'],['SINGULARITY','ĐIỂM KỲ DỊ'],['EVENT HORIZON','CHÂN TRỜI SỰ KIỆN'],
  ['PARABOLA','PARABOL'],['FINAL EQUATION','PHƯƠNG TRÌNH CUỐI'],['MULTIPLY / DIVIDE','NHÂN / CHIA'],
  ['ELASTIC STATE','TRẠNG THÁI ĐÀN HỒI'],['COMPRESSION','NÉN ÉP'],['AFTERBOUNCE','DƯ NẢY'],
  ['TIME LOOP','VÒNG LẶP THỜI GIAN'],['REWIND','TUA LẠI'],['TIMELINE MARKERS','DẤU MỐC DÒNG THỜI GIAN'],
  ['MITOSIS','PHÂN BÀO'],['SHEDDING','THAY DA'],['EMERGENCY MITOSIS','PHÂN BÀO KHẨN CẤP'],
  ['FARTHEST CORNER','GÓC XA NHẤT'],["SNIPER'S NEST",'Ổ BẮN TỈA'],['LONGSHOT','PHÁT BẮN XA'],
  ['A discarded machine that learned to fight again.','Một cỗ máy bị vứt bỏ đã học cách chiến đấu trở lại.'],
  ['A relentless predator: traps, mobility and disarming strikes.','Kẻ săn mồi không khoan nhượng: bẫy, cơ động và những đòn tước vũ khí.'],
  ['The ancient crystal keeper; shards, defensive walls and HEXA.','Người giữ pha lê cổ đại; mảnh vỡ, tường phòng thủ và HEXA.'],
  ['Bends weapons and projectiles with magnetic force.','Bẻ cong vũ khí và đường đạn bằng lực từ trường.'],
  ['Freezes weapons, controls movement and turns ice into an advantage.','Đóng băng vũ khí, kiểm soát di chuyển và biến băng giá thành lợi thế.'],
  ['Turns battlefield positioning and projectiles into an illusion.','Biến vị trí và đường đạn trên chiến trường thành ảo ảnh.'],
  ['Damage dealt inside a 1.2-second burst window refunds skill cooldown.','Sát thương gây ra trong cửa sổ bùng nổ 1.2 giây sẽ hoàn lại hồi chiêu kỹ năng.'],
  ['Quickly closes the distance to a revealed floor weapon.','Nhanh chóng áp sát một vũ khí đã lộ diện trên sàn.'],
  ['Reduces incoming damage for 3 seconds.','Giảm sát thương nhận vào trong 3 giây.'],
  ['Marked prey turns WEAK for 1 second: it takes 25% more damage and deals 25% less.','Con mồi bị đánh dấu chịu trạng thái WEAK trong 1 giây: nhận thêm 25% sát thương và gây ít hơn 25% sát thương.'],
  ['Plants a trap that roots the first opponent who steps in.','Đặt một cái bẫy trói chân đối thủ đầu tiên bước vào.'],
  ['Dashes in with a strike that can disarm the opponent.','Lao vào tung đòn có thể tước vũ khí đối thủ.'],
  ['Reflected projectiles turn against their owner.','Đạn bị phản xạ sẽ quay lại chống chính chủ nhân của nó.'],
  ['Raises a crystal wall; during Awakening it can become the HEXA.','Dựng một bức tường pha lê; trong lúc Thức Tỉnh nó có thể trở thành HEXA.'],
  ['Activates the six floating shards to defend and enable the HEXA window.','Kích hoạt sáu mảnh pha lê lơ lửng để phòng thủ và mở cửa sổ HEXA.'],
  ['Your projectiles fly 18% faster. T6 weapons are immune.','Đạn của bạn bay nhanh hơn 18%. Vũ khí T6 miễn nhiễm.'],
  ['Pulls revealed floor guns toward you and curves bullets.','Hút các súng đã lộ diện trên sàn về phía bạn và bẻ cong đường đạn.'],
  ['Repels nearby bullets, weapons and the opponent.','Đẩy lùi đạn, vũ khí và đối thủ ở gần.'],
  ['Weapon hits have a chance to freeze the opponent for 0.9 seconds.','Đòn đánh bằng vũ khí có cơ hội đóng băng đối thủ trong 0.9 giây.'],
  ['Lays down ice that changes movement speed on frozen ground.','Trải một lớp băng làm thay đổi tốc độ di chuyển trên mặt đất đóng băng.'],
  ['Rushes forward over fresh ice and can steal a weapon on contact.','Lao tới trên lớp băng mới và có thể cướp vũ khí khi chạm trán.'],
  ['Damage creates shards that can assemble into mirror nodes.','Sát thương tạo ra các mảnh gương có thể lắp thành các nút gương.'],
  ["Copies the enemy's held weapon for a short time. T6 excluded.",'Sao chép vũ khí đối thủ đang cầm trong thời gian ngắn. Không áp dụng với T6.'],
  ["Swaps the two bodies' positions without swapping HP, velocity or weapons.",'Hoán đổi vị trí của hai cơ thể mà không đổi HP, vận tốc hay vũ khí.'],
  ['FIST ROCKET','NẮM ĐẤM TÊN LỬA'],
  ['BLOCK AND HIT','ĐỠ VÀ PHẢN ĐÒN'],
  ['HEAT','NHIỆT HUYẾT'],
  ['THE FIST OF DAWN','NẮM ĐẤM BÌNH MINH'],
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
  ['FIRST WAKE · TRIAL','THỨC TỈNH ĐẦU TIÊN · THỬ THÁCH'],
  ['REFLEX · COMBAT TRIAL','PHẢN XẠ · THỬ THÁCH CHIẾN ĐẤU'],
  ['REFLEX · STORY TRIAL','PHẢN XẠ · THỬ THÁCH CỐT TRUYỆN'],
  ['ENCOUNTERS / REPLAY','CÁC MÀN / CHƠI LẠI'],
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
  ['RIG LOCK · FRONTLINE TAKEOVER','GIỮ GIÀN ĐIỀU KHIỂN · TIẾP QUẢN TUYẾN ĐẦU'],
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
  // FIELD ARCHIVE / combat-role radar axes (source labels live in
  // fieldArchiveProfiles.PROFILE_AXES; keep both sides in step)
  ['DAMAGE','SÁT THƯƠNG'],['CONTROL','KHỐNG CHẾ'],['MOBILITY','CƠ ĐỘNG'],
  ['DEFENSE','PHÒNG VỆ'],['FIELD CONTROL','KIỂM SOÁT SÂN'],['TEMPO','NHỊP ĐỘ'],
  ['REACH','TẦM ẢNH HƯỞNG'],
]));

const VISIBLE_MISC=Object.freeze({
 'RIVAL':'ĐỐI THỦ','ARENA // EAX-01':'ĐẤU TRƯỜNG // EAX-01',
 'SCRAP HOSTILES':'KẺ ĐỊCH PHẾ LIỆU','TWO WAVES':'HAI ĐỢT TẤN CÔNG',
 'SCRAP SWARM // WAVES':'BẦY PHẾ LIỆU // CÁC ĐỢT',
 'BATTLE LIVE':'ĐANG GIAO TRANH',
 'SWARM':'BẦY PHẾ LIỆU','WAVE 02':'ĐỢT 02',
 'FOUR CONTACTS INBOUND':'BỐN KẺ ĐỊCH ĐANG ÁP SÁT',
 'WEAPON RAIN CLEAR':'ĐÃ VƯỢT QUA MƯA VŨ KHÍ',
 'SCRAP SWARM CLEAR':'ĐÃ ĐẨY LÙI BẦY PHẾ LIỆU',
 'FIRST WAKE CLEAR':'ĐÃ VƯỢT QUA THỨC TỈNH',
 'QUEST TEST CLEAR':'ĐÃ VƯỢT QUA THỬ THÁCH',
 'NEWBOT KO — RETRY':'NEWBOT GỤC NGÃ — THỬ LẠI',
 '0 HITS':'0 ĐÒN TRÚNG','0 CRIT':'0 CHÍ MẠNG',
 'MATCH REPORT':'BÁO CÁO TRẬN ĐẤU','Match Report':'Báo cáo trận đấu',
 'WEAPON OF THE BATTLE':'VŨ KHÍ NỔI BẬT NHẤT TRẬN',
 'Weapon of the Battle':'Vũ khí nổi bật nhất trận',
 'Codex':'Bách khoa danh hiệu','Space':'PHÍM CÁCH',
 'All achievements':'Toàn bộ danh hiệu',
});

// Owner-locked Vietnamese story dialogue is canonical; the English option
// provides a separate display-only rendering without mutating story receipts.

// Quest Director summaries and cinematic telemetry captions.
const QUEST_EXTRA=Object.freeze({
 'No valid network ID. One machine wakes in the Scrap Basin.':'Không có mã mạng hợp lệ. Một cỗ máy thức tỉnh tại Scrap Basin.',
 'Two routines wake beneath the scrap. Learn the controls through a real encounter.':'Hai chuỗi lệnh thức tỉnh dưới lớp phế liệu. Học cách điều khiển qua một trận chiến thực sự.',
 'WORKSHOP — THREE FAILURES':'XƯỞNG — BA KẺ THẤT BẠI',
 'Three discarded units take shelter together. The workshop is their last safe place.':'Ba cỗ máy bị vứt bỏ cùng trú ngụ. Xưởng là nơi an toàn cuối cùng của họ.',
 'NEWBOT and T.O.T stand together against two approaching scrap hunters.':'NEWBOT và T.O.T sát cánh chống lại hai kẻ săn phế liệu đang áp sát.',
 'Two waves. Seven hostiles. Hold the basin without losing NEWBOT.':'Hai đợt tấn công. Bảy kẻ địch. Giữ vững khu vực và bảo vệ NEWBOT.',
 'Metal falls from above. Survive two hostiles and the final rain of weapons.':'Kim loại trút xuống từ trên cao. Sống sót trước hai kẻ địch và cơn mưa vũ khí cuối cùng.',
 'Charge the impact accumulator with genuine weapon damage. Hold until the relay answers.':'Dùng sát thương vũ khí thực tế để nạp bộ tích lũy va chạm. Cầm cự đến khi trạm tiếp sóng phản hồi.',
 'Three allies defend the basin in three real waves. RIVET secures the rig before joining the front.':'Ba đồng minh bảo vệ khu vực qua ba đợt tấn công. RIVET khóa giàn điều khiển an toàn trước khi ra tiền tuyến.',
 'NEWBOT faces T.O.T. Only one of them can make the final choice.':'NEWBOT đối mặt T.O.T. Chỉ một người có thể đưa ra lựa chọn cuối cùng.',
 'T.O.T chose to stop. NEWBOT steps beyond the workshop.':'T.O.T đã chọn dừng lại. NEWBOT bước ra khỏi xưởng.',
 'ROUTINE DETECTED':'PHÁT HIỆN CHUỖI LỆNH','NEW COMMAND':'LỆNH MỚI',
 'TWO SCOUTS DEFEATED · MORE CONTACTS AHEAD':'ĐÃ HẠ HAI TRINH SÁT · PHÍA TRƯỚC VẪN CÒN KẺ ĐỊCH',
 'SEVEN HOSTILES DOWN · THE WEAPON CYCLE CHANGES':'ĐÃ HẠ BẢY KẺ ĐỊCH · CHU KỲ VŨ KHÍ THAY ĐỔI',
 'NEWBOT KO · RETRY CHECKPOINT':'NEWBOT GỤC NGÃ · THỬ LẠI TỪ ĐIỂM LƯU',
 'IMPACT ACCUMULATOR · THE NEXT OBJECTIVE':'BỘ TÍCH LŨY VA CHẠM · MỤC TIÊU TIẾP THEO',
 'RETRY · CHECKPOINT PRESERVED':'THỬ LẠI · ĐÃ GIỮ ĐIỂM LƯU',
 '6000 ACCEPTED IMPACT · INFRASTRUCTURE PULSE SENT':'ĐÃ NHẬN 6000 SÁT THƯƠNG VA CHẠM · ĐÃ PHÁT XUNG TÍN HIỆU',
 'RIVET LEAVES THE CONTROL RIG · NO AUTOMATIC OPERATOR':'RIVET RỜI GIÀN ĐIỀU KHIỂN · GIÀN KHÔNG TỰ VẬN HÀNH',
 'SCRAP BASIN · THE RELAY ANSWERS':'SCRAP BASIN · TRẠM TIẾP SÓNG PHẢN HỒI',
 'THE RELAY ANSWERS FROM BEYOND THE RIG':'TÍN HIỆU PHẢN HỒI ĐẾN TỪ BÊN NGOÀI GIÀN ĐIỀU KHIỂN',
 'T.O.T + RIVET: REGISTERED · NEWBOT: NO VALID NETWORK ID':'T.O.T + RIVET: ĐÃ ĐĂNG KÝ · NEWBOT: KHÔNG CÓ MÃ MẠNG HỢP LỆ',
 'PASSIVE HOLD ENDS · RETURN TO THE RIG':'KẾT THÚC GIỮ THỤ ĐỘNG · QUAY LẠI GIÀN ĐIỀU KHIỂN',
 'THE EXTERNAL SIGNAL FORCES A RECONNECTION':'TÍN HIỆU BÊN NGOÀI ÉP KẾT NỐI LẠI',
 'RIVET · LAST COMMAND BEFORE EXTERNAL CONTROL':'RIVET · LỆNH CUỐI TRƯỚC KHI BỊ CHIẾM QUYỀN',
 'RIVET · 750 HP · NATIVE IMPACT':'RIVET · 750 HP · SÁT THƯƠNG THỰC',
 'RIVET · 450 HP · NATIVE IMPACT':'RIVET · 450 HP · SÁT THƯƠNG THỰC',
 'RIVET · 180 HP · PHYSICAL NONLETHAL STOP':'RIVET · 180 HP · KHỐNG CHẾ KHÔNG GÂY CHẾT',
 'RIVET SURVIVES · RETURN TO THE WORKSHOP':'RIVET SỐNG SÓT · TRỞ VỀ XƯỞNG',
 'NEWBOT KO · CHECKPOINT PRESERVED':'NEWBOT GỤC NGÃ · ĐÃ GIỮ ĐIỂM LƯU',
 'E08 · REAL ARSENAL BOSS DUEL':'E08 · ĐẤU BOSS BẰNG ARSENAL THỰC',
 'NATIVE DAMAGE GATE · SINGLE ARTIFACT':'NGƯỠNG SÁT THƯƠNG THỰC · CHỈ MỘT VŨ KHÍ',
 'PHYSICAL HIT OR MISS RESOLVED':'ĐÃ XÁC ĐỊNH VA CHẠM HOẶC TRƯỢT MỤC TIÊU',
 'NATIVE NONLETHAL HOLD · T.O.T CHOOSES':'KHỐNG CHẾ KHÔNG GÂY CHẾT · T.O.T TỰ CHỌN',
 'PHYSICAL RETREAT · CHECKPOINT PRESERVED':'RÚT LUI THỰC SỰ · ĐÃ GIỮ ĐIỂM LƯU',
 'BOTH FIGHTERS // HOLD':'CẢ HAI ĐẤU SĨ // TẠM DỪNG',
 'STORMBREAKER // GROUND CONTACT':'STORMBREAKER // TIẾP XÚC MẶT ĐẤT',
 'WORKSHOP // NETWORK IDENTITIES':'XƯỞNG // DANH TÍNH MẠNG',
 'PISTOL // CONTACT':'SÚNG NGẮN // TRÚNG ĐÍCH',
 'PISTOL // RETALIATION':'SÚNG NGẮN // BẮN TRẢ',
});

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

// Reverse glossary for surfaces originally authored in Vietnamese (Result Gold).
// Avoid substituting punctuation, hero names, ranking thresholds or reward IDs.
export const VIETNAMESE_UI_EN=Object.freeze({

 // Result Gold UI also uses a Vietnamese-authored static fallback match fixture.
 // These are display labels/descriptions, not names of real fighters or guns.
 'Pháo Ray':'Railgun','Hạng nặng':'Heavy class',
 'Đường ray kép xuyên giáp':'Twin electromagnetic rails with armor penetration',
 'Hạng trung':'Medium class','Nòng kép cận chiến':'Twin barrels for close-quarters combat',
 'Tiểu Liên':'Submachine Gun','Hạng nhẹ':'Light class',
 'Nhịp bắn dồn dập':'Rapid sustained fire',
 'Súng Bắn Tỉa':'Marksman Rifle',
 'Tầm xa, độ chính xác cao':'Long range and high accuracy',
 'Cơn mưa đạn':'Bullet storm','Súng Phóng':'Launcher',
 'Đạn nổ hồ quang':'Arc-explosive rounds',
 'Xung phong hạng nặng':'Heavy assault',
 'Du kích tầm xa':'Long-range skirmisher',
 'Kỹ năng · Phá Cổng Nhiệt':'Skill · Thermal Breach',
 'Kỹ năng · Xung Tĩnh Điện':'Skill · Static Pulse',
 'Đấu Tay Đôi · Xếp Hạng':'Ranked Duel','Mùa 7':'Season 7',
 'Độ hiếm':'Rarity','Chênh lệch':'Damage gap','Bấm để xem chi tiết':'Click to view details',
 '▲ Dẫn đầu':'▲ Leading',
 'Tổng sát thương gây ra':'Total damage dealt',
 'Đang xem':'Viewing','Người chơi':'Player',
 'CHIẾN THẮNG':'VICTORY','THẤT BẠI':'DEFEAT',
 'Đã đạt':'Earned','Đã mở khóa':'Unlocked',
 'Chưa mở khóa':'Locked','Đang chờ':'Pending',
 'Yêu cầu danh hiệu':'Achievement requirements',
 'Đã đạt / Yêu cầu':'Earned / Required',
 'yêu cầu':'required',
 'Bấm vào huy hiệu để xem chi tiết.':'Select a badge to view details.',
 'Bấm vào huy hiệu để xem chi tiết':'Select a badge to view details',


 'APEX CHAOS / DANH HIỆU':'APEX CHAOS / ACHIEVEMENTS',
 'Xem lại hiệu ứng':'Replay animation',
 '▲ Dẫn đầu':'▲ Leading',
 'Bấm để xem chi tiết':'Select to view details',
 'CHIẾN THẮNG':'VICTORY','THẤT BẠI':'DEFEAT',
 'Đã đạt / Yêu cầu':'Earned / Required',

 'Kết quả trận đấu':'Match results',
 'Chọn người chơi để xem danh hiệu đạt được':'Select a player to view earned achievements',
 'Thị phần tổng sát thương':'Share of total damage',
 'Dẫn đầu':'Leading','So sánh tổng sát thương gây ra':'Compare total damage dealt',
 'Tổng sát thương gây ra':'Total damage dealt',
 'Ảnh nhân vật · placeholder':'Character art · placeholder',
 'chiến thắng':'victory','thất bại':'defeat',
 'Không có sát thương từ vũ khí':'No weapon damage dealt',
 'KHÔNG CÓ VŨ KHÍ NỔI BẬT':'NO STANDOUT WEAPON',
 'Trận đấu chưa ghi nhận sát thương vũ khí.':'No weapon damage was recorded in this match.',
 'Minh họa vũ khí · placeholder':'Weapon artwork · placeholder',
 'Sát thương vũ khí':'Weapon damage',
 'tổng sát thương cả trận':'total match damage',
 'Đóng góp cao nhất':'Top contributor',
 'Hồ sơ danh hiệu':'Achievement archive',
 'Đang tổng kết kết quả…':'Calculating match results…',
 'Đang tổng kết…':'Calculating…',
 'Bỏ qua':'Skip',
 'Hồ sơ và danh hiệu':'Archive and achievements',

 // Result Gold metric names (owner-authored Vietnamese; numeric values are immutable)
 'Sát thương chuỗi':'Chain damage','Khoảng ngắt tối đa':'Maximum gap',
 'Đòn mạnh nhất':'Strongest hit','Damage burst':'Burst damage',
 'Thời gian cửa sổ':'Time window','Số hit liên tục':'Consecutive hits',
 'Ngắt chuỗi tối đa':'Maximum chain interruption',
 'HP đối thủ trước KO':'Opponent HP before K.O.',
 'Tỷ lệ gây / nhận':'Damage dealt / taken ratio',
 'Damage tối thiểu':'Minimum damage',
 'Lượt bắn có trúng':'Successful trigger pulls',
 'Độ chính xác':'Accuracy','Số lượt bắn tối thiểu':'Minimum valid shots',
 'Crit rate':'Critical-hit rate','Hit hợp lệ tối thiểu':'Minimum eligible hits',
 'Damage từ xa':'Long-range damage','Khoảng cách tối thiểu':'Minimum distance',
 'Chuỗi lượt trúng':'Consecutive hits','Damage cận chiến':'Close-range damage',
 'Cự ly tối đa':'Maximum range','Lượt ném nảy trúng':'Wall-bounce throw hits',
 'Damage Shotgun':'Shotgun damage','Damage AUTO':'AUTO damage',
 'Damage BURST':'BURST damage','Damage PRECISION':'PRECISION damage',
 'Damage SEMI':'SEMI damage','Damage melee weapon':'Melee weapon damage',
 'Độ trễ tối đa':'Maximum delay','Lần thành công':'Successful occurrences',
 'Số loại súng/vũ khí':'Distinct weapons',
 'HP hồi thực':'Actual HP recovered','Damage ngăn chặn':'Damage prevented',
 'HP sau trận tối đa':'Maximum remaining HP',
 'Thời gian trận tối thiểu':'Minimum match duration',
 'Damage nhận tối đa':'Maximum damage taken',
 'Số vật phẩm đã nhặt':'Items picked up','HP nguy kịch':'Critical HP threshold',
 'HP hồi sau nguy kịch':'HP healed after critical condition',
 'Damage đã nhận':'Damage taken','HP kích hoạt':'Activation HP',
 'Thời gian sống thêm':'Additional survival time',
 'Chênh lệch HP từng bị dẫn':'Previous HP deficit',
 'Khoảng lặng':'No-damage interval','Quãng đường tối thiểu':'Minimum travel distance',
 'Số lượt dùng skill':'Skill casts','Damage khi di chuyển':'Damage while moving',
 'Tốc độ tối thiểu':'Minimum speed','Đòn nối sau khống chế':'Follow-up hits after control',
 'Cửa sổ follow-up':'Follow-up window','Độ trễ dùng lại':'Reuse delay',
 'Lượt dùng kịp':'Timely skill uses','Số chuỗi combo':'Combo chains',
 'Cửa sổ combo':'Combo window','Damage lúc thấp máu':'Damage at low HP',
 'HP tối đa để tính':'Maximum HP threshold','Damage cuối trận':'Endgame damage',
 'Thời gian hồi tố':'Lookback period','Damage khi bị dẫn':'Damage while trailing',
 'Thời gian thắng tối đa':'Maximum win time',
 'Thời gian từ pickup đến KO':'Pickup-to-K.O. time',
 'Cửa sổ hỗn loạn':'Chaos window',
 'Số Weapon ID gây damage':'Damaging weapon IDs',
 'Chu kỳ thành công':'Successful skill cycles',
 'Pha trap nối tiếp':'Trap follow-ups','Thời hạn nối tiếp':'Follow-up deadline',
 'Skill damage':'Skill damage','Sát thương súng kéo về':'Damage with attracted guns',
 'Lần làm mới freeze':'Freeze refreshes',
 'Sát thương phản chiếu':'Reflected damage',
 'giây':'seconds','lượt':'uses','món':'items','chuỗi':'chains',
 'Đã kích hoạt':'Triggered',

 'Không Thể Trốn Thoát':'No Escape',
 'Máu Đầu Tiên':'First Blood','Dư Chấn':'Aftershock',
 'Vua Bùng Nổ':'Burst King','Không Ngừng Nghỉ':'Relentless',
 'Đao Phủ':'Executioner','Pháo Thủy Tinh':'Glass Cannon',
 'Mưa Đạn':'Bullet Storm','Bách Phát Bách Trúng':'Sure Shot',
 'Sát Thủ':'Assassin','Mắt Đại Bàng':'Eagle Eye',
 'Tay Súng Vững':'Steady Hand','Cận Chiến Tử Thần':'Point-Blank Reaper',
 'Viên Đạn Cuối':'Final Round','Đạn Nảy Thần Sầu':'Ricochet Master',
 'Thông Tạo Shotgun':'Shotgun Mastery','Thông Tạo Liên Thanh':'Automatic Weapon Mastery',
 'Thông Tạo Bắn Loạt':'Burst-Fire Mastery','Thông Tạo Bắn Tỉa':'Precision Weapon Mastery',
 'Thông Tạo Bán Tự Động':'Semi-Automatic Mastery','Thông Tạo Cận Chiến':'Melee Mastery',
 'Vừa Nhặt Đã Bắn':'Quick Draw','Kho Vũ Khí Di Động':'Walking Arsenal',
 'Sống Dai Thành Huyền Thoại':'Legendary Survivor','Bức Tường Thép':'Iron Wall',
 'Đứng Vững Phút Cuối':'Last Stand','Bất Khả Xâm Phạm':'Untouchable',
 'Kẻ Nhặt Nhạnh':'Scavenger','Hơi Thở Thứ Hai':'Second Wind',
 'Da Dày Thịt Chắc':'Thick Skin','Còn Một Hơi':'One Breath Left',
 'Lội Ngược Dòng':'Comeback','Yêu Chuộng Hòa Bình':'Pacifist',
 'Kỹ Năng Là Chính':'Skill Specialist','Đả Kích Di Động':'Mobile Striker',
 'Bậc Thầy Mưu Mẹo':'Trickster','Hồi Chiêu Chớp Nhoáng':'Lightning Cooldowns',
 'Nghệ Sĩ Combo':'Combo Artist','Cơn Sốt Adrenaline':'Adrenaline Rush',
 'Phút Chốt Hạ':'Clutch Finish','Không Bao Giờ Bỏ Cuộc':'Never Surrender',
 'Tốc Chiến Tốc Thắng':'Blitz Victory','Bàn Tay Định Mệnh':'Hand of Fate',
 'Sứ Giả Hỗn Loạn':'Harbinger of Chaos','Cỗ Máy Không Ngủ':'The Sleepless Machine',
 'Con Mồi Đã Định':'Marked Prey','Ý Chí Tử Tinh':'Amethyst Resolve',
 'Vạn Vật Quy Tâm':'All Things Drawn In','Kỷ Băng Hà':'Ice Age',
 'Gậy Ông Đập Lưng Ông':'A Taste of Your Own Medicine',
 'Nguồn sát thương':'Damage sources','Hồ sơ danh hiệu':'Achievements archive',
 'Đóng hồ sơ':'Close archive','Đóng':'Close','Chế độ xem':'View',
 'Dữ liệu cố định, không thay đổi khi tải lại / đổi cỡ / xem lại.':'Recorded data remains unchanged when reloading, resizing, or replaying.',
 'Thu gọn tất cả':'Collapse all','Mở rộng tất cả':'Expand all',
 'Đã kích hoạt':'Triggered','Sự kiện combat hợp lệ':'Valid combat event',
 'Lọc danh hiệu':'Filter achievements','Tất cả':'All',
 'Đã đạt trong trận':'Earned this match','Hiển thị':'Showing',
 'Chưa ai đạt':'Not earned','Chính xác':'Accuracy','Chí mạng':'Critical hits',
 'Hồi phục':'Healing','Kỹ năng':'Skills','lần':'times',
 'DANH HIỆU':'ACHIEVEMENTS','Đóng chi tiết danh hiệu':'Close achievement details',
 'Đã đạt':'Earned','Yêu cầu':'Required','Chọn danh hiệu':'Choose an achievement',
 'Danh hiệu trước':'Previous achievement','Danh hiệu tiếp theo':'Next achievement',
 'Đang nhận kết quả trận đấu':'Receiving match results',
 'Thông tin trận đấu':'Match information','Xem lại hiệu ứng (R)':'Replay animation (R)',
 'Xem lại':'Replay','Đang tổng kết kết quả…':'Calculating match results…',
 'Bỏ qua':'Skip','Tiếp tục':'Continue','Đang tổng kết…':'Calculating…',
 'Mở hồ sơ và danh hiệu đang được áp dụng':'Open the match achievement archive',
 'Hỏa Lực':'Firepower','Chính Xác':'Precision','Vũ Khí':'Weapons',
 'Sinh Tồn':'Survival','Chiến Thuật':'Tactics','Hỗn Loạn':'Chaos',
 'Danh hiệu riêng':'Signature','Thường':'Common','Hiếm':'Rare',
 'Sử Thi':'Epic','Huyền Thoại':'Legendary',
 'Điều kiện sự kiện':'Event condition',
 'Kết quả trận đấu':'Match results',
 'danh hiệu':'achievements','sắp theo độ hiếm':'sorted by rarity',
 'nhất quán':'consistent','kiểm tra':'checks','có':'found',
 'lỗi':'issues','Đã đạt trong trận':'Earned this match',
 'Đang nhận kết quả trận đấu':'Receiving match results',
 'Đang mở hồ sơ':'Opening archive','Danh hiệu':'Achievement',
 'Tiếp tục câu chuyện':'Continue story',
});

export const PROPER_NAMES = Object.freeze([
  'APEX CHAOS','APEX','NEWBOT','ROBOT','HUNTER','CRYSTALA','CRYSTAL',
  'MAGNET','FROST','MIRROR','T.O.T','RIVET','SCRAP BASIN','STORMBREAKER',
  'FORWARD DRIVE','EAX-01','P1','P2','A1','A2','J','K','NUM1','NUM2','AC','BOT'
]);
const PRESERVE = new Set(PROPER_NAMES.map(v=>v.toUpperCase()));
const LOOKUP = new Map(Object.entries({...COPY,...QUEST_EXTRA,...VISIBLE_MISC}).map(([en,vi])=>[en.toUpperCase(),vi]));
function phrase(value){
  const t=value.trim();
  if(!t||PRESERVE.has(t.toUpperCase()))return t;
  const exact=COPY[t]??QUEST_EXTRA[t]??VISIBLE_MISC[t]??LOOKUP.get(t.toUpperCase());
  if(exact!==undefined)return exact;
  const count=t.match(/^(\d+) (HITS?|CRITS?|HOSTILES DOWN|FIGHTERS?)$/i);
  if(count){const unit=phrase(count[2]);return count[1]+' '+unit;}
  // Production HUD cooldown/charges strings are constructed at runtime;
  // translate display units without touching authoritative timing values.
  const cooldown=t.match(/^([0-9]+(?:[.,][0-9]+)?)S COOLDOWN$/i);
  if(cooldown)return 'HỒI CHIÊU '+cooldown[1].replace('.',',')+'s';
  const charges=t.match(/^(\d+) CHARGES · ([0-9]+(?:[.,][0-9]+)?)S RECHARGE$/i);
  if(charges)return charges[1]+' LẦN · NẠP '+charges[2].replace('.',',')+'s';
  const active=t.match(/^([0-9]+(?:[.,][0-9]+)?)S ACTIVE · ([0-9]+(?:[.,][0-9]+)?)S CD$/i);
  if(active)return 'HIỆU LỰC '+active[1].replace('.',',')+'s · HỒI '+active[2].replace('.',',')+'s';
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
  const original=match[2];
  if(language==='vie')return match[1]+phrase(original)+match[3];

  // Only recognized UI patterns: never machine-translate player names, IDs or
  // uncontrolled text. Format numeric values exactly as the game provides them.

  // Generated accessibility and award-condition labels in native Result Gold:
  // convert only known Vietnamese grammar, preserving player names and metrics.
  const metricParts=original.split(' · ');
  const translatedParts=metricParts.map(part=>{
    const condition=part.match(/^(.+?)(:\s*|\s+)([≥≤])\s*([0-9.,-]+)(?:\s+(.+))?$/u);
    if(!condition)return part;
    const label=VIETNAMESE_UI_EN[condition[1]];
    if(!label)return part;
    const unit=condition[5]?(VIETNAMESE_UI_EN[condition[5]]||condition[5]):'';
    return label+condition[2]+condition[3]+' '+condition[4]+(unit?' '+unit:'');
  });
  if(translatedParts.some((p,i)=>p!==metricParts[i]))return match[1]+translatedParts.join(' · ')+match[3];
  const requirement=original.match(/^yêu cầu\s+([≥≤])\s*(.+)$/u);
  if(requirement)return match[1]+'required '+requirement[1]+' '+requirement[2]+match[3];
  const rack=original.match(/^(\d+)\s+danh hiệu của (.+)\. Bấm vào huy hiệu để xem chi tiết\.$/u);
  if(rack)return match[1]+rack[1]+' achievements earned by '+rack[2]+'. Select a badge to view details.'+match[3];
  const rackHeading=original.match(/^Danh hiệu của (.+)$/u);
  if(rackHeading)return match[1]+'Achievements earned by '+rackHeading[1]+match[3];
  const fixtureBad=original.match(/^có (\d+) lỗi$/u);
  if(fixtureBad)return match[1]+fixtureBad[1]+' issues found'+match[3];
  const fixtureGood=original.match(/^nhất quán · ([0-9]+)\/([0-9]+) kiểm tra$/u);
  if(fixtureGood)return match[1]+'consistent · '+fixtureGood[1]+'/'+fixtureGood[2]+' checks'+match[3];

  const rarity=original.match(/^Độ hiếm\s+(.+)$/u);
  if(rarity)return match[1]+'Rarity '+(VIETNAMESE_UI_EN[rarity[1]]||rarity[1])+match[3];
  const contribution=original.match(/^Đóng góp cao nhất:\s*(.+)$/u);
  if(contribution)return match[1]+'Top contributor: '+contribution[1]+match[3];
  const detail=original.match(/^Xem chi tiết:\s*(.+),\s*(Thường|Hiếm|Sử Thi|Huyền Thoại)$/u);
  if(detail)return match[1]+'View details: '+(VIETNAMESE_UI_EN[detail[1]]||detail[1])+', '+VIETNAMESE_UI_EN[detail[2]]+match[3];
  const verdict=original.match(/^(Player\s+\d+:\s*.+?)\s+—\s+(chiến thắng|thất bại)$/u);
  if(verdict)return match[1]+verdict[1]+' — '+VIETNAMESE_UI_EN[verdict[2]]+match[3];
  const comparison=original.match(/^(.+?) gây ([0-9.,]+) sát thương, chiếm ([0-9.,]+)%. (.+?) gây ([0-9.,]+) sát thương, chiếm ([0-9.,]+)%\.$/u);
  if(comparison)return match[1]+comparison[1]+' dealt '+comparison[2]+' damage ('+comparison[3]+'%). '+comparison[4]+' dealt '+comparison[5]+' damage ('+comparison[6]+'%).'+match[3];
  const numeric=original.match(/^(\d+(?:[.,]\d+)?)\s+(lần|giây|lượt|món|chuỗi)$/u);
  if(numeric)return match[1]+numeric[1]+' '+(VIETNAMESE_UI_EN[numeric[2]]||numeric[2])+match[3];

  const reverse=VIETNAMESE_DIALOGUE_EN[original]||VIETNAMESE_UI_EN[original]||englishAwardRule(original);
  if(reverse)return match[1]+reverse+match[3];
  const parts=original.split(/(\s+\/\/\s+|\s+·\s+|\s+\|\s+)/);
  if(parts.length>1)return match[1]+parts.map((p,i)=>i%2?p:(VIETNAMESE_UI_EN[p]||p)).join('')+match[3];
  return input;
}
