// R83 opt-in-by-screen Mode composition; preserve canonical Gold source.
export const R83_MODE_CSS = "/* R83 SHORT-PORTRAIT MODE SELECT COMPOSITION.\n   Preserves Gold card artwork/hierarchy. Reallocates the height budget as\n   proportions of the live viewport; only active on Mode (not Home/Pick).\n   The old dim Home route band must not bleed through the Mode cards. */\n@media (orientation:portrait) and (max-height:720px) {\n  #stage.screen-mode .routes,\n  #stage.screen-mode .bottom-depth{\n    opacity:0!important;\n    visibility:hidden;\n    pointer-events:none!important;\n  }\n  #stage.screen-mode .modeSelectScreen{\n    top:39.3vh;\n    bottom:7.2vh;\n    min-height:0;\n  }\n  #stage.screen-mode .modeHeader{flex:0 0 auto}\n  #stage.screen-mode .modeChoices{\n    flex:1 1 auto;\n    min-height:0;\n    grid-template-rows:repeat(2,minmax(0,1fr));\n    gap:clamp(5px,.95vh,8px);\n    margin-top:clamp(6px,1.4vh,10px);\n  }\n  #stage.screen-mode .modeCard,\n  #stage.screen-mode .modeArt{\n    min-height:0;\n    height:100%;\n  }\n  #stage.screen-mode .modeName{\n    font-size:clamp(26px,8.2vw,35px);\n  }\n}\n";
export function adaptGoldShellR83(out){
  if(out.includes('R83 SHORT-PORTRAIT MODE SELECT COMPOSITION')) throw new Error('R83 mode duplicate');
  if(!out.includes('</head>'))throw new Error('R83 expected Gold shell closing head');
  return out.replace('</head>','<style id="r83-mode-short-portrait">
'+R83_MODE_CSS+'</style>
</head>');
}
