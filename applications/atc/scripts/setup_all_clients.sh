ips=( )
for ip in "${ips[@]}"
do
    echo Seting up "${ip}".
    ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/setupClient.sh
    sleep .45
done
echo All done.
exit 0