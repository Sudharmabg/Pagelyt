"""Combine rendered LinkedIn slides into one PDF for a LinkedIn document post.
Run from assets/linkedin:
  python tools/make-pdf.py                 -> pagelyt-li-seo-fixes-1..6.png  -> pagelyt-li-seo-fixes.pdf
  python tools/make-pdf.py ai-search 3     -> pagelyt-li-ai-search-1..3.png  -> pagelyt-li-ai-search.pdf"""
import sys
from pathlib import Path
from PIL import Image

TITLES = {
    "seo-fixes": "3 SEO fixes you can do this week",
    "ai-search": "Is ChatGPT recommending your business?",
}

name = sys.argv[1] if len(sys.argv) > 1 else "seo-fixes"
count = int(sys.argv[2]) if len(sys.argv) > 2 else 6

Image.init()  # register the JPEG encoder the PDF writer uses
here = Path(__file__).resolve().parent.parent
slides = [Image.open(here / f"pagelyt-li-{name}-{i}.png").convert("RGB") for i in range(1, count + 1)]
out = here / f"pagelyt-li-{name}.pdf"
slides[0].save(out, save_all=True, append_images=slides[1:], resolution=144,
               title=TITLES.get(name, name), author="Pagelyt")
print("saved", out.name, f"{out.stat().st_size // 1024} KB")
