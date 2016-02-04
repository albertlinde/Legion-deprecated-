#!/usr/bin/env bash

ip_or=52.27.50.22
ip_nv=54.175.49.66
ip=54.86.104.60

rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./../../../. ubuntu@${ip_or}:~/Legion/.
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./../../../. ubuntu@${ip_nv}:~/Legion/.
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ./../../../. ubuntu@${ip}:~/Legion/.

ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip_or} 'bash -s' < ./sub_scripts/send_to_slaves_or.sh
ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip_nv} 'bash -s' < ./sub_scripts/send_to_slaves_nv.sh
