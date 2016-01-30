#!/usr/bin/env bash

ips=( ) #TODO
for ip in "${ips[@]}"
do
    rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./Legion/. ubuntu@${ip}:~/Legion/.
    rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./run-headless-chromium/. ubuntu@${ip}:~/run-headless-chromium/.
done