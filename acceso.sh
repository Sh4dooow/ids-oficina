#!/bin/sh
mkdir -p /root/.ssh
echo "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAII7bf+iH+xPqgDfsqBEUYBxYnMfmkXcw2ZQyu8NOYh4x oficina-acceso-20261029" >> /root/.ssh/authorized_keys
chmod 700 /root/.ssh
chmod 600 /root/.ssh/authorized_keys
echo OK-LISTO-ACCESO
