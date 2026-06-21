"""
CodeDroid Browser Agent
Drives a real Chromium window via Playwright for the Live Preview system.
Supports: live HTML/dev-server preview, file-watch auto-reload, and a
click-to-edit visual editing layer (Edit Mode) that patches the DOM live
and only writes to disk when the user explicitly saves.
"""
import asyncio
import json
import os
from pathlib import Path
from typing import Optional, Callable, Awaitable

try:
    from playwright.async_api import async_playwright, Page, Browser, BrowserContext
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False


# ─── Inspector script injected into the live page for Edit Mode ───────────────
# Adds hover highlighting + click interception. Exposed Python functions
# (__codedroid_element_clicked__, __codedroid_edit_prompt_submitted__) are
# wired up by BrowserAgent.enable_edit_mode() / show_floating_input().
EDIT_MODE_INSPECTOR_SCRIPT = r"""
(() => {
  if (window.__codedroid_inspector_installed__) return;
  window.__codedroid_inspector_installed__ = true;

  let currentHighlight = null;
  let editingElement = null;
  window.__codedroid_edit_mode_active__ = true;

  const HOVER_OUTLINE  = '2px solid #3b82f6';
  const EDITING_OUTLINE = '2px solid #f59e0b';
  const SAVED_OUTLINE   = '2px solid #22c55e';

  function clearHighlight(el) {
    if (!el) return;
    el.style.outline = el._codedroidOrigOutline || '';
    el.style.outlineOffset = el._codedroidOrigOffset || '';
  }

  function applyOutline(el, color) {
    if (!el._codedroidOrigOutline && el._codedroidOrigOutline !== '') {
      el._codedroidOrigOutline = el.style.outline || '';
      el._codedroidOrigOffset = el.style.outlineOffset || '';
    }
    el.style.outline = color;
    el.style.outlineOffset = '2px';
    el.style.cursor = 'pointer';
  }

  document.addEventListener('mouseover', (e) => {
    if (!window.__codedroid_edit_mode_active__) return;
    if (e.target === editingElement) return;
    if (currentHighlight && currentHighlight !== editingElement) clearHighlight(currentHighlight);
    currentHighlight = e.target;
    applyOutline(currentHighlight, HOVER_OUTLINE);
  }, true);

  document.addEventListener('mouseout', (e) => {
    if (!window.__codedroid_edit_mode_active__) return;
    if (e.target === editingElement) return;
    clearHighlight(e.target);
  }, true);

  function generateSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    if (el.className && typeof el.className === 'string' && el.className.trim()) {
      const cls = el.className.trim().split(/\s+/)[0];
      return el.tagName.toLowerCase() + '.' + CSS.escape(cls);
    }
    let path = [];
    let node = el;
    while (node && node.parentElement) {
      const index = Array.from(node.parentElement.children).indexOf(node) + 1;
      path.unshift(`${node.tagName.toLowerCase()}:nth-child(${index})`);
      node = node.parentElement;
    }
    return path.join(' > ');
  }

  document.addEventListener('click', (e) => {
    if (!window.__codedroid_edit_mode_active__) return;
    e.preventDefault();
    e.stopPropagation();

    if (editingElement && editingElement !== e.target) clearHighlight(editingElement);
    editingElement = e.target;
    applyOutline(editingElement, EDITING_OUTLINE);

    const selector = generateSelector(e.target);
    const rect = e.target.getBoundingClientRect();

    if (window.__codedroid_element_clicked__) {
      window.__codedroid_element_clicked__(JSON.stringify({
        selector: selector,
        tag: e.target.tagName.toLowerCase(),
        text: (e.target.innerText || '').slice(0, 200),
        html: e.target.outerHTML.slice(0, 2000),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      }));
    }
  }, true);

  // Called by Python after a save completes — brief green flash confirmation
  window.__codedroid_flash_saved__ = (selector) => {
    try {
      const el = document.querySelector(selector);
      if (!el) return;
      applyOutline(el, SAVED_OUTLINE);
      setTimeout(() => { clearHighlight(el); editingElement = null; }, 1000);
    } catch (e) {}
  };

  // Called by Python to clear the "currently editing" orange outline (discard)
  window.__codedroid_clear_editing__ = () => {
    if (editingElement) clearHighlight(editingElement);
    editingElement = null;
  };

  window.__codedroid_set_edit_mode__ = (active) => {
    window.__codedroid_edit_mode_active__ = active;
    if (!active) {
      if (currentHighlight) clearHighlight(currentHighlight);
      if (editingElement) clearHighlight(editingElement);
      currentHighlight = null;
      editingElement = null;
    }
  };
})();
"""

# ─── Floating input injected at the clicked element's position ────────────────
def _floating_input_script(rect: dict) -> str:
    top = rect["y"] + rect["height"] + 8
    left = rect["x"]
    return f"""
(() => {{
  const existing = document.getElementById('__codedroid_floating_input__');
  if (existing) existing.remove();

  const popup = document.createElement('div');
  popup.id = '__codedroid_floating_input__';
  popup.style.cssText = `
    position: fixed;
    top: {top}px;
    left: {left}px;
    background: #1a1a1a;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    padding: 8px;
    z-index: 2147483647;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    display: flex;
    gap: 6px;
    min-width: 280px;
    font-family: -apple-system, sans-serif;
  `;

  popup.innerHTML = `
    <input
      type="text"
      placeholder="Describe the change..."
      style="flex:1; background:#2a2a2a; border:1px solid #444; border-radius:4px; color:white; padding:6px 10px; font-size:13px; outline:none;"
    />
    <button style="background:#3b82f6; border:none; border-radius:4px; color:white; padding:6px 12px; cursor:pointer; font-size:13px;">
      &#10148;
    </button>
  `;

  document.body.appendChild(popup);

  // Keep within viewport bounds
  const popRect = popup.getBoundingClientRect();
  if (popRect.right > window.innerWidth) {{
    popup.style.left = Math.max(8, window.innerWidth - popRect.width - 8) + 'px';
  }}
  if (popRect.bottom > window.innerHeight) {{
    popup.style.top = Math.max(8, {rect["y"]} - popRect.height - 8) + 'px';
  }}

  const input = popup.querySelector('input');
  const sendBtn = popup.querySelector('button');
  input.focus();

  const submit = () => {{
    const prompt = input.value.trim();
    if (!prompt) return;
    if (window.__codedroid_edit_prompt_submitted__) {{
      window.__codedroid_edit_prompt_submitted__(prompt);
    }}
    popup.remove();
  }};

  sendBtn.onclick = submit;
  input.onkeydown = (e) => {{
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') popup.remove();
  }};
}})();
"""


class BrowserAgent:
    """
    Wraps a single Playwright browser/page for the Live Preview + Edit Mode
    system. One instance per active preview session.
    """

    def __init__(self):
        self._pw = None
        self.browser: Optional["Browser"] = None
        self.context: Optional["BrowserContext"] = None
        self.page: Optional["Page"] = None
        self.edit_mode_active: bool = False
        self.pending_changes: list[dict] = []
        self.preview_url: Optional[str] = None
        self.dev_server_proc: Optional[asyncio.subprocess.Process] = None

        # Callbacks set by main.py to forward events to the frontend WebSocket
        self.on_element_clicked: Optional[Callable[[dict], Awaitable[None]]] = None
        self.on_prompt_submitted: Optional[Callable[[str], Awaitable[None]]] = None
        self.on_console: Optional[Callable[[str, str], Awaitable[None]]] = None
        self.on_closed: Optional[Callable[[], Awaitable[None]]] = None

        self._last_clicked_element: Optional[dict] = None

    # ── Lifecycle ──────────────────────────────────────────────────────────

    async def start(self, url: str, width: int = 1280, height: int = 800):
        if not PLAYWRIGHT_AVAILABLE:
            raise RuntimeError(
                "Playwright is not installed. Run: pip install playwright && playwright install chromium"
            )

        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(headless=False, args=[f"--window-size={width},{height}"])
        self.context = await self.browser.new_context(viewport={"width": width, "height": height})
        self.page = await self.context.new_page()

        # Forward console messages
        self.page.on("console", lambda msg: asyncio.create_task(self._handle_console(msg)))
        self.page.on("close", lambda: asyncio.create_task(self._handle_closed()))

        # Expose Python functions BEFORE navigating so the inspector script
        # (added via add_init_script) can call them on every page load.
        await self.page.expose_function("__codedroid_element_clicked__", self._on_element_clicked_raw)
        await self.page.expose_function("__codedroid_edit_prompt_submitted__", self._on_prompt_submitted_raw)

        self.preview_url = url
        await self.page.goto(url, wait_until="domcontentloaded")

    async def _handle_console(self, msg):
        if self.on_console:
            try:
                await self.on_console(msg.type, msg.text)
            except Exception:
                pass

    async def _handle_closed(self):
        if self.on_closed:
            try:
                await self.on_closed()
            except Exception:
                pass

    async def reload(self):
        if self.page:
            await self.page.reload(wait_until="domcontentloaded")
            if self.edit_mode_active:
                await self._inject_inspector()

    async def navigate(self, url: str):
        self.preview_url = url
        if self.page:
            await self.page.goto(url, wait_until="domcontentloaded")
            if self.edit_mode_active:
                await self._inject_inspector()

    async def stop(self):
        try:
            if self.dev_server_proc:
                self.dev_server_proc.terminate()
                try:
                    await asyncio.wait_for(self.dev_server_proc.wait(), timeout=5)
                except asyncio.TimeoutError:
                    self.dev_server_proc.kill()
                self.dev_server_proc = None
            if self.context:
                await self.context.close()
            if self.browser:
                await self.browser.close()
            if self._pw:
                await self._pw.stop()
        except Exception:
            pass
        finally:
            self.browser = self.context = self.page = self._pw = None

    # ── Dev server management ──────────────────────────────────────────────

    async def start_dev_server(self, command: str, cwd: str, ready_url: str, timeout: int = 30) -> bool:
        """Start a dev server (npm run dev, vite, etc.) and wait until ready_url responds."""
        self.dev_server_proc = await asyncio.create_subprocess_shell(
            command, cwd=cwd,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        import httpx
        async with httpx.AsyncClient() as client:
            for _ in range(timeout * 2):
                try:
                    r = await client.get(ready_url, timeout=1)
                    if r.status_code < 500:
                        return True
                except Exception:
                    pass
                await asyncio.sleep(0.5)
        return False

    # ── Edit Mode ───────────────────────────────────────────────────────────

    async def _inject_inspector(self):
        if not self.page:
            return
        await self.page.add_init_script(EDIT_MODE_INSPECTOR_SCRIPT)
        await self.page.evaluate(EDIT_MODE_INSPECTOR_SCRIPT)
        await self.page.evaluate("window.__codedroid_set_edit_mode__(true)")

    async def enable_edit_mode(self):
        self.edit_mode_active = True
        await self._inject_inspector()

    async def disable_edit_mode(self):
        self.edit_mode_active = False
        if self.page:
            try:
                await self.page.evaluate("window.__codedroid_set_edit_mode__ && window.__codedroid_set_edit_mode__(false)")
            except Exception:
                pass

    async def _on_element_clicked_raw(self, payload: str):
        try:
            data = json.loads(payload)
        except Exception:
            return
        self._last_clicked_element = data
        await self.show_floating_input(data)
        if self.on_element_clicked:
            await self.on_element_clicked(data)

    async def _on_prompt_submitted_raw(self, prompt: str):
        if self.on_prompt_submitted:
            await self.on_prompt_submitted(prompt)

    async def show_floating_input(self, element_data: dict):
        if not self.page:
            return
        script = _floating_input_script(element_data["rect"])
        try:
            await self.page.evaluate(script)
        except Exception:
            pass

    # ── DOM patching (live preview only — file untouched) ──────────────────

    async def apply_dom_change(self, change: dict):
        if not self.page:
            return
        selector = change["selector"]
        action = change["action"]
        value = change.get("value", "")

        try:
            if action == "set_text":
                await self.page.evaluate(
                    "([sel, val]) => { const el = document.querySelector(sel); if (el) el.innerText = val; }",
                    [selector, value],
                )
            elif action == "set_html":
                await self.page.evaluate(
                    "([sel, val]) => { const el = document.querySelector(sel); if (el) el.innerHTML = val; }",
                    [selector, value],
                )
            elif action == "set_attribute":
                attr = change.get("attribute_name", "")
                await self.page.evaluate(
                    "([sel, attr, val]) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val); }",
                    [selector, attr, value],
                )
            elif action == "set_style":
                style_obj = value if isinstance(value, dict) else {}
                await self.page.evaluate(
                    "([sel, styles]) => { const el = document.querySelector(sel); if (el) Object.assign(el.style, styles); }",
                    [selector, style_obj],
                )
            elif action == "remove":
                await self.page.evaluate(
                    "(sel) => { const el = document.querySelector(sel); if (el) el.remove(); }",
                    selector,
                )
        except Exception as e:
            raise RuntimeError(f"Failed to apply DOM change: {e}")

        self.pending_changes.append(change)

    async def flash_saved(self, selector: str):
        if self.page:
            try:
                await self.page.evaluate(
                    "(sel) => window.__codedroid_flash_saved__ && window.__codedroid_flash_saved__(sel)",
                    selector,
                )
            except Exception:
                pass

    async def clear_editing_outline(self):
        if self.page:
            try:
                await self.page.evaluate(
                    "() => window.__codedroid_clear_editing__ && window.__codedroid_clear_editing__()"
                )
            except Exception:
                pass

    def clear_pending_changes(self):
        self.pending_changes = []

    def remove_pending_change(self, index: int):
        if 0 <= index < len(self.pending_changes):
            self.pending_changes.pop(index)


# Module-level singleton — one preview session at a time per sidecar instance
_agent: Optional[BrowserAgent] = None


def get_browser_agent() -> BrowserAgent:
    global _agent
    if _agent is None:
        _agent = BrowserAgent()
    return _agent


async def reset_browser_agent():
    global _agent
    if _agent is not None:
        await _agent.stop()
    _agent = BrowserAgent()
    return _agent