"use client";

import React, { useEffect, useState } from "react";
import "@fontsource/montserrat/900.css";
import "../apexStyles.css";
import "../game/localization.css";
import "../game/sideIdentity.css";

import { installProductSurfaceAuthority } from "../game/productSurface.js";
import { installPlayerAccountAuthority } from "../game/playerAccount.js";
import { installAdminAuthority } from "../game/adminAuthority.js";
import { installCloudAccount, initCloudAccount } from "../game/cloudAccount.js";
import { GUEST_ONLY_RELEASE } from "../game/releasePolicy.js";
import { installOwnerPlaytestCapture } from "../game/ownerPlaytestCapture.js";
import { installLocalization } from "../game/localizationRuntime.js";
import AppErrorBoundary from "../ui/AppErrorBoundary.jsx";
import ApexChaosHost from "../ApexChaosHost.jsx";

let authoritiesInstalled = false;

function ensureClientAuthorities() {
  if (typeof window === "undefined" || authoritiesInstalled) return;
  authoritiesInstalled = true;
  installProductSurfaceAuthority(window);
  installPlayerAccountAuthority(window);
  installAdminAuthority(window);
  installOwnerPlaytestCapture(window);
  installCloudAccount(window);
  if (!GUEST_ONLY_RELEASE) void initCloudAccount();
  installLocalization();
  import("../game/mobileViewportAudit.js").catch(() => {});
}

export default function ApexChaosClientRoot() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureClientAuthorities();
    setReady(true);
  }, []);

  if (!ready) {
    return <div className="fixed inset-0 bg-[#080b0e]" aria-hidden="true" />;
  }

  return (
    <AppErrorBoundary>
      <ApexChaosHost />
    </AppErrorBoundary>
  );
}
