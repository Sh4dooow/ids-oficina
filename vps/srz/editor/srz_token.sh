#!/bin/bash
# Imprime el token del MCP de SRZ Editor (lo mantiene Ivan en el Google Doc "token_srz" de la carpeta OFICINA).
rclone cat --drive-export-formats txt gdrive:token_srz.txt 2>/dev/null | python3 -c 'import sys; t=sys.stdin.buffer.read().decode("utf-8","ignore").replace("﻿",""); print("".join(c for c in t if c.isalnum() or c in "_-."), end="")'
