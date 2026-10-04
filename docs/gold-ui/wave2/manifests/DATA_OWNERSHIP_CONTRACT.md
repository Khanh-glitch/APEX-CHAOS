# APEX CHAOS — Wave 2 Data Ownership Contract

## 1. Player profile boundary

Future UI must read a `PlayerProfileAuthority`-style projection.

The existing local store `apexChaos.arsenalMeta.v1` is the initial implementation to wrap, not something to delete immediately.

Current useful local domains include:
- credits;
- owned fighters;
- last selected P1/P2;
- total spins;
- unlock timestamps;
- arena palette.

## 2. Device settings boundary

`UserSettingsAuthority` owns:
- audio volumes/mute;
- effects preferences;
- reduced motion;
- device control preferences.

Do not merge this into economy save state.

## 3. Account identity separation

Do not conflate:
- account/profile identity;
- network peer identity;
- P1/P2 gameplay slot;
- simulation authority.

Future Local 2P may allow a second account on one device, but V1 does not require a full multi-account switcher.

## 4. Guest-first product law

Do not force login before Home or Free Battle.

Default experience may remain a device/local profile.

Profile offers **SECURE PROGRESS** as a recovery/cross-device action.

Player-facing save vocabulary:
- DEVICE SAVE;
- SECURED;
- SYNCING;
- OFFLINE.

Do not expose implementation vocabulary such as anonymous JWT/session type.

## 5. Authentication abstraction

No visual surface may import a provider SDK directly.

Use conceptual adapters:
- AuthProvider;
- CloudProfileRepository;
- EconomyService;
- SyncCoordinator.

Provider choice remains an implementation decision until separately approved.

## 6. Economy trust boundary

Once cloud/public economy is introduced, these are server-authoritative:
- AC balance;
- fighter ownership acquired through Shop/Draw;
- draw transaction result;
- shop purchase;
- economic mission reward;
- other value-bearing entitlements.

The client may cache entitlements for offline play, but may not mint them offline.

## 7. Offline law

Previously owned cached fighters remain usable in offline Free Battle.

Offline mode must not allow authoritative:
- Shop purchase;
- Lucky Draw;
- economic reward claim/mint.

Do not turn server authority into an always-online requirement for basic local combat.

## 8. Legacy migration

A one-time pre-public migration may intentionally preserve trusted pilot/dev state.

After public economy launch, arbitrary localStorage AC/ownership cannot be blindly unioned into cloud state.

Migration must be explicit, idempotent and receipted.

## 9. Event law

Events announce state change; they do not become a second data authority.

Good:
`PROFILE_UPDATED` -> subscribers re-read canonical projection.

Bad:
each surface keeps an independent wallet balance copied from event payload.

## 10. Result/reward boundary

Battle outcome and economy settlement are different authorities.

A match may have a valid winner while a cloud reward is still syncing.

Result presentation must not recompute reward or award currency during render/mount.
