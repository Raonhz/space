"""
PNG -> WebP 일괄 변환 스크립트
사용법: python convert_webp.py
필요: pip install Pillow
"""
import os
from PIL import Image

img_dir = os.path.join(os.path.dirname(__file__), 'assets', 'images')

total_png = 0
total_webp = 0

for i in range(1, 21):
    png_path = os.path.join(img_dir, f'earth_{i}.png')
    webp_path = os.path.join(img_dir, f'earth_{i}.webp')
    
    if not os.path.exists(png_path):
        print(f'  SKIP earth_{i}.png (not found)')
        continue
    
    png_size = os.path.getsize(png_path)
    total_png += png_size
    
    img = Image.open(png_path)
    img.save(webp_path, 'WEBP', quality=82, method=4)
    
    webp_size = os.path.getsize(webp_path)
    total_webp += webp_size
    
    reduction = (1 - webp_size / png_size) * 100
    print(f'  earth_{i}.png -> earth_{i}.webp  |  {png_size // 1024}KB -> {webp_size // 1024}KB  (-{reduction:.1f}%)')

print(f'\n  Total: {total_png / 1024 / 1024:.2f}MB -> {total_webp / 1024 / 1024:.2f}MB  (-{(1 - total_webp / total_png) * 100:.1f}%)')
print('  Done. PNG files can be safely deleted after verification.')
