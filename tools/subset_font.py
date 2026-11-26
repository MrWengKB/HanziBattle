"""更新字表后重新生成楷体子集字体（只包含用到的字，体积小）。
用法：pip install fonttools brotli
      python tools/subset_font.py 路径/kaiti.ttf
"""
import glob, subprocess, sys, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, '..', 'HanziQuery', 'kaiti.ttf')
files = [os.path.join(root, 'hanzilist.csv'), os.path.join(root, 'index.html')] + glob.glob(os.path.join(root, 'js', '*.js'))
text = ''.join(open(f, encoding='utf-8').read() for f in files)
chars = ''.join(sorted(set(c for c in text if 0x2E80 <= ord(c) <= 0x9FFF or 0xF900 <= ord(c) <= 0xFAFF)))
subprocess.run(['pyftsubset', src, '--text=' + chars + '汉字对决VS0123456789', '--flavor=woff2',
                '--layout-features=*', '--output-file=' + os.path.join(root, 'fonts', 'kaiti-subset.woff2')], check=True)
print('done,', len(chars), 'chars')
