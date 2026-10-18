#!/usr/bin/env python3
# Save server and password gate for Master of Orion — Reborn. Python 3.8+, standard library only.
#
#   python3 server/moo-saves.py [--config /etc/moogenesis/moo.conf]          # behind nginx / Caddy (see deploy/)
#   python3 server/moo-saves.py --dev [--static .] [--listen 127.0.0.1:8765]  # local play: also serves the game files
#
# The web server asks GET /api/auth before serving any game file (nginx auth_request / Caddy forward_auth):
# 204 = let it through, 401 = show the password page instead. Saves are opaque blobs (the browser gzips them),
# one file per slot plus a small .json with the slot's summary. No accounts, no versioning: a convenience store.
#
# Config file: `key = value` lines, `#` starts a comment line (only at the start, so a password may contain #).
# Re-read whenever it changes, no restart needed.
#   password = moopassword     (blank `password =` turns the gate off; a missing key means this default)
#   listen = 127.0.0.1:8766
#   data_dir = /var/lib/moogenesis
#   max_save_kb = 4096
import argparse
import hashlib
import hmac
import html
import json
import mimetypes
import os
import posixpath
import re
import secrets
import sys
import threading
import time
import urllib.parse
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

DEFAULTS = {'password': 'moopassword', 'listen': '127.0.0.1:8766', 'data_dir': '/var/lib/moogenesis', 'max_save_kb': '4096'}
COOKIE = 'moo_auth'
COOKIE_DAYS = 30
SLOT_RE = re.compile(r'^[a-z0-9][a-z0-9_-]{0,23}$')
OPEN_FILES, OPEN_DIRS = ('/version.txt',), ('/.well-known/',)    # never gated: health checks and certificate renewal
MAX_META = 4096


class Config:
    """key = value file, re-read when its mtime changes. CLI overrides win."""

    def __init__(self, path, overrides):
        self.path, self.overrides, self.lock = path, overrides, threading.Lock()
        self.stamp, self.values = object(), dict(DEFAULTS)    # sentinel: the first reload() always reads
        self.reload()

    def reload(self):
        try:
            st = os.stat(self.path) if self.path else None
            stamp = (st.st_mtime_ns, st.st_size) if st else None
        except OSError:
            stamp = None
        with self.lock:
            if stamp == self.stamp:
                return
            values = dict(DEFAULTS)
            if stamp:
                try:
                    with open(self.path, encoding='utf-8') as f:
                        for line in f:
                            line = line.strip()
                            if line.startswith('#') or '=' not in line:
                                continue
                            k, v = line.split('=', 1)
                            values[k.strip().lower()] = v.strip()
                except OSError as e:
                    log('cannot read %s: %s (using defaults)' % (self.path, e))
            values.update(self.overrides)
            self.values, self.stamp = values, stamp

    def __getitem__(self, k):
        self.reload()
        return self.values[k]


def log(msg):
    sys.stderr.write('[moo-saves] %s\n' % msg)
    sys.stderr.flush()


def read_secret(data_dir, create=True):
    """Per-install key for the login cookie, created on first use."""
    path = os.path.join(data_dir, 'secret')
    try:
        with open(path, encoding='ascii') as f:
            s = f.read().strip()
            if len(s) >= 32:
                return s.encode()
    except OSError:
        pass
    if not create:
        return None
    os.makedirs(data_dir, exist_ok=True)
    s = secrets.token_hex(32)
    fd = os.open(path + '.tmp', os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write(s + '\n')
    os.replace(path + '.tmp', path)
    return s.encode()


def write_atomic(path, data):
    tmp = '%s.tmp.%d.%d' % (path, os.getpid(), threading.get_ident())
    with open(tmp, 'wb') as f:
        f.write(data)
    os.replace(tmp, path)


def make_token(secret, password):
    return hmac.new(secret, b'moo-auth:' + password.encode('utf-8'), hashlib.sha256).hexdigest()


LOGIN_PAGE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Master of Orion</title>
<style>
  :root { color-scheme: dark; }
  html, body { height: 100%; margin: 0; }
  body { display: grid; place-items: center; background: radial-gradient(ellipse at 50% 30%, #1d2560, #070a1c 70%); color: #efe6cf;
         font: 16px/1.4 "IBM Plex Sans Condensed", "Segoe UI", system-ui, sans-serif; }
  form { width: min(22rem, calc(100vw - 2rem)); box-sizing: border-box; padding: 2rem 1.8rem 1.8rem; background: rgba(12, 18, 48, .92); border: 1px solid #8a6d3b;
         box-shadow: 0 1rem 3rem rgba(0,0,0,.5), inset 0 0 2rem rgba(241, 213, 143, .06); }
  h1 { margin: 0 0 .3rem; font: 400 1.7rem/1.1 "Marcellus SC", Georgia, serif; letter-spacing: .04em; color: #f1d58f; text-align: center; }
  p { margin: 0 0 1.3rem; color: #a9b0cf; text-align: center; font-size: .95rem; }
  input { box-sizing: border-box; width: 100%; padding: .65rem .75rem; border: 1px solid #8a6d3b; background: #0a0f2a; color: #efe6cf; font: inherit; outline: none; }
  input:focus { border-color: #f1d58f; box-shadow: 0 0 0 2px rgba(241, 213, 143, .25); }
  button { width: 100%; margin-top: .9rem; padding: .6rem; border: 0; background: linear-gradient(180deg, #f1d58f, #b48a45); color: #1a1406; cursor: pointer;
           font: 400 1.1rem "Marcellus SC", Georgia, serif; letter-spacing: .05em; }
  button:hover { filter: brightness(1.1); }
  .err { margin: .8rem 0 0; color: #ff8b95; text-align: center; font-size: .92rem; }
  .err:empty { display: none; }
</style></head>
<body><form method="post" action="{{action}}">
  <h1>Master of Orion</h1>
  <p>Enter the password to play.</p>
  <input type="password" name="password" placeholder="Password" autofocus autocomplete="current-password" aria-label="Password">
  <input type="hidden" name="next" value="{{next}}">
  <button type="submit">Enter</button>
  <div class="err" role="alert">{{error}}</div>
</form></body></html>
'''


class Handler(BaseHTTPRequestHandler):
    server_version = 'moo-saves'
    sys_version = ''
    cfg = None
    static_root = None
    dev = False

    # ---- plumbing -------------------------------------------------------------------------------------------------
    def log_message(self, fmt, *args):
        log('%s %s' % (self.headers.get('X-Real-IP') or self.client_address[0], fmt % args))

    def send(self, status, body=b'', ctype='text/plain; charset=utf-8', headers=None):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def send_json(self, status, obj, headers=None):
        self.send(status, json.dumps(obj, separators=(',', ':')), 'application/json', headers)

    def read_body(self, limit):
        try:
            n = int(self.headers.get('Content-Length') or '0')
        except ValueError:
            n = -1
        if n < 0 or n > limit:
            return None
        return self.rfile.read(n) if n else b''

    # ---- the gate -------------------------------------------------------------------------------------------------
    def password(self):
        return self.cfg['password']

    def token(self, password):
        return make_token(self.server.secret, password)

    def authed(self):
        pw = self.password()
        if not pw:
            return True
        cookies = self.headers.get('Cookie') or ''
        for part in cookies.split(';'):
            k, _, v = part.strip().partition('=')
            if k == COOKIE and hmac.compare_digest(v.strip(), self.token(pw)):
                return True
        return False

    def original_uri(self):
        # nginx passes X-Original-URI (see deploy/nginx), Caddy's forward_auth X-Forwarded-Uri; --dev uses its own path
        return self.headers.get('X-Original-URI') or self.headers.get('X-Forwarded-Uri') or self.path

    @staticmethod
    def is_open(uri):
        # decide on the path the web server will actually serve: decoded and with dot segments resolved, so
        # /version.txt/../index.html or /.well-known/%2e%2e/index.html cannot ride on an open prefix
        path = posixpath.normpath('/' + urllib.parse.unquote(urllib.parse.urlsplit(uri).path))
        path = '/' + path.lstrip('/')
        return path in OPEN_FILES or any(path.startswith(d) for d in OPEN_DIRS)

    @staticmethod
    def safe_next(uri):
        uri = uri or '/'
        if not uri.startswith('/') or uri.startswith('//') or '\\' in uri or uri.startswith('/api/'):
            return '/'
        return uri

    def secure(self):
        return (self.headers.get('X-Forwarded-Proto') or '').lower() == 'https'

    def login_page(self, nxt, error=''):
        page = LOGIN_PAGE.replace('{{action}}', '/api/login').replace('{{next}}', html.escape(self.safe_next(nxt), quote=True)).replace('{{error}}', html.escape(error))
        self.send(HTTPStatus.UNAUTHORIZED, page, 'text/html; charset=utf-8')

    def redirect(self, location, headers=None):
        h = {'Location': location}
        h.update(headers or {})
        self.send(HTTPStatus.SEE_OTHER, '', headers=h)

    def cookie(self, value, max_age):
        attrs = ['%s=%s' % (COOKIE, value), 'Path=/', 'Max-Age=%d' % max_age, 'HttpOnly', 'SameSite=Lax']
        if self.secure():
            attrs.append('Secure')
        return {'Set-Cookie': '; '.join(attrs)}

    # ---- saves ----------------------------------------------------------------------------------------------------
    def saves_dir(self):
        d = os.path.join(self.cfg['data_dir'], 'saves')
        os.makedirs(d, exist_ok=True)
        return d

    def max_bytes(self):
        try:
            return max(64, int(self.cfg['max_save_kb'])) * 1024
        except ValueError:
            return int(DEFAULTS['max_save_kb']) * 1024

    def list_saves(self):
        d, out = self.saves_dir(), []
        for name in sorted(os.listdir(d)):
            if not name.endswith('.json') or not SLOT_RE.match(name[:-5]):
                continue
            try:
                with open(os.path.join(d, name), encoding='utf-8') as f:
                    info = json.load(f)
                if os.path.exists(os.path.join(d, name[:-5] + '.save')):
                    out.append({'slot': name[:-5], 'meta': info.get('meta'), 'bytes': info.get('bytes'), 'savedAt': info.get('savedAt')})
            except (OSError, ValueError):
                continue
        return out

    def api(self, method, path):
        if path == '/api/status':
            return self.send_json(200, {'ok': True, 'saves': True, 'gate': bool(self.password()), 'maxBytes': self.max_bytes()})
        if path == '/api/saves' and method == 'GET':
            return self.send_json(200, {'saves': self.list_saves()})
        m = re.match(r'^/api/saves/([^/]+)$', path)
        if not m or not SLOT_RE.match(m.group(1)):
            return self.send_json(404, {'error': 'not found'})
        slot = m.group(1)
        d = self.saves_dir()
        blob, meta_path = os.path.join(d, slot + '.save'), os.path.join(d, slot + '.json')
        if method == 'GET':
            try:
                with open(meta_path, encoding='utf-8') as f:
                    info = json.load(f)
                with open(blob, 'rb') as f:
                    data = f.read()
            except (OSError, ValueError):
                return self.send_json(404, {'error': 'empty slot'})
            return self.send(200, data, 'application/octet-stream', {'X-Save-Encoding': info.get('encoding', 'identity')})
        if self.headers.get('X-Requested-With') != 'moo':     # browsers will not add this header cross-site without CORS
            return self.send_json(403, {'error': 'missing X-Requested-With'})
        if method == 'DELETE':
            for p in (meta_path, blob):
                try:
                    os.remove(p)
                except FileNotFoundError:
                    pass
            return self.send_json(200, {'ok': True})
        if method == 'PUT':
            limit = self.max_bytes()
            data = self.read_body(limit)
            if data is None:
                return self.send_json(413, {'error': 'save is larger than %d KB' % (limit // 1024)})
            if not data:
                return self.send_json(400, {'error': 'empty body'})
            enc = self.headers.get('X-Save-Encoding', 'identity')
            if enc not in ('gzip', 'identity'):
                return self.send_json(400, {'error': 'unknown encoding'})
            raw_meta = urllib.parse.unquote(self.headers.get('X-Save-Meta') or '{}')
            try:
                meta = json.loads(raw_meta) if len(raw_meta) <= MAX_META else None
            except ValueError:
                meta = None
            if not isinstance(meta, dict):
                return self.send_json(400, {'error': 'bad X-Save-Meta'})
            info = {'meta': meta, 'encoding': enc, 'bytes': len(data), 'savedAt': int(time.time() * 1000)}
            write_atomic(blob, data)                            # blob first: a slot listed by its .json always has its data
            write_atomic(meta_path, json.dumps(info).encode('utf-8'))
            return self.send_json(200, {'ok': True, 'bytes': len(data)})
        return self.send_json(405, {'error': 'method not allowed'})

    # ---- routing --------------------------------------------------------------------------------------------------
    def route(self, method):
        url = urllib.parse.urlsplit(self.path)
        path = url.path
        try:
            if path == '/api/auth':
                if self.is_open(self.original_uri()) or self.authed():
                    return self.send(HTTPStatus.NO_CONTENT)
                return self.login_page(self.original_uri())       # Caddy shows this body; nginx only reads the status
            if path == '/api/login':
                if method == 'POST':
                    form = urllib.parse.parse_qs((self.read_body(8192) or b'').decode('utf-8', 'replace'))
                    pw, nxt = (form.get('password') or [''])[0], (form.get('next') or ['/'])[0]
                    real = self.password()
                    if not real or hmac.compare_digest(pw.encode('utf-8'), real.encode('utf-8')):
                        return self.redirect(self.safe_next(nxt), self.cookie(self.token(real), COOKIE_DAYS * 86400) if real else None)
                    time.sleep(0.5)
                    return self.login_page(nxt, 'That is not the password.')
                nxt = (urllib.parse.parse_qs(url.query).get('next') or [self.original_uri()])[0]
                return self.redirect(self.safe_next(nxt)) if self.authed() else self.login_page(nxt)
            if path == '/api/logout':
                return self.redirect('/', self.cookie('', 0))
            if path.startswith('/api/'):
                if not self.authed():
                    return self.send_json(401, {'error': 'login required'})
                return self.api(method, path)
            if self.static_root and method in ('GET', 'HEAD'):
                if not (self.is_open(self.path) or self.authed()):
                    return self.login_page(self.path)
                return self.static(path)
            return self.send_json(404, {'error': 'not found'})
        except BrokenPipeError:
            pass
        except Exception as e:                                  # one bad request must never take the server down
            log('error on %s %s: %r' % (method, self.path, e))
            try:
                self.send_json(500, {'error': 'server error'})
            except Exception:
                pass

    def static(self, path):
        rel = urllib.parse.unquote(path).lstrip('/') or 'index.html'
        full = os.path.realpath(os.path.join(self.static_root, rel))
        if os.path.isdir(full):
            full = os.path.join(full, 'index.html')
        if not (full == self.static_root or full.startswith(self.static_root + os.sep)) or '/.' in '/' + rel or not os.path.isfile(full):
            return self.send(404, 'not found')
        with open(full, 'rb') as f:
            data = f.read()
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype in ('application/javascript', 'application/json'):
            ctype += '; charset=utf-8'
        self.send(200, data, ctype)

    def do_GET(self):
        self.route('GET')

    def do_HEAD(self):
        self.route('HEAD')

    def do_POST(self):
        self.route('POST')

    def do_PUT(self):
        self.route('PUT')

    def do_DELETE(self):
        self.route('DELETE')


def main():
    ap = argparse.ArgumentParser(description='Save server and password gate for Master of Orion — Reborn.')
    ap.add_argument('--config', default='/etc/moogenesis/moo.conf', help='config file (default: %(default)s; missing = defaults)')
    ap.add_argument('--listen', help='host:port (overrides the config)')
    ap.add_argument('--data-dir', help='where saves and the cookie key live (overrides the config)')
    ap.add_argument('--password', help='overrides the config ("" turns the gate off)')
    ap.add_argument('--dev', action='store_true', help='local play: serve the game files too (from --static, default: the checkout)')
    ap.add_argument('--static', help='directory with index.html to serve (implies --dev)')
    ap.add_argument('--print-cookie', action='store_true', help='print the login cookie for the current password (for health checks run as root) and exit')
    a = ap.parse_args()

    overrides = {}
    if a.listen:
        overrides['listen'] = a.listen
    if a.data_dir:
        overrides['data_dir'] = a.data_dir
    if a.password is not None:
        overrides['password'] = a.password
    checkout = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if a.dev or a.static:
        overrides.setdefault('listen', '127.0.0.1:8765')
        overrides.setdefault('data_dir', os.path.join(checkout, 'server', 'dev-data'))
        Handler.static_root = os.path.realpath(a.static or checkout)
        if not os.path.isfile(os.path.join(Handler.static_root, 'index.html')):
            ap.error('no index.html in %s' % Handler.static_root)
    cfg = Config(a.config if os.path.exists(a.config) or not (a.dev or a.static) else None, overrides)
    Handler.cfg = cfg
    if a.print_cookie:                                      # never creates the key: root must not leave a file the service cannot read
        secret = read_secret(cfg['data_dir'], create=False)
        if cfg['password'] and secret:
            print('%s=%s' % (COOKIE, make_token(secret, cfg['password'])))
        return

    host, _, port = cfg['listen'].rpartition(':')
    httpd = ThreadingHTTPServer((host.strip('[]') or '127.0.0.1', int(port)), Handler)
    httpd.daemon_threads = True
    httpd.secret = read_secret(cfg['data_dir'])
    log('listening on %s · data %s · password gate %s%s' % (cfg['listen'], cfg['data_dir'], 'on' if cfg['password'] else 'OFF',
                                                         ' · serving ' + Handler.static_root if Handler.static_root else ''))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
