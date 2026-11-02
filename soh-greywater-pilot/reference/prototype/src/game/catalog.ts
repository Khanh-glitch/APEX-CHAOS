// Runtime catalogs. Numbers = TUNABLE_BALANCE; mechanisms flagged where PROPOSED_MECHANISM.
export type Mat = 'wood' | 'stone' | 'ore' | 'plant' | 'scrap';
export interface ItemDef {
  name: string; cat: string; icon: string; c1: string; c2: string; w: number; max: number; desc: string;
  power?: Partial<Record<Mat, number>>; dmg?: number; reach?: number; arc?: number; swing?: number; dur?: number;
  food?: { hunger?: number; thirst?: number; hp?: number; warmth?: number; rad?: number; stamina?: number };
  slot?: 'head' | 'body' | 'back'; armor?: number; cold?: number; mask?: boolean; fuel?: number; charge?: number;
  core?: string; specimen?: string; place?: string; light?: number; ranged?: string;
}
const I = (d: ItemDef) => d;
export const ITEMS: Record<string, ItemDef> = {
  // resources
  wood: I({ name: 'Wood', cat: 'res', icon: 'log', c1: '#8a5a32', c2: '#c9935a', w: 1, max: 60, desc: 'Split timber. Fuel, tools, walls.', fuel: 20 }),
  stone: I({ name: 'Stone', cat: 'res', icon: 'stone', c1: '#7d8088', c2: '#b9bcc4', w: 1.2, max: 60, desc: 'Rough stone. Foundations, furnaces, tools.' }),
  fiber: I({ name: 'Plant Fiber', cat: 'res', icon: 'fiber', c1: '#5d8a3a', c2: '#a5d65e', w: 0.2, max: 80, desc: 'Grass and reed fiber. Rope, thatch, bandages.', fuel: 4 }),
  iron_ore: I({ name: 'Iron Ore', cat: 'res', icon: 'ore', c1: '#6b5a52', c2: '#d08a5a', w: 2, max: 40, desc: 'Smelt in a fueled furnace.' }),
  coal: I({ name: 'Coal', cat: 'res', icon: 'ore', c1: '#25252c', c2: '#55556a', w: 1, max: 40, desc: 'Dense fuel. Burns long.', fuel: 80 }),
  charcoal: I({ name: 'Charcoal', cat: 'res', icon: 'ore', c1: '#2b2420', c2: '#6e5a4c', w: 0.5, max: 60, desc: 'Fuel made from burnt wood.', fuel: 55 }),
  crystal: I({ name: 'Frost Crystal', cat: 'res', icon: 'gem', c1: '#4fa6d8', c2: '#c8f0ff', w: 0.5, max: 30, desc: 'Cold-grown crystal from the north. Core synthesis.' }),
  sulfur: I({ name: 'Sulfur', cat: 'res', icon: 'ore', c1: '#b59a1e', c2: '#f2e05a', w: 0.5, max: 40, desc: 'Volcanic sulfur. Volatile.' }),
  scrap: I({ name: 'Scrap Metal', cat: 'res', icon: 'scrap', c1: '#6f7378', c2: '#c0a07a', w: 1, max: 60, desc: 'Salvage from wrecks. Melts into iron.' }),
  spares: I({ name: 'Spares', cat: 'res', icon: 'gear', c1: '#8a8f96', c2: '#e2c25a', w: 0.3, max: 60, desc: 'Run-local components. Research currency and advanced parts.' }),
  iron_ingot: I({ name: 'Iron Ingot', cat: 'res', icon: 'ingot', c1: '#7a8696', c2: '#dfe6ee', w: 1, max: 40, desc: 'Smelted iron.' }),
  rope: I({ name: 'Rope', cat: 'res', icon: 'rope', c1: '#9a7a44', c2: '#d8bb78', w: 0.3, max: 30, desc: 'Twisted fiber.' }),
  hide: I({ name: 'Raw Hide', cat: 'res', icon: 'hide', c1: '#7a4e34', c2: '#b88a62', w: 0.8, max: 30, desc: 'Cure at a workbench into leather.' }),
  leather: I({ name: 'Leather', cat: 'res', icon: 'hide', c1: '#5a3a22', c2: '#9c6a3e', w: 0.6, max: 30, desc: 'Cured leather.' }),
  fur: I({ name: 'Wolf Fur', cat: 'res', icon: 'hide', c1: '#8e95a0', c2: '#e1e6ee', w: 0.6, max: 30, desc: 'Warm pelt.' }),
  chitin: I({ name: 'Ash Chitin', cat: 'res', icon: 'shell', c1: '#3a2a2a', c2: '#c0503a', w: 0.8, max: 30, desc: 'Heat-hardened shell plate.' }),
  shell: I({ name: 'Crab Shell', cat: 'res', icon: 'shell', c1: '#b4502e', c2: '#f0a070', w: 0.5, max: 30, desc: 'Curved shell.' }),
  gland: I({ name: 'Mire Gland', cat: 'res', icon: 'berry', c1: '#5a7a2a', c2: '#c8e070', w: 0.2, max: 20, desc: 'Toad gland. Purges toxins.' }),
  brick: I({ name: 'Brick', cat: 'res', icon: 'ingot', c1: '#8e4a36', c2: '#d48466', w: 1, max: 40, desc: 'Fired stone brick.' }),
  cloth: I({ name: 'Cloth', cat: 'res', icon: 'cloth', c1: '#7a6e9a', c2: '#c8c0e0', w: 0.3, max: 30, desc: 'Woven fiber cloth.' }),
  glass: I({ name: 'Glass', cat: 'res', icon: 'gem', c1: '#6fb0a8', c2: '#e0fff8', w: 0.4, max: 30, desc: 'Fused crystal and sand-glass.' }),
  seed: I({ name: 'Wild Seeds', cat: 'res', icon: 'seed', c1: '#7a6a3a', c2: '#d8c070', w: 0.05, max: 40, desc: 'Plant in a garden plot.' }),
  // food
  berries: I({ name: 'Berries', cat: 'food', icon: 'berry', c1: '#7a1e3a', c2: '#e05a7a', w: 0.1, max: 30, desc: 'Sweet and watery.', food: { hunger: 8, thirst: 4 } }),
  meat: I({ name: 'Raw Meat', cat: 'food', icon: 'meat', c1: '#8e2a2a', c2: '#e07a7a', w: 0.5, max: 20, desc: 'Risky raw. Cook at a campfire.', food: { hunger: 12, hp: -6 } }),
  cooked_meat: I({ name: 'Roast Meat', cat: 'food', icon: 'meat', c1: '#6a3a1e', c2: '#d0904a', w: 0.4, max: 20, desc: 'Hearty and warm.', food: { hunger: 34, hp: 6, warmth: 8 } }),
  mushroom: I({ name: 'Marsh Cap', cat: 'food', icon: 'mush', c1: '#6a4a8a', c2: '#d0a0f0', w: 0.1, max: 20, desc: 'Edible. Slightly toxic raw.', food: { hunger: 6, rad: 4 } }),
  herb: I({ name: 'Bitterleaf', cat: 'food', icon: 'herb', c1: '#2e6a3a', c2: '#7ad08a', w: 0.1, max: 30, desc: 'Medicinal herb.', food: { hp: 6, rad: -6 } }),
  crop: I({ name: 'Sunroot', cat: 'food', icon: 'crop', c1: '#b0601e', c2: '#f0b050', w: 0.3, max: 30, desc: 'Garden-grown tuber.', food: { hunger: 22, thirst: 6 } }),
  stew: I({ name: 'Root Stew', cat: 'food', icon: 'bowl', c1: '#6a3a1e', c2: '#e0a050', w: 0.5, max: 10, desc: 'Hot stew. Warms and feeds.', food: { hunger: 45, thirst: 20, hp: 10, warmth: 25 } }),
  water_flask: I({ name: 'Water Flask', cat: 'food', icon: 'flask', c1: '#3a6aa0', c2: '#9ad0ff', w: 0.6, max: 1, desc: 'Holds 4 drinks. Refill at fresh water or a rain barrel.', food: { thirst: 30 }, charge: 4 }),
  bandage: I({ name: 'Bandage', cat: 'food', icon: 'cloth', c1: '#c0b8a8', c2: '#fff8e8', w: 0.1, max: 20, desc: 'Stops bleeding.', food: { hp: 18 } }),
  medkit: I({ name: 'Field Medkit', cat: 'food', icon: 'kit', c1: '#a03030', c2: '#f0e0e0', w: 0.4, max: 10, desc: 'Herbal dressing.', food: { hp: 45 } }),
  antirad: I({ name: 'Purge Tonic', cat: 'food', icon: 'flask', c1: '#4a7a1e', c2: '#c8f070', w: 0.3, max: 10, desc: 'Flushes radiation.', food: { rad: -45, thirst: 5 } }),
  // tools & weapons
  knife: I({ name: 'Survival Knife', cat: 'tool', icon: 'knife', c1: '#9aa4b0', c2: '#5a3a22', w: 0.5, max: 1, desc: 'Humble but honest. Cuts fiber and flesh; slow on wood.', power: { wood: 1, plant: 3, scrap: 1 }, dmg: 9, reach: 20, arc: 1.3, swing: 300, dur: 300 }),
  stone_axe: I({ name: 'Stone Axe', cat: 'tool', icon: 'axe', c1: '#8a8a90', c2: '#7a5a32', w: 1.4, max: 1, desc: 'Fells trees. Clumsy weapon.', power: { wood: 3, plant: 1, scrap: 1 }, dmg: 11, reach: 22, arc: 1.5, swing: 420, dur: 180 }),
  stone_pick: I({ name: 'Stone Pickaxe', cat: 'tool', icon: 'pick', c1: '#8a8a90', c2: '#7a5a32', w: 1.5, max: 1, desc: 'Breaks stone and ore. Pries scrap.', power: { stone: 3, ore: 2, scrap: 2 }, dmg: 10, reach: 22, arc: 1.2, swing: 450, dur: 180 }),
  iron_axe: I({ name: 'Iron Axe', cat: 'tool', icon: 'axe', c1: '#c8d0dc', c2: '#5a3a22', w: 1.6, max: 1, desc: 'Bites deep into timber.', power: { wood: 6, plant: 2, scrap: 2 }, dmg: 17, reach: 23, arc: 1.5, swing: 400, dur: 400 }),
  iron_pick: I({ name: 'Iron Pickaxe', cat: 'tool', icon: 'pick', c1: '#c8d0dc', c2: '#5a3a22', w: 1.7, max: 1, desc: 'Shatters rock and veins.', power: { stone: 6, ore: 5, scrap: 4 }, dmg: 15, reach: 23, arc: 1.2, swing: 430, dur: 400 }),
  wood_spear: I({ name: 'Fire-hardened Spear', cat: 'weapon', icon: 'spear', c1: '#c9935a', c2: '#e0e0e0', w: 1, max: 1, desc: 'Long reach, narrow thrust.', power: { plant: 1 }, dmg: 15, reach: 34, arc: 0.45, swing: 380, dur: 150 }),
  iron_sword: I({ name: 'Iron Sword', cat: 'weapon', icon: 'sword', c1: '#dfe6ee', c2: '#7a4a2a', w: 1.4, max: 1, desc: 'Fast, wide cuts.', power: { plant: 2 }, dmg: 24, reach: 26, arc: 1.7, swing: 330, dur: 350 }),
  bow: I({ name: 'Hunting Bow', cat: 'weapon', icon: 'bow', c1: '#8a5a32', c2: '#e0d8c0', w: 0.8, max: 1, desc: 'Fires arrows toward the cursor.', dmg: 16, reach: 220, swing: 520, dur: 200, ranged: 'arrow' }),
  arrow: I({ name: 'Arrow', cat: 'res', icon: 'arrow', c1: '#8a5a32', c2: '#c0c0c8', w: 0.05, max: 60, desc: 'Ammunition for bows.' }),
  torch: I({ name: 'Torch', cat: 'tool', icon: 'torch', c1: '#7a5a32', c2: '#ffb040', w: 0.4, max: 10, desc: 'Light in the dark. Weak weapon; can ignite.', dmg: 6, reach: 18, arc: 1.2, swing: 320, dur: 120, light: 72 }),
  // armor
  leather_armor: I({ name: 'Leather Jerkin', cat: 'armor', icon: 'armor', c1: '#6a4226', c2: '#a8764a', w: 2, max: 1, desc: '-20% damage.', slot: 'body', armor: 0.2, cold: 4 }),
  chitin_armor: I({ name: 'Chitin Plate', cat: 'armor', icon: 'armor', c1: '#3a2a2a', c2: '#c0503a', w: 3, max: 1, desc: '-35% damage. Resists heat.', slot: 'body', armor: 0.35 }),
  fur_cloak: I({ name: 'Fur Cloak', cat: 'armor', icon: 'cloak', c1: '#8e95a0', c2: '#e1e6ee', w: 1.2, max: 1, desc: 'Keeps the cold out.', slot: 'back', cold: 18 }),
  gas_mask: I({ name: 'Filter Mask', cat: 'armor', icon: 'mask', c1: '#4a5a4a', c2: '#a0b0a0', w: 0.8, max: 1, desc: 'Blocks most radiation and toxic gas.', slot: 'head', mask: true }),
  scrap_helm: I({ name: 'Scrap Helm', cat: 'armor', icon: 'helm', c1: '#6f7378', c2: '#c0a07a', w: 1, max: 1, desc: '-10% damage.', slot: 'head', armor: 0.1 }),
  // cores (charged; usable immediately without recipe — LOCKED_CANON)
  core_fire: I({ name: 'Ember Core', cat: 'core', icon: 'core', c1: '#c0381e', c2: '#ffd070', w: 0.3, max: 1, desc: 'Hurls a fireball that ignites trees and grass. Charge spent on release.', core: 'fire', charge: 3 }),
  core_earth: I({ name: 'Quake Core', cat: 'core', icon: 'core', c1: '#7a5a32', c2: '#e0c080', w: 0.3, max: 1, desc: 'Raises a spike line that shatters rocks into yield.', core: 'earth', charge: 3 }),
  core_storm: I({ name: 'Storm Core', cat: 'core', icon: 'core', c1: '#3a4ac0', c2: '#c0e0ff', w: 0.3, max: 1, desc: 'Chain lightning. Stronger in rain.', core: 'storm', charge: 4 }),
  core_frost: I({ name: 'Rime Core', cat: 'core', icon: 'core', c1: '#2a8ab0', c2: '#e0ffff', w: 0.3, max: 1, desc: 'Frost nova; freezes shallow water into walkable ice for a while.', core: 'frost', charge: 3 }),
  // knowledge
  blueprint: I({ name: 'Blueprint', cat: 'bp', icon: 'scroll', c1: '#3a5a8a', c2: '#e0e8f0', w: 0.05, max: 1, desc: 'Use to learn the recipe it describes. Consumed once.' }),
  wolf_fang: I({ name: 'Wolf Fang (specimen)', cat: 'res', icon: 'fang', c1: '#d0c8b0', c2: '#fff', w: 0.1, max: 10, desc: 'Study at a research table.', specimen: 'fur_cloak' }),
  crawler_optic: I({ name: 'Crawler Optic (specimen)', cat: 'res', icon: 'gem', c1: '#a01e1e', c2: '#ff8a6a', w: 0.1, max: 10, desc: 'Study at a research table.', specimen: 'gas_mask' }),
  boar_tusk: I({ name: 'Boar Tusk (specimen)', cat: 'res', icon: 'fang', c1: '#c0a070', c2: '#fff0d0', w: 0.1, max: 10, desc: 'Study at a research table.', specimen: 'iron_sword' }),
  beetle_horn: I({ name: 'Beetle Horn (specimen)', cat: 'res', icon: 'fang', c1: '#5a2a1e', c2: '#e06a3a', w: 0.1, max: 10, desc: 'Study at a research table.', specimen: 'chitin_armor' }),
  keycard: I({ name: 'Vault Keycard', cat: 'misc', icon: 'card', c1: '#2a6a5a', c2: '#a0f0d0', w: 0.05, max: 5, desc: 'Opens a sealed industrial door. Consumed.' }),
  fuel_can: I({ name: 'Fuel Canister', cat: 'misc', icon: 'can', c1: '#a03a1e', c2: '#f0c060', w: 1.5, max: 5, desc: 'Powers generators.', fuel: 60 }),
  // Ragnarok & profile
  rcash: I({ name: 'Ragnarok Cash', cat: 'cash', icon: 'coin', c1: '#b07a1e', c2: '#ffe27a', w: 0.01, max: 999, desc: 'Physical, unsecured. Can be lost. Deposit in an owned Rương ký gửi.' }),
  escrow_chest: I({ name: 'Rương ký gửi', cat: 'kit', icon: 'chest', c1: '#5a3a7a', c2: '#ffd040', w: 4, max: 1, desc: 'Escrow chest. Place on owned land, then deposit physical Ragnarok cash into your profile.', place: 'escrow' }),
  cart_kit: I({ name: 'Hand Cart (packed)', cat: 'kit', icon: 'cart', c1: '#7a5a32', c2: '#c0c8d0', w: 6, max: 1, desc: 'Place to unpack a cargo cart.', place: 'cart' }),
  // elder stones (unique per run)
  stone_frost: I({ name: 'Stone of Rime', cat: 'stone', icon: 'relic', c1: '#3a8ad0', c2: '#e0ffff', w: 1, max: 1, desc: 'Taken from the Glacier Matron.' }),
  stone_magma: I({ name: 'Stone of Cinder', cat: 'stone', icon: 'relic', c1: '#c03a1e', c2: '#ffd070', w: 1, max: 1, desc: 'Taken from the Caldera Titan.' }),
  stone_bog: I({ name: 'Stone of Mire', cat: 'stone', icon: 'relic', c1: '#4a7a2a', c2: '#d0f080', w: 1, max: 1, desc: 'Taken from the Mire Mother.' }),
  stone_grove: I({ name: 'Stone of Roots', cat: 'stone', icon: 'relic', c1: '#2a6a2a', c2: '#a0e070', w: 1, max: 1, desc: 'Taken from the Elder Treant.' }),
  stone_tide: I({ name: 'Stone of Tides', cat: 'stone', icon: 'relic', c1: '#1e5a9a', c2: '#80e0ff', w: 1, max: 1, desc: 'Taken from the Tide Serpent.' }),
  stone_rust: I({ name: 'Stone of Rust', cat: 'stone', icon: 'relic', c1: '#8a4a1e', c2: '#f0a050', w: 1, max: 1, desc: 'Taken from the Rust Colossus.' }),
};

// ---------- Sources (K3) ----------
export interface SourceDef { name: string; mat: Mat; hp: number; stock: number; yields: [string, number][]; bonus?: [string, number][]; block: boolean; regrow?: number; art: string; tall?: boolean }
export const SOURCES: Record<string, SourceDef> = {
  oak: { name: 'Oak', mat: 'wood', hp: 18, stock: 6, yields: [['wood', 1]], bonus: [['seed', 0.25]], block: true, art: 'oak', tall: true },
  pine: { name: 'Pine', mat: 'wood', hp: 16, stock: 5, yields: [['wood', 1]], block: true, art: 'pine', tall: true },
  snowpine: { name: 'Snow Pine', mat: 'wood', hp: 16, stock: 5, yields: [['wood', 1]], block: true, art: 'snowpine', tall: true },
  palm: { name: 'Palm', mat: 'wood', hp: 12, stock: 4, yields: [['wood', 1]], bonus: [['fiber', 0.5]], block: true, art: 'palm', tall: true },
  willow: { name: 'Mire Willow', mat: 'wood', hp: 14, stock: 4, yields: [['wood', 1]], bonus: [['fiber', 0.4]], block: true, art: 'willow', tall: true },
  deadtree: { name: 'Charred Tree', mat: 'wood', hp: 8, stock: 3, yields: [['charcoal', 1]], block: true, art: 'dead', tall: true },
  rock: { name: 'Boulder', mat: 'stone', hp: 18, stock: 6, yields: [['stone', 1]], block: true, art: 'rock' },
  iron: { name: 'Iron Vein', mat: 'ore', hp: 24, stock: 5, yields: [['iron_ore', 1]], bonus: [['stone', 0.5]], block: true, art: 'iron' },
  coalv: { name: 'Coal Seam', mat: 'ore', hp: 20, stock: 5, yields: [['coal', 1]], block: true, art: 'coal' },
  crystal: { name: 'Frost Crystal', mat: 'ore', hp: 20, stock: 3, yields: [['crystal', 1]], block: true, art: 'crystal' },
  sulfur: { name: 'Sulfur Vent', mat: 'ore', hp: 14, stock: 3, yields: [['sulfur', 1]], block: true, art: 'sulfur' },
  bush: { name: 'Berry Bush', mat: 'plant', hp: 6, stock: 3, yields: [['berries', 1]], bonus: [['seed', 0.3]], block: false, regrow: 420, art: 'bush' },
  grass: { name: 'Tall Grass', mat: 'plant', hp: 3, stock: 2, yields: [['fiber', 1]], block: false, regrow: 300, art: 'grass' },
  reed: { name: 'Reeds', mat: 'plant', hp: 4, stock: 3, yields: [['fiber', 1]], block: false, regrow: 360, art: 'reed' },
  herb: { name: 'Bitterleaf', mat: 'plant', hp: 3, stock: 2, yields: [['herb', 1]], block: false, regrow: 600, art: 'herb' },
  mushroom: { name: 'Marsh Caps', mat: 'plant', hp: 3, stock: 2, yields: [['mushroom', 1]], block: false, regrow: 600, art: 'mush' },
  scrap: { name: 'Roadside Scrap', mat: 'scrap', hp: 8, stock: 4, yields: [['scrap', 1]], bonus: [['spares', 0.55]], block: false, art: 'scrap' },
  wreck: { name: 'Car Wreck', mat: 'scrap', hp: 30, stock: 8, yields: [['scrap', 1]], bonus: [['spares', 0.7], ['fuel_can', 0.06]], block: true, art: 'wreck' },
};

// ---------- Creatures (K5) ----------
export interface CreatureDef { name: string; hp: number; dmg: number; speed: number; r: number; sight: number; drops: [string, number, number][]; biome: string; style: string; tell: number; aggro: boolean; night?: boolean }
export const CREATURES: Record<string, CreatureDef> = {
  boar: { name: 'Bristleback Boar', hp: 40, dmg: 13, speed: 46, r: 6, sight: 90, drops: [['meat', 2, 1], ['hide', 1, 1], ['boar_tusk', 1, 0.3]], biome: 'meadow', style: 'charge', tell: 650, aggro: false },
  wolf: { name: 'Greyfang Wolf', hp: 30, dmg: 9, speed: 74, r: 6, sight: 120, drops: [['meat', 1, 1], ['fur', 2, 1], ['wolf_fang', 1, 0.4]], biome: 'forest', style: 'lunge', tell: 380, aggro: true },
  toad: { name: 'Mire Toad', hp: 30, dmg: 10, speed: 30, r: 6, sight: 90, drops: [['gland', 1, 1], ['meat', 1, 0.6]], biome: 'marsh', style: 'tongue', tell: 700, aggro: true },
  crawler: { name: 'Scrap Crawler', hp: 44, dmg: 8, speed: 40, r: 6, sight: 130, drops: [['spares', 2, 1], ['scrap', 2, 1], ['crawler_optic', 1, 0.35]], biome: 'toxic', style: 'shoot', tell: 600, aggro: true },
  beetle: { name: 'Cinder Beetle', hp: 52, dmg: 15, speed: 36, r: 7, sight: 100, drops: [['chitin', 2, 1], ['sulfur', 1, 0.6], ['beetle_horn', 1, 0.3]], biome: 'ash', style: 'burrow', tell: 900, aggro: true },
  crab: { name: 'Shore Crab', hp: 24, dmg: 7, speed: 42, r: 5, sight: 70, drops: [['shell', 1, 1], ['meat', 1, 0.8]], biome: 'sand', style: 'pinch', tell: 420, aggro: false },
};

// ---------- Elders (six, optional, geographically distinct) ----------
export interface ElderDef { name: string; title: string; hpLatent: number; hpAwake: number; stone: string; r: number; size: number; color: string; region: string; patterns: string[]; awakePatterns: string[]; dmg: number; speed: number }
export const ELDERS: Record<string, ElderDef> = {
  frost: { name: 'Glacier Matron', title: 'Elder of the White Crown', hpLatent: 320, hpAwake: 620, stone: 'stone_frost', r: 14, size: 40, color: '#9ad8ff', region: 'Frostcrown Peaks', dmg: 18, speed: 30, patterns: ['shardFan', 'frostRing'], awakePatterns: ['shardFan', 'frostRing', 'icePillars', 'shardSpiral'] },
  magma: { name: 'Caldera Titan', title: 'Elder of the Burning Throat', hpLatent: 380, hpAwake: 700, stone: 'stone_magma', r: 16, size: 44, color: '#ff7a3a', region: 'Caldera Wastes', dmg: 22, speed: 24, patterns: ['fissure', 'slam'], awakePatterns: ['fissure', 'slam', 'meteors', 'fissureTriple'] },
  bog: { name: 'Mire Mother', title: 'Elder of Still Water', hpLatent: 300, hpAwake: 560, stone: 'stone_bog', r: 15, size: 40, color: '#9ad050', region: 'Drowned Fen', dmg: 16, speed: 26, patterns: ['spitPools', 'brood'], awakePatterns: ['spitPools', 'brood', 'submerge', 'tongueSweep'] },
  grove: { name: 'Elder Treant', title: 'Elder of the First Wood', hpLatent: 360, hpAwake: 640, stone: 'stone_grove', r: 15, size: 44, color: '#7ad070', region: 'Oldgrowth', dmg: 18, speed: 20, patterns: ['rootLine', 'seedBombs'], awakePatterns: ['rootLine', 'seedBombs', 'rootCage', 'drainTrees'] },
  tide: { name: 'Tide Serpent', title: 'Elder of the Breaking Shore', hpLatent: 300, hpAwake: 580, stone: 'stone_tide', r: 13, size: 40, color: '#5ac8f0', region: 'Serpent Strand', dmg: 18, speed: 50, patterns: ['spit', 'wave'], awakePatterns: ['spit', 'wave', 'dive', 'whirl'] },
  rust: { name: 'Rust Colossus', title: 'Elder of the Dead Foundry', hpLatent: 400, hpAwake: 720, stone: 'stone_rust', r: 15, size: 44, color: '#f0a050', region: 'Dead Foundry', dmg: 20, speed: 22, patterns: ['beam', 'mines'], awakePatterns: ['beam', 'mines', 'beamSweep', 'overload'] },
};

// ---------- Recipes (K4: one run-local authority) ----------
export interface Recipe { out: string; qty: number; ins: [string, number][]; station: null | 'campfire' | 'furnace' | 'workbench'; secs: number; base?: boolean; tier: number }
export const RECIPES: Record<string, Recipe> = {
  rope: { out: 'rope', qty: 1, ins: [['fiber', 3]], station: null, secs: 1, base: true, tier: 0 },
  torch: { out: 'torch', qty: 1, ins: [['wood', 1], ['fiber', 2]], station: null, secs: 1, base: true, tier: 0 },
  stone_axe: { out: 'stone_axe', qty: 1, ins: [['wood', 3], ['stone', 3], ['rope', 1]], station: null, secs: 2, base: true, tier: 0 },
  stone_pick: { out: 'stone_pick', qty: 1, ins: [['wood', 3], ['stone', 4], ['rope', 1]], station: null, secs: 2, base: true, tier: 0 },
  wood_spear: { out: 'wood_spear', qty: 1, ins: [['wood', 4], ['rope', 1]], station: null, secs: 2, base: true, tier: 0 },
  bandage: { out: 'bandage', qty: 1, ins: [['fiber', 4]], station: null, secs: 1, base: true, tier: 0 },
  water_flask: { out: 'water_flask', qty: 1, ins: [['hide', 2], ['rope', 1]], station: null, secs: 2, base: true, tier: 0 },
  cooked_meat: { out: 'cooked_meat', qty: 1, ins: [['meat', 1]], station: 'campfire', secs: 8, base: true, tier: 0 },
  charcoal: { out: 'charcoal', qty: 1, ins: [['wood', 2]], station: 'campfire', secs: 12, base: true, tier: 0 },
  stew: { out: 'stew', qty: 1, ins: [['crop', 2], ['meat', 1], ['herb', 1]], station: 'campfire', secs: 14, tier: 1 },
  iron_ingot: { out: 'iron_ingot', qty: 1, ins: [['iron_ore', 1]], station: 'furnace', secs: 10, base: true, tier: 0 },
  scrap_ingot: { out: 'iron_ingot', qty: 1, ins: [['scrap', 3]], station: 'furnace', secs: 12, base: true, tier: 0 },
  brick: { out: 'brick', qty: 2, ins: [['stone', 3]], station: 'furnace', secs: 10, tier: 1 },
  glass: { out: 'glass', qty: 1, ins: [['crystal', 1], ['stone', 1]], station: 'furnace', secs: 14, tier: 2 },
  leather: { out: 'leather', qty: 1, ins: [['hide', 1]], station: 'workbench', secs: 8, base: true, tier: 0 },
  cloth: { out: 'cloth', qty: 1, ins: [['fiber', 6]], station: 'workbench', secs: 8, base: true, tier: 0 },
  arrow: { out: 'arrow', qty: 6, ins: [['wood', 1], ['stone', 1], ['fiber', 1]], station: 'workbench', secs: 5, tier: 1 },
  bow: { out: 'bow', qty: 1, ins: [['wood', 5], ['rope', 3]], station: 'workbench', secs: 12, tier: 1 },
  iron_axe: { out: 'iron_axe', qty: 1, ins: [['iron_ingot', 3], ['wood', 2], ['leather', 1]], station: 'workbench', secs: 15, base: true, tier: 1 },
  iron_pick: { out: 'iron_pick', qty: 1, ins: [['iron_ingot', 3], ['wood', 2], ['leather', 1]], station: 'workbench', secs: 15, base: true, tier: 1 },
  iron_sword: { out: 'iron_sword', qty: 1, ins: [['iron_ingot', 5], ['leather', 1]], station: 'workbench', secs: 18, tier: 2 },
  leather_armor: { out: 'leather_armor', qty: 1, ins: [['leather', 5], ['rope', 2]], station: 'workbench', secs: 15, tier: 1 },
  chitin_armor: { out: 'chitin_armor', qty: 1, ins: [['chitin', 6], ['leather', 2]], station: 'workbench', secs: 20, tier: 3 },
  fur_cloak: { out: 'fur_cloak', qty: 1, ins: [['fur', 4], ['rope', 2]], station: 'workbench', secs: 14, tier: 2 },
  gas_mask: { out: 'gas_mask', qty: 1, ins: [['glass', 1], ['cloth', 2], ['spares', 3]], station: 'workbench', secs: 16, tier: 2 },
  scrap_helm: { out: 'scrap_helm', qty: 1, ins: [['scrap', 6], ['leather', 1]], station: 'workbench', secs: 12, tier: 1 },
  medkit: { out: 'medkit', qty: 1, ins: [['bandage', 2], ['herb', 2]], station: 'workbench', secs: 8, tier: 1 },
  antirad: { out: 'antirad', qty: 1, ins: [['gland', 1], ['herb', 2], ['water_flask', 0]], station: 'workbench', secs: 10, tier: 2 },
  cart_kit: { out: 'cart_kit', qty: 1, ins: [['wood', 24], ['iron_ingot', 3], ['rope', 4]], station: 'workbench', secs: 25, tier: 1 },
  core_fire: { out: 'core_fire', qty: 1, ins: [['sulfur', 3], ['spares', 8], ['crystal', 1]], station: 'workbench', secs: 40, tier: 3 },
  core_earth: { out: 'core_earth', qty: 1, ins: [['iron_ingot', 3], ['spares', 8], ['crystal', 1]], station: 'workbench', secs: 40, tier: 3 },
  core_storm: { out: 'core_storm', qty: 1, ins: [['glass', 2], ['spares', 10], ['crystal', 1]], station: 'workbench', secs: 40, tier: 3 },
  core_frost: { out: 'core_frost', qty: 1, ins: [['crystal', 3], ['spares', 8]], station: 'workbench', secs: 40, tier: 3 },
};
// Core study → recipe (specimen-study path)
export const CORE_STUDY: Record<string, string> = { core_fire: 'core_fire', core_earth: 'core_earth', core_storm: 'core_storm', core_frost: 'core_frost' };

// ---------- Structures (K6) ----------
export interface StructDef { name: string; cost: [string, number][]; hp: number; need: 'claim' | 'any' | 'free'; block: boolean; layer: 'floor' | 'wall' | 'obj' | 'roof'; slots?: number; station?: 'campfire' | 'furnace' | 'workbench' | 'research'; light?: number; desc: string; item?: string; shelter?: boolean; warmth?: number }
export const STRUCTS: Record<string, StructDef> = {
  claim: { name: 'Claim Totem', cost: [['wood', 10], ['stone', 5]], hp: 200, need: 'free', block: true, layer: 'obj', desc: 'Claims land (radius 6) as your home plot. PROPOSED ownership mechanism.' },
  floor_wood: { name: 'Wood Floor', cost: [['wood', 4]], hp: 120, need: 'claim', block: false, layer: 'floor', desc: 'Foundation tile. Roofs need it.' },
  floor_stone: { name: 'Stone Floor', cost: [['stone', 6]], hp: 260, need: 'claim', block: false, layer: 'floor', desc: 'Sturdy foundation.' },
  wall_wood: { name: 'Wood Wall', cost: [['wood', 5]], hp: 160, need: 'claim', block: true, layer: 'wall', desc: 'Blocks movement and paths.' },
  wall_stone: { name: 'Stone Wall', cost: [['stone', 8], ['wood', 1]], hp: 380, need: 'claim', block: true, layer: 'wall', desc: 'Heavy wall.' },
  wall_brick: { name: 'Brick Wall', cost: [['brick', 6]], hp: 600, need: 'claim', block: true, layer: 'wall', desc: 'Fired brick. Strongest wall.' },
  door_wood: { name: 'Wood Door', cost: [['wood', 6], ['rope', 1]], hp: 140, need: 'claim', block: true, layer: 'wall', desc: 'E to open/close. Creatures cannot open doors.' },
  door_iron: { name: 'Iron Door', cost: [['iron_ingot', 4]], hp: 420, need: 'claim', block: true, layer: 'wall', desc: 'Reinforced door.' },
  roof_thatch: { name: 'Thatch Roof', cost: [['wood', 2], ['fiber', 5]], hp: 80, need: 'claim', block: false, layer: 'roof', desc: 'Over a floor. Enclosed + roofed = shelter.', shelter: true },
  roof_tile: { name: 'Tile Roof', cost: [['brick', 3]], hp: 200, need: 'claim', block: false, layer: 'roof', desc: 'Durable roof.', shelter: true },
  bed_straw: { name: 'Straw Bed', cost: [['fiber', 10], ['wood', 2]], hp: 60, need: 'claim', block: false, layer: 'obj', desc: 'Respawn point within this run.' },
  chest_small: { name: 'Wood Chest', cost: [['wood', 8]], hp: 100, need: 'claim', block: true, layer: 'obj', slots: 12, desc: '12-slot storage.' },
  chest_large: { name: 'Iron-bound Chest', cost: [['wood', 12], ['iron_ingot', 2]], hp: 220, need: 'claim', block: true, layer: 'obj', slots: 24, desc: '24-slot storage.' },
  campfire: { name: 'Campfire', cost: [['wood', 5], ['stone', 3]], hp: 60, need: 'any', block: true, layer: 'obj', station: 'campfire', light: 90, warmth: 1, desc: 'Cooks with fuel. Warmth + light while burning.' },
  furnace: { name: 'Furnace', cost: [['stone', 18], ['wood', 4]], hp: 300, need: 'claim', block: true, layer: 'obj', station: 'furnace', light: 50, warmth: 1, desc: 'Smelts with fuel. Output waits in its slots.' },
  workbench: { name: 'Workbench', cost: [['wood', 14], ['stone', 4]], hp: 160, need: 'claim', block: true, layer: 'obj', station: 'workbench', desc: 'Timed crafting for tools, armor and parts.' },
  research: { name: 'Research Table', cost: [['wood', 10], ['spares', 6], ['iron_ingot', 1]], hp: 160, need: 'claim', block: true, layer: 'obj', station: 'research', desc: 'Spend Spares or study specimens to unlock recipes.' },
  garden: { name: 'Garden Plot', cost: [['wood', 4], ['fiber', 4]], hp: 60, need: 'claim', block: false, layer: 'obj', desc: 'Plant seeds; grows only while watered (rain counts).' },
  barrel: { name: 'Rain Barrel', cost: [['wood', 8], ['rope', 1]], hp: 80, need: 'claim', block: true, layer: 'obj', desc: 'Collects rainwater; refill flasks.' },
  spikes: { name: 'Spike Trap', cost: [['wood', 6]], hp: 90, need: 'claim', block: false, layer: 'obj', desc: 'Hurts creatures that walk over it.' },
  barricade: { name: 'Barricade', cost: [['wood', 8]], hp: 220, need: 'claim', block: true, layer: 'obj', desc: 'Cheap blocking defense.' },
  torch_post: { name: 'Torch Post', cost: [['wood', 2], ['torch', 1]], hp: 40, need: 'claim', block: true, layer: 'obj', light: 80, desc: 'Permanent light.' },
  escrow: { name: 'Rương ký gửi', cost: [['escrow_chest', 1]], hp: 400, need: 'claim', block: true, layer: 'obj', desc: 'Deposit physical Ragnarok cash into profile-secured cash.', item: 'escrow_chest' },
};
export const BUILD_ORDER = ['claim', 'floor_wood', 'floor_stone', 'wall_wood', 'wall_stone', 'wall_brick', 'door_wood', 'door_iron', 'roof_thatch', 'roof_tile', 'bed_straw', 'chest_small', 'chest_large', 'campfire', 'furnace', 'workbench', 'research', 'garden', 'barrel', 'spikes', 'barricade', 'torch_post', 'escrow'];

// Run-2 vendor stock purchasable with SECURED profile cash (PROPOSED prices) → run-local items
export const VENDOR_SECURED: Record<string, { price: number; stock: number }> = {
  iron_pick: { price: 12, stock: 1 }, iron_axe: { price: 12, stock: 1 }, medkit: { price: 4, stock: 4 },
  cart_kit: { price: 20, stock: 1 }, leather_armor: { price: 10, stock: 1 }, water_flask: { price: 3, stock: 2 },
};
export const ACHIEVEMENTS: Record<string, { name: string; score: number }> = {
  first_home: { name: 'A Roof of One\'s Own', score: 40 }, first_ingot: { name: 'First Smelt', score: 15 },
  first_research: { name: 'Curious Mind', score: 20 }, first_core: { name: 'Core Unleashed', score: 25 },
  vault: { name: 'Into the Vault', score: 50 }, first_deposit: { name: 'Secured', score: 60 },
  evacuated: { name: 'Got Out', score: 120 }, elder_1: { name: 'Elderslayer', score: 100 },
  six_stones: { name: 'Crown of Six Stones', score: 600 }, cart: { name: 'Freight Runner', score: 20 },
  recover_bag: { name: 'Nothing Left Behind', score: 20 }, ragnarok: { name: 'Witness the End', score: 40 },
};
