from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SOURCE = ROOT.parent / "backend" / "nestjs" / "public" / "prototype.html"
TARGET_HTML = ROOT / "zhiyi-assistant-prototype.html"
TARGET_CSS = ROOT / "zhiyi-assistant-prototype.css"
TARGET_JS = ROOT / "zhiyi-assistant-prototype.js"

if "--write" not in sys.argv:
    existing = [path for path in (TARGET_HTML, TARGET_CSS, TARGET_JS) if path.exists()]
    if existing:
        raise SystemExit(
            "Refusing to overwrite hardened assets. Review generated output in a temporary "
            "directory, then rerun with --write only after porting all security patches."
        )

source = SOURCE.read_text(encoding="utf-8")
style_match = re.search(r"<style>([\s\S]*?)</style>", source)
script_matches = re.findall(r"<script>([\s\S]*?)</script>", source)
if style_match is None or not script_matches:
    raise RuntimeError("Prototype source does not contain the expected inline assets")

css = style_match.group(1)
js = "\n".join(script_matches)
html = re.sub(r"<style>[\s\S]*?</style>", "", source, count=1)
html = re.sub(r"<script>[\s\S]*?</script>", "", html)
html = re.sub(r"<link[^>]+fonts\.(?:googleapis|gstatic)\.com[^>]*>\s*", "", html)

style_rules: dict[str, str] = {}

def class_for(declaration: str) -> str:
    normalized = declaration.strip()
    if normalized not in style_rules:
        style_rules[normalized] = f"external-style-{len(style_rules) + 1}"
    return style_rules[normalized]


def replace_html_style(match: re.Match[str]) -> str:
    return f' class="{class_for(match.group(2))}"'

html = re.sub(r"\sstyle=([\"'])(.*?)\1", replace_html_style, html, flags=re.I | re.S)
html = re.sub(r"\son([a-z]+)=([\"'])(.*?)\2", lambda match: f' data-handler="{match.group(3)}"', html, flags=re.I | re.S)

# Template attributes are escaped inside JavaScript single-quoted strings.
def replace_js_style(match: re.Match[str]) -> str:
    return f' class=\\"{class_for(match.group(1))}\\"'

js = re.sub(r"\sstyle=\\\"(.*?)\\\"", replace_js_style, js, flags=re.I | re.S)
js = re.sub(r"\son[a-z]+=\\\"(.*?)\\\"", lambda match: f' data-handler=\\"{match.group(1)}\\"', js, flags=re.I | re.S)

# Strict, non-eval event delegation. Only pre-existing fixed function names may be invoked.
delegate = r'''
  document.addEventListener('click', function(event) {
    var target = event.target.closest('[data-handler]');
    if (!target) return;
    var handler = target.getAttribute('data-handler') || '';
    var match = handler.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
    if (!match) return;
    var allowed = {
      switchTab: switchTab, switchScreen: switchScreen, goBack: goBack,
      openMemberDetail: openMemberDetail, toggleTask: toggleTask,
      toggleOption: toggleOption, assessNext: assessNext, selectMember: selectMember,
      toggleMed: toggleMed, handleSendOrVoice: handleSendOrVoice,
      openModal: openModal, closeModal: closeModal, logout: logout,
      saveProfile: saveProfile, savePassword: savePassword,
      sendChat: sendChat, submitMetric: submitMetric, addMedication: addMedication
    };
    var fn = allowed[match[1]];
    if (!fn) return;
    var raw = match[2].trim();
    var args = [];
    if (raw) {
      args = raw.split(',').map(function(value) {
        value = value.trim();
        if (value === 'this') return target;
        if (value === 'event') return event;
        if (/^-?\d+$/.test(value)) return Number(value);
        var quoted = value.match(/^['"]([\s\S]*)['"]$/);
        return quoted ? quoted[1] : value;
      });
    }
    fn.apply(window, args);
  });
'''
js += delegate

# The generated JavaScript is the canonical migration output. Apply narrowly scoped
# security transforms here so regenerating never restores known unsafe behavior.
js = js.replace("med.time + '</div>'", "escapeHtml(String(med.time || '')) + '</div>'")
js = js.replace("med.name + '</div>'", "escapeHtml(String(med.name || '')) + '</div>'")
js = js.replace("med.detail + '</div>'", "escapeHtml(String(med.detail || '')) + '</div>'")
js = js.replace("code: code || 'xiaolin'", "code: code")
js = js.replace("API.login('xiaolin').then(resolve).catch(reject);", "reject(new Error('生产环境禁止开发身份回退'));")

external_rules = []
for declaration, class_name in style_rules.items():
    # Dynamic template fragments are deliberately ignored rather than emitted as CSS.
    if "' +" not in declaration and "+ '" not in declaration:
        external_rules.append(f".{class_name} {{{declaration}}}")
css += "\n\n/* Mechanically externalized former style attributes. */\n" + "\n".join(external_rules)

csp = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:3000; object-src 'none'; base-uri 'none'; form-action 'self'"
head_assets = f'<meta http-equiv="Content-Security-Policy" content="{csp}">\n<link rel="stylesheet" href="./zhiyi-assistant-prototype.css">'
html = html.replace("<title>智医助手 - AI 家庭健康管理</title>", "<title>智医助手 - AI 家庭健康管理</title>\n" + head_assets)
html = re.sub(r"\s*<script src=\"data\.js\"></script>\s*", "\n", html)
html = html.replace("</body>", '<script src="./runtime-config.js"></script>\n<script src="./zhiyi-assistant-prototype.js"></script>\n</body>')

TARGET_HTML.write_text(html, encoding="utf-8")
TARGET_CSS.write_text(css, encoding="utf-8")
TARGET_JS.write_text(js, encoding="utf-8")
print(f"Externalized prototype with {len(style_rules)} style classes")
