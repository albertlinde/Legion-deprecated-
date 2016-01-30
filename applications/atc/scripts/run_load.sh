#!/usr/bin/env bash

#TODO: change run_load_do.sh
#TODO: change folder name at the end of script
#TODO: sync with master
#TODO: run at master

if [ -d "logs" ]; then
  echo Folder logs exists. Cancelling.
  exit 1
fi

#adds client ips interleaved
Ips=(  )


#server start
for ip in "${Ips[@]}"
    do
        echo Running at ip: "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/startServer.sh &
    done
sleep 15

    for ip in "${Ips[@]}"
    do
        echo Running at ip: "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/run_load_do.sh &
        sleep 5
    done

    echo Sleep  # 16 * 5 + 110 + 300
    sleep 540
    echo Done sleeping

    for ip in "${Ips[@]}"
    do
        echo Stopping "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/stop_do.sh &
        sleep 0.25
    done

    #logs
    mkdir logs
    for ip in "${Ips[@]}"
    do
        echo Getting logs from "${ip}"
        scp -o "StrictHostKeyChecking no" -i ./../llcproto.pem ubuntu@${ip}:~/run.log logs/run_${ip}.log
        scp -o "StrictHostKeyChecking no" -i ./../llcproto.pem ubuntu@${ip}:~/network_client.log logs/network_client_${ip}.log
    done

    for ip in "${Ips[@]}"
    do
        echo Finalizing "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/stop_do_logs.sh &
        sleep 0.5
    done

    echo Moving logs
    mv logs logs_30Jan_XX


#server stop
for ip in "${Ips[@]}"
    do
        echo Running at ip: "${ip}".
        ssh -o "StrictHostKeyChecking no" -x -i ./../llcproto.pem ubuntu@${ip} 'bash -s' < ./sub_scripts/stopServer.sh &
        sleep 1
    done
sleep 15

echo All done!
exit 0




