#!/usr/bin/env bash

ip_or=A
ip_nv=B

rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./../../../. ubuntu@${ip_or}:~/Legion/.
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./../../../. ubuntu@${ip_nv}:~/Legion/.

ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip_or} 'bash -s' < send_to_slaves_or.sh
ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip_nv} 'bash -s' < send_to_slaves_nv.sh
