#ips=( 52.34.193.24 52.38.32.215 52.32.125.192 52.27.96.94 52.38.201.71 52.37.12.210 52.34.218.255 )
Ips=( 52.38.198.111 54.89.48.243 52.34.193.24 54.175.120.230 52.38.32.215 52.90.24.3 52.32.125.192 54.82.232.95 52.27.96.94 54.85.115.124 52.38.201.71 52.90.245.42 52.37.12.210 52.91.118.194 52.34.218.255 54.89.59.25 )

#ips=( 54.175.120.230 52.90.24.3 54.82.232.95 54.85.115.124 52.90.245.42 52.91.118.194 54.89.59.25 )
for ip in "${Ips[@]}"
do
    echo Setting up "${ip}".
    ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/setupClient.sh
    rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ~/Legion ubuntu@${ip}:~/.

    #rsync -avz -e "ssh -o StrictHostKeyChecking=no -i llcproto.pem" ~/run-headless-chromium ubuntu@${ip}:~/.

    sleep .45
done
echo All done.
exit 0