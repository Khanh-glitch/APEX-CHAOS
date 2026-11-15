APEX CHAOS — FIX FOR BLACK SCREEN / MISSING ART

1. Unzip this package fully. Source index.html is a Vite entry, not an offline executable.
2. On a computer with Python 3, Git, Node.js/npm and Internet, run:
       python RUN-APEX.py
3. The launcher restores omitted original production assets without overwriting
   the Beyond combat and presentation code, builds Vite, and opens an HTTP preview.
   To build only: python RUN-APEX.py --build-only
   To inspect missing art offline: python RUN-APEX.py --check

IMPORTANT: This archive comes from the submitted source. The source archive was missing
almost all public/assets, most public/gold binary assets, and had no prebuilt dist.
Those cannot be faithfully replaced by generic shapes. First-time restore retrieves
original files from Khanh-glitch/APEX-CHAOS main. The optional service worker is
an online fallback for hosted previews when individual assets are still missing.

If opening index.html by double click, it will show an explanation instead
of a blank black screen. To actually PLAY, run the launcher above.

The existing combat and Gold presentation code has not been deliberately simplified.
There has been no claim of full end-to-end game acceptance in this environment.
