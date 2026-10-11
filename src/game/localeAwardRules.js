// Display-only rule localization based on the exact immutable owner 50-slot catalog.
// Never changes award IDs, thresholds, or telemetry conditions.
export const AWARD_RULE_TEMPLATES=Object.freeze([
  {
    "id": "no-escape",
    "vi": "Tạo một chuỗi sát thương thực tế ≥ {damage} DMG; khoảng cách giữa các lần gây damage không quá {gap} giây.",
    "en": "Deal at least {damage} actual damage in one chain, with no more than {gap} seconds between hits."
  },
  {
    "id": "first-blood",
    "vi": "Là bên đầu tiên gây ra lượng sát thương thực tế lớn hơn 0 lên đối thủ.",
    "en": "Be the first to deal actual damage to the opponent."
  },
  {
    "id": "overkill",
    "vi": "Gây ≥ {hit} DMG thực tế trong một lần trúng đích.",
    "en": "Deal at least {hit} actual damage in a single hit."
  },
  {
    "id": "burst-king",
    "vi": "Gây ≥ {damage} DMG thực trong một cửa sổ trượt {window} giây.",
    "en": "Deal at least {damage} actual damage within a rolling {window}-second window."
  },
  {
    "id": "relentless",
    "vi": "Gây damage thành công {hits} lần liên tục; giữa các lần không được gián đoạn quá {gap} giây.",
    "en": "Land {hits} consecutive damaging hits with no more than {gap} seconds between them."
  },
  {
    "id": "executioner",
    "vi": "Tung đòn kết liễu khi đối thủ trước đòn đánh còn ≤ {hp} % HP tối đa.",
    "en": "Deliver the finishing blow while the opponent has at most {hp}% of maximum HP remaining."
  },
  {
    "id": "glass-cannon",
    "vi": "Gây ít nhất {ratio} lần damage đã nhận, đồng thời tổng damage gây ra ≥ {min} DMG.",
    "en": "Deal at least {ratio} times the damage you take, and at least {min} total damage."
  },
  {
    "id": "bullet-storm",
    "vi": "Có ít nhất {triggers} lượt bóp cò vũ khí tầm xa gây trúng đích.",
    "en": "Land at least {triggers} ranged-weapon trigger pulls."
  },
  {
    "id": "sure-shot",
    "vi": "Tỷ lệ lượt bắn trúng ≥ {accuracy} %, với tối thiểu {shots} lượt bắn hợp lệ.",
    "en": "Achieve at least {accuracy}% shot accuracy across at least {shots} valid shots."
  },
  {
    "id": "assassin",
    "vi": "Tỷ lệ crit ≥ {crit} % trên ít nhất {hits} lượt trúng có khả năng crit.",
    "en": "Reach a critical-hit rate of at least {crit}% across {hits} crit-eligible hits."
  },
  {
    "id": "eagle-eye",
    "vi": "Gây ≥ {damage} DMG từ khoảng cách ít nhất {distance} đơn vị đấu trường.",
    "en": "Deal at least {damage} damage from a distance of at least {distance} arena units."
  },
  {
    "id": "steady-hand",
    "vi": "Có chuỗi ≥ {streak} lượt bắn tầm xa liên tiếp trúng mục tiêu.",
    "en": "Land at least {streak} consecutive ranged shots."
  },
  {
    "id": "point-blank",
    "vi": "Gây ≥ {damage} DMG khi khoảng cách tới đối thủ ≤ {distance} đơn vị arena.",
    "en": "Deal at least {damage} damage from within {distance} arena units of the opponent."
  },
  {
    "id": "final-round",
    "vi": "Hạ gục đối thủ bằng lượt bắn cuối cùng của một vũ khí có số lượt bắn hữu hạn.",
    "en": "Defeat the opponent with the last available shot from a limited-ammo weapon."
  },
  {
    "id": "ricochet",
    "vi": "Có ít nhất {hits} lần ném vũ khí trúng mục tiêu sau khi vũ khí nảy tường.",
    "en": "Hit the target with a thrown weapon after a wall bounce at least {hits} times."
  },
  {
    "id": "mastery-shotgun",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí family SHOTGUN hoặc AUTOSHOT.",
    "en": "Deal at least {damage} damage with SHOTGUN or AUTOSHOT family weapons."
  },
  {
    "id": "mastery-auto",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí family AUTO.",
    "en": "Deal at least {damage} damage with AUTO family weapons."
  },
  {
    "id": "mastery-burst",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí family BURST.",
    "en": "Deal at least {damage} damage with BURST family weapons."
  },
  {
    "id": "mastery-precision",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí family PRECISION.",
    "en": "Deal at least {damage} damage with PRECISION family weapons."
  },
  {
    "id": "mastery-semi",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí family SEMI.",
    "en": "Deal at least {damage} damage with SEMI family weapons."
  },
  {
    "id": "mastery-melee",
    "vi": "Gây ≥ {damage} DMG bằng vũ khí cận chiến thật của Arsenal.",
    "en": "Deal at least {damage} damage using genuine Arsenal melee weapons."
  },
  {
    "id": "weapon-swap",
    "vi": "Sau khi nhặt một vũ khí, gây damage bằng nó trong ≤ {delay} giây; thực hiện {count} lần trong trận.",
    "en": "Deal damage within {delay} seconds of picking up a weapon, at least {count} times in the match."
  },
  {
    "id": "arsenal",
    "vi": "Gây damage bằng ít nhất {weapons} Weapon ID khác nhau trong trận.",
    "en": "Deal damage using at least {weapons} different weapon IDs in one match."
  },
  {
    "id": "legend-survivor",
    "vi": "Hồi phục tổng cộng ≥ {healing} HP thực trong một trận.",
    "en": "Recover at least {healing} actual HP in one match."
  },
  {
    "id": "iron-wall",
    "vi": "Ngăn chặn ≥ {blocked} DMG nhờ cơ chế giảm/hấp thụ damage của Fighter.",
    "en": "Prevent at least {blocked} damage through Fighter mitigation or absorption."
  },
  {
    "id": "last-stand",
    "vi": "Giành chiến thắng với HP còn lại ≤ {hp} % HP tối đa.",
    "en": "Win the match with at most {hp}% of your maximum HP remaining."
  },
  {
    "id": "untouchable",
    "vi": "Thắng sau ít nhất {duration} giây giao đấu, với tổng damage nhận vào ≤ {taken} DMG.",
    "en": "Win after at least {duration} seconds of combat while taking no more than {taken} damage."
  },
  {
    "id": "scavenger",
    "vi": "Nhặt ≥ {pickups} vật phẩm trên sàn trong trận.",
    "en": "Pick up at least {pickups} floor items in one match."
  },
  {
    "id": "second-wind",
    "vi": "Sau khi HP tụt xuống ≤ {danger} %, hồi thực ≥ {heal} HP trước khi trận kết thúc.",
    "en": "After dropping to {danger}% HP or lower, recover at least {heal} actual HP before the match ends."
  },
  {
    "id": "thick-skin",
    "vi": "Chịu tổng cộng ≥ {taken} DMG thực tế rồi vẫn thắng trận.",
    "en": "Take at least {taken} actual damage and still win."
  },
  {
    "id": "one-breath",
    "vi": "Sau khi HP chạm ≤ {hp} %, vẫn sống thêm ít nhất {seconds} giây.",
    "en": "Survive at least {seconds} more seconds after your HP reaches {hp}% or lower."
  },
  {
    "id": "comeback",
    "vi": "Giành chiến thắng sau khi từng bị dẫn trước ít nhất {deficit} HP.",
    "en": "Win after previously trailing the opponent by at least {deficit} HP."
  },
  {
    "id": "pacifist",
    "vi": "Có một đoạn ≥ {seconds} giây không gây damage, đồng thời di chuyển được ≥ {travel} px trong đoạn đó.",
    "en": "Go at least {seconds} seconds without dealing damage while traveling at least {travel} pixels."
  },
  {
    "id": "skill-focus",
    "vi": "Sử dụng thành công ít nhất {casts} lần kỹ năng trong trận.",
    "en": "Successfully use a skill at least {casts} times in the match."
  },
  {
    "id": "kiter",
    "vi": "Gây ≥ {damage} DMG khi tốc độ di chuyển tại thời điểm gây damage ≥ {speed} px/s.",
    "en": "Deal at least {damage} damage while moving at {speed} pixels per second or faster."
  },
  {
    "id": "trickster",
    "vi": "Có {followups} lần gây damage trong vòng {window} giây sau khi gây hiệu ứng đẩy, khống chế hoặc tước súng thành công.",
    "en": "Deal follow-up damage {followups} times within {window} seconds of a successful push, crowd-control effect, or disarm."
  },
  {
    "id": "cooldown-king",
    "vi": "Kích hoạt skill trong vòng {delay} giây kể từ khi skill sẵn sàng, ít nhất {casts} lần.",
    "en": "Activate a skill within {delay} seconds of becoming ready, at least {casts} times."
  },
  {
    "id": "combo-artist",
    "vi": "Có {chains} chuỗi mà skill và súng đều gây damage trong cùng cửa sổ {window} giây.",
    "en": "Execute {chains} chains in which a skill and a weapon both deal damage within {window} seconds."
  },
  {
    "id": "adrenaline",
    "vi": "Gây ≥ {damage} DMG khi HP bản thân ≤ {hp} % tối đa.",
    "en": "Deal at least {damage} damage while at {hp}% maximum HP or lower."
  },
  {
    "id": "clutch",
    "vi": "Gây ≥ {damage} DMG trong {window} giây cuối trước khi trận kết thúc.",
    "en": "Deal at least {damage} damage during the final {window} seconds of the match."
  },
  {
    "id": "never-surrender",
    "vi": "Gây ≥ {damage} DMG trong những thời điểm HP bản thân thấp hơn HP đối thủ.",
    "en": "Deal at least {damage} damage while your HP is lower than the opponent's."
  },
  {
    "id": "speed-win",
    "vi": "Giành chiến thắng khi tổng thời lượng trận ≤ {time} giây.",
    "en": "Win a match lasting no longer than {time} seconds."
  },
  {
    "id": "fate-hand",
    "vi": "Kết liễu đối thủ bằng một vũ khí vừa nhặt trong ≤ {delay} giây trước đó.",
    "en": "Finish the opponent with a weapon picked up no more than {delay} seconds earlier."
  },
  {
    "id": "chaos-bringer",
    "vi": "Trong {window} giây, gây damage từ ≥ {sources} Weapon ID khác nhau VÀ ít nhất một kỹ năng.",
    "en": "Within {window} seconds, deal damage using at least {sources} weapon IDs and at least one skill."
  },
  {
    "id": "signature-newbot",
    "vi": "Kích hoạt hiệu ứng giảm hồi chiêu của Rolling Burst trong ít nhất {cycles} chu kỳ kỹ năng khác nhau.",
    "en": "Trigger Rolling Burst cooldown reduction across at least {cycles} distinct skill cycles."
  },
  {
    "id": "signature-hunter",
    "vi": "Kẹp trúng đối thủ và gây sát thương tiếp nối trong {window} giây, ít nhất {traps} lần.",
    "en": "Trap the opponent and land follow-up damage within {window} seconds, at least {traps} times."
  },
  {
    "id": "signature-crystala",
    "vi": "Gây ≥ {damage} DMG thực tế bằng bộ kỹ năng tinh thể của Crystala.",
    "en": "Deal at least {damage} actual damage with Crystala's crystal skills."
  },
  {
    "id": "signature-magnet",
    "vi": "Dùng Attraction kéo súng, tự nhặt rồi gây ≥ {damage} DMG thực tế bằng khẩu súng đó.",
    "en": "Use Attraction to pull and pick up a gun, then deal at least {damage} actual damage with it."
  },
  {
    "id": "signature-frost",
    "vi": "Làm mới thời gian đóng băng bằng Frozen Bullets ít nhất {refreshes} lần.",
    "en": "Refresh freeze duration using Frozen Bullets at least {refreshes} times."
  },
  {
    "id": "signature-mirror",
    "vi": "Dùng phản chiếu gây ≥ {damage} DMG thực tế lên đối thủ bằng đòn tấn công của họ.",
    "en": "Reflect the opponent's own attack back for at least {damage} actual damage."
  },
  {
    "id": "overkill-current",
    "vi": "Gây ≥ {hit} DMG thực tế trong cửa sổ 0,1 giây.",
    "en": "Deal at least {hit} actual damage within a 0.1-second window."
  },
  {
    "id": "magnet-current",
    "vi": "Trong cùng một lần Attraction, kéo và nhặt các súng hợp lệ rồi gây tổng ≥ {damage} DMG bằng TẤT CẢ những súng đó.",
    "en": "During one Attraction use, pull and collect eligible guns, then deal at least {damage} total damage using ALL those collected guns."
  }
]);
const matchers=AWARD_RULE_TEMPLATES.map(({vi,en})=>{
  const slots=[];
  const source=vi.replace(/\{([a-zA-Z0-9_-]+)\}/g,(_m,key)=>'\u0000'+key+'\u0000');
  const re=source.split(/(\u0000[^\u0000]+\u0000)/g).map(chunk=>{
    if(chunk.startsWith('\u0000')&&chunk.endsWith('\u0000')){slots.push(chunk.slice(1,-1));return '([0-9]+(?:[.,][0-9]+)?)';}
    return chunk.replace(/[.*+?^$\u007b\u007d()|[\]\\]/g,'\\$&');
  }).join('');
  return {re:new RegExp('^'+re+'$','u'),slots,en};
});
export function englishAwardRule(v){
  if(typeof v!=='string')return null;
  for(const {re,slots,en} of matchers){
    const m=v.match(re);if(!m)continue;
    const values=Object.fromEntries(slots.map((k,i)=>[k,m[i+1]]));
    return en.replace(/\{([a-zA-Z0-9_-]+)\}/g,(_m,k)=>values[k]??'{'+k+'}');
  }
  return null;
}
