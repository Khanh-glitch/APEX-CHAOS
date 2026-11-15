export const goldFontParityCSS = `
#gold-shell-host #stage {
  --fDisplay: 'Oswald', sans-serif;
  --fAction: 'Oswald', sans-serif;
  --fUi: 'Oswald', sans-serif;
  --fBody: 'Oswald', sans-serif;
}
#gold-shell-host #stage .storyTitle {
  font-family: 'Oswald', sans-serif;
}
#gold-shell-host #battleHudHost {
  --fd: 'Oswald', sans-serif;
  font-family: 'Oswald', sans-serif;
}
#gold-shell-host #battleTransition {
  font-family: 'Oswald', sans-serif;
}
@media (orientation: portrait) {
  #gold-shell-host #stage .story .quest {
    line-height: 1.1;
  }
  #gold-shell-host #stage .story .location {
    line-height: 1.1666667;
  }
}
/* Seamless feathered integration for newly awakened cosmic & chronometer Gold hero renders */
#gold-shell-host img[src*="/heroes/black_hole/pick_selected_large"],
#gold-shell-host img[src*="/heroes/time/pick_selected_large"] {
  -webkit-mask-image: radial-gradient(ellipse 68% 72% at 50% 48%, #000 56%, rgba(0,0,0,0.72) 76%, transparent 98%);
  mask-image: radial-gradient(ellipse 68% 72% at 50% 48%, #000 56%, rgba(0,0,0,0.72) 76%, transparent 98%);
  mix-blend-mode: lighten;
}
`;

export const goldSkillArtBoundsCSS = `
#gold-shell-host #battleHudHost #hud[data-layout="port"][data-size="tablet"][data-mode="1p"]
  #p1Side .skill .sk-art > img.apex-skill-icon {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  object-position: center;
}
`;
