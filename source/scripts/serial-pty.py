import json
import os
import pty
import select
import sys

master, slave = pty.openpty()
print(json.dumps({'path': os.ttyname(slave)}), flush=True)
for command in sys.stdin:
    if command.strip() == 'send':
        os.write(master, b'DISPLAY:PTY live\n')
    elif command.strip() == 'read':
        ready, _, _ = select.select([master], [], [], 3)
        print(json.dumps({'received': os.read(master, 4096).decode() if ready else ''}), flush=True)
