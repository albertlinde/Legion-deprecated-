#!/usr/bin/env bash

#EACH EXP
#TODO: change run_do_load.sh
#TODO: change LegionRealtimeUtils
#TODO: change folder name at the end of script
#TODO: sync with master (recursive sync to all)
#TODO: run at master

if [ -d "logs" ]; then
  echo Folder logs exists. Cancelling.
  exit 1
fi

#adds client ips interleaved
Ips=( 52.38.198.111 54.89.48.243 52.34.193.24 54.175.120.230 52.38.32.215 52.90.24.3 52.32.125.192 54.82.232.95 52.27.96.94 54.85.115.124 52.38.201.71 52.90.245.42 52.37.12.210 52.91.118.194 52.34.218.255 54.89.59.25 )


    for ip in "${Ips[@]}"
    do
        echo Running at ip: "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/run_do_load.sh &
        sleep 7
    done

    #next only applies on disconnect tests.
    #sleep 120
    #for ip in "${Ips[@]}"
    #do
    #    echo Stopping "${ip}".
    #    ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/firewall_block.sh &
    #done
    #sleep 60
    #for ip in "${Ips[@]}"
    #do
    #    echo Stopping "${ip}".
    #    ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/firewall_un_block.sh &
    #done

    echo Sleep  # 16 * 5 + 110 + 300
    sleep 700
    echo Done sleeping

    for ip in "${Ips[@]}"
    do
        echo Stopping "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/stop_do.sh &
        sleep 0.25
    done

    sleep 10
    #logs
    mkdir logs
    for ip in "${Ips[@]}"
    do
        echo Getting logs from "${ip}"
        scp -o "StrictHostKeyChecking no" -i ./../llcproto.pem ubuntu@${ip}:~/log.tar.gz logs/log_${ip}.tar.gz
    done

    for ip in "${Ips[@]}"
    do
        echo Finalizing "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/stop_do_logs.sh &
        sleep 0.5
    done

    echo Moving logs
    mv logs b2b_legionbackend_init_2

echo All done!
exit 0



