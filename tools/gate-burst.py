#!/usr/bin/env python3
# Burst test for the password gate (server/moo-saves.py). A page load makes the web server ask GET /api/auth once per
# file, ~150 at the same moment, each on a new connection (nginx auth_request; Caddy forward_auth until its pool is warm).
# With Python's default listen backlog of 5 most of those connections overflowed the queue, the kernel dropped them, and
# the client only retried after TCP's 1 s / 3 s / 7 s / 15 s / 31 s back-off: a few files of every first load arrived
# seconds late and held up the boot bar.
#
#   python3 tools/gate-burst.py [N]      # starts the server on a free port, fires N (default 300) simultaneous checks
# Exit status 1 when the slowest check takes more than a second.
import os
import socket
import subprocess
import sys
import tempfile
import threading
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
N = int(sys.argv[1]) if len(sys.argv) > 1 else 300


def free_port():
    s = socket.socket()
    s.bind(('127.0.0.1', 0))
    p = s.getsockname()[1]
    s.close()
    return p


def check(port, out, i, go):
    go.wait()
    t0 = time.monotonic()
    try:
        s = socket.create_connection(('127.0.0.1', port), timeout=60)
        s.sendall(b'GET /api/auth HTTP/1.1\r\nHost: x\r\nX-Forwarded-Uri: /js/core/ns.js\r\nConnection: close\r\n\r\n')
        data = b''
        while True:
            b = s.recv(65536)
            if not b:
                break
            data += b
        s.close()
        out[i] = (time.monotonic() - t0, data.split(b' ', 2)[1].decode() if data else 'none')
    except OSError as e:
        out[i] = (time.monotonic() - t0, 'error ' + str(e))


def main():
    port = free_port()
    data = tempfile.mkdtemp(prefix='moo-gate-')
    srv = subprocess.Popen([sys.executable, os.path.join(ROOT, 'server', 'moo-saves.py'), '--config', os.path.join(data, 'none.conf'),
                            '--listen', '127.0.0.1:%d' % port, '--data-dir', data, '--password', 'burst-test'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(100):
            try:
                socket.create_connection(('127.0.0.1', port), timeout=1).close()
                break
            except OSError:
                time.sleep(0.05)
        out, go = [None] * N, threading.Event()
        ts = [threading.Thread(target=check, args=(port, out, i, go)) for i in range(N)]
        for t in ts:
            t.start()
        go.set()
        for t in ts:
            t.join()
    finally:
        srv.terminate()
        srv.wait()
    times = sorted(o[0] for o in out)
    codes = {}
    for o in out:
        codes[o[1]] = codes.get(o[1], 0) + 1
    print('%d simultaneous checks: median %.3f s, slowest %.3f s, over 0.9 s: %d; answers %s' % (
        N, times[N // 2], times[-1], sum(1 for t in times if t > 0.9), codes))
    sys.exit(1 if times[-1] > 1.0 else 0)


if __name__ == '__main__':
    main()
