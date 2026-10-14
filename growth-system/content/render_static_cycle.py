"""Render SOFIE's disclosed static campaign from verified editorial JSON.

Uses the existing original Nour portrait without changing her identity.
No product imagery or product-specific claims are introduced by the renderer.
"""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps
from reportlab.graphics.barcode import qr as rl_qr

CREAM = '#FBF7F2'
INK = '#332727'
ROSE = '#92475A'
RULE = '#E8D4CD'
MUTED = '#7B6B65'
REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf'


def f(size, bold=False, serif=False):
    return ImageFont.truetype(SERIF if serif else BOLD if bold else REGULAR, size)


def lines(draw, text, font, width):
    out, current = [], ''
    for word in text.split():
        trial = (current + ' ' + word).strip()
        if draw.textlength(trial, font=font, direction='rtl') > width and current:
            out.append(current)
            current = word
        else:
            current = trial
    if current:
        out.append(current)
    return out


def rtl(draw, text, x, y, width, size, colour, bold=False, max_lines=None):
    while True:
        font = f(size, bold)
        wrapped = lines(draw, text, font, width)
        if max_lines is None or len(wrapped) <= max_lines or size <= 36:
            break
        size -= 2
    for line in wrapped:
        draw.text((x, y), line, font=font, fill=colour, anchor='ra', direction='rtl')
        y += int(size * 1.42)
    return y


def qr_image(url, target):
    code = rl_qr.QrCodeWidget(url, barLevel='M')
    code.qr.make()
    count = code.qr.moduleCount
    scale = max(3, target // (count + 8))
    actual = (count + 8) * scale
    image = Image.new('RGB', (actual, actual), 'white')
    draw = ImageDraw.Draw(image)
    for row in range(count):
        for col in range(count):
            if code.qr.modules[row][col]:
                x, y = (col + 4) * scale, (row + 4) * scale
                draw.rectangle((x, y, x + scale - 1, y + scale - 1), fill='black')
    return image


def chrome(draw, width, height, number=None, ai=False):
    draw.text((75, 40), 'S O F I E', font=f(42, serif=True), fill=INK)
    draw.text((width - 75, 56), 'SOFIE KNOWS YOUR BEAUTY', font=f(17), fill=ROSE, anchor='ra')
    draw.line((75, 120, width - 75, 120), fill=RULE, width=2)
    draw.line((75, height - 100, width - 75, height - 100), fill=RULE, width=2)
    if number:
        draw.text((75, height - 75), number, font=f(22), fill=MUTED)
    else:
        draw.text((75, height - 75), 'SOFIE KNOWS', font=f(22), fill=MUTED)
    draw.text((width - 75, height - 75), 'sofiestore.net', font=f(22), fill=MUTED, anchor='ra')
    note = 'نور شخصية افتراضية بالذكاء الاصطناعي' if ai else 'معلومات تعليمية للتجميل والعناية العامة'
    draw.text((width - 75, height - 136), note, font=f(19), fill=ROSE, anchor='ra', direction='rtl')


def render_carousel(post, portrait, out):
    assets = []
    for index, (title, body) in enumerate(post['slides'], 1):
        im = Image.new('RGB', (1080, 1350), CREAM)
        d = ImageDraw.Draw(im)
        chrome(d, 1080, 1350, f'{index:02} / 05', ai=True)
        if index == 1:
            hook = title + ' ' + body
            rtl(d, hook, 1005, 176, 930, 86, INK, bold=True, max_lines=2)
            pic = ImageOps.fit(portrait, (581, 725), Image.Resampling.LANCZOS, centering=(.5, .5))
            im.paste(pic, (425, 460))
            d.text((75, 610), 'NOUR', font=f(43, serif=True), fill=ROSE)
            d.text((75, 678), 'YOUR VIRTUAL', font=f(22), fill=MUTED)
            d.text((75, 715), 'BEAUTY GUIDE', font=f(22), fill=MUTED)
            rtl(d, 'خلّي صوفي تختار معاكي.', 370, 880, 295, 30, ROSE, max_lines=3)
        elif index == 5:
            y = rtl(d, title, 1005, 190, 900, 74, INK, bold=True, max_lines=2)
            rtl(d, body, 1005, max(455, y + 55), 900, 39, ROSE, max_lines=3)
            q = qr_image(post['landing_url'], 350)
            im.paste(q, (75, 780))
            rtl(d, 'امسحي الكود وابدئي اختيارك', 1005, 820, 510, 38, INK, bold=True, max_lines=2)
            d.text((1005, 980), 'sofiestore.net', font=f(30), fill=ROSE, anchor='ra')
            d.text((1005, 1028), '/pages/sofie-knows', font=f(24), fill=MUTED, anchor='ra')
        else:
            y = rtl(d, title, 1005, 190, 900, 75, INK, bold=True, max_lines=2)
            rtl(d, body, 1005, max(y + 95, 545), 900, 43, ROSE, max_lines=5)
            d.text((75, 940), f'{index - 1:02}', font=f(182, serif=True), fill=RULE)
        path = out / (post['id'].lower() + f'-{index:02}.jpg')
        im.save(path, 'JPEG', quality=92, optimize=True, progressive=True)
        assets.append(str(path))
    return assets


def render_story(post, out):
    im = Image.new('RGB', (1080, 1920), CREAM)
    d = ImageDraw.Draw(im)
    chrome(d, 1080, 1920, ai=False)
    d.text((1005, 220), 'اختيارك يبدأ بسؤال', font=f(28), fill=ROSE, anchor='ra', direction='rtl')
    y = rtl(d, post['title'], 1005, 350, 900, 76, INK, bold=True, max_lines=3)
    rtl(d, post['tip'], 1005, max(y + 95, 740), 900, 47, ROSE, max_lines=4)
    d.line((75, 1140, 1005, 1140), fill=RULE, width=2)
    rtl(d, 'خلّي صوفي تختار معاكي', 1005, 1205, 900, 48, INK, bold=True, max_lines=2)
    q = qr_image(post['landing_url'], 345)
    im.paste(q, ((1080 - q.width) // 2, 1385))
    path = out / (post['id'].lower() + '.jpg')
    im.save(path, 'JPEG', quality=92, optimize=True, progressive=True)
    return [str(path)]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--portrait', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    data = json.loads(Path(args.manifest).read_text())
    portrait = Image.open(args.portrait).convert('RGB')
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=True)
    for post in data['posts']:
        if post['format'] == 'carousel':
            post['files'] = render_carousel(post, portrait, out)
            post['alt_text'] = [title + ': ' + body for title, body in post['slides']]
            post['alt_text'][0] += ' — نور شخصية افتراضية بالذكاء الاصطناعي'
            post['alt_text'][-1] += ' — رمز QR لصفحة اختيارات صوفي'
        else:
            post['files'] = render_story(post, out)
            post['alt_text'] = [post['title'] + ': ' + post['tip'] + ' — رمز QR لصفحة صوفي']
    (out / 'manifest.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(json.dumps({'posts': len(data['posts']), 'images': sum(len(p['files']) for p in data['posts'])}))


if __name__ == '__main__':
    main()
