
if [ -d "logs" ]; then
  echo Folder logs exists. Cancelling.
  exit 1
fi

runs=( "4_4" "8_8" "16_16" )

allIps=( 52.38.198.111 54.89.48.243 52.34.193.24 54.175.120.230 52.38.32.215 52.90.24.3 52.32.125.192 54.82.232.95 52.27.96.94 54.85.115.124 52.38.201.71 52.90.245.42 52.37.12.210 52.91.118.194 52.34.218.255 54.89.59.25 )

for ip in "${allIps[@]}"
do
    echo Running PYTHON  at ip: "${ip}".
    ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/run_do_python.sh &
    sleep 0.5
done
#sleep 20

files=( "?id=0Bx-QiF4z2CEtRzNiVEd0Nzg5MVk" "?id=0Bx-QiF4z2CEtdGM5VE1VT3VYQ3M" "?id=0Bx-QiF4z2CEtVlJjVmFyMkRDTGs" "?id=0Bx-QiF4z2CEtNERiNFpoV2ROa00" "?id=0Bx-QiF4z2CEtdjNVRVU3WnA3OHM" "?id=0Bx-QiF4z2CEtZFljcTItQUpLdVU" )

file_num=0
var=0
start=0;
end=4
for run in "${runs[@]}"
do
now_runs=1
if [ ${end} == 32 ]; then
    now_runs=2
fi
if [ ${end} == 64 ]; then
    now_runs=4
fi

echo "Run: " ${run} IPs: ${start} : ${end} #: ${now_runs}

ips=("${allIps[@]:$start:$end}")

## Run X..Y
for curr in {1..2}
do

echo "Test: " ${files[${file_num}]} " Run: "${curr}


for now_runs_i in $(seq 1 ${now_runs})
do
    for ip in "${ips[@]}"
    do
        echo Running at ip: "${ip}" : run_do_${now_runs_i}_${files[${file_num}]}.sh
        ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/run_do.sh ${files[${file_num}]} &
        sleep 5
    done
done

    echo sleep
    sleep 1
    sleep 500

    echo Done sleeping

    #stop all

    for ip in "${ips[@]}"
    do
        echo Stopping "${ip}" : stop_do.sh
        ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/stop_do.sh &
    done

    sleep 20
    #logs
    mkdir logs
    for ip in "${ips[@]}"
    do
        echo Getting logs from "${ip}"
        scp -o "StrictHostKeyChecking no" -i ./llcproto.pem ubuntu@${ip}:~/*.log logs/
        mv logs/run1.log logs/run1_${ip}.log
        mv logs/run2.log logs/run2_${ip}.log
        mv logs/run3.log logs/run3_${ip}.log
        mv logs/run4.log logs/run4_${ip}.log
        mv logs/run5.log logs/run5_${ip}.log
        mv logs/run6.log logs/run6_${ip}.log
        mv logs/run7.log logs/run7_${ip}.log
        mv logs/run8.log logs/run8_${ip}.log
        mv logs/run9.log logs/run9_${ip}.log
        mv logs/run10.log logs/run10_${ip}.log
        scp -o "StrictHostKeyChecking no" -i ./llcproto.pem ubuntu@${ip}:~/network_client.log logs/network_client_${ip}.log
        sleep 1
    done

    #stop all and rem logs
    for ip in "${ips[@]}"
    do
        echo Stopping "${ip}" : stop_do_logs.sh
        ssh -o "StrictHostKeyChecking no" -x -i ./llcproto.pem ubuntu@${ip} 'bash -s' < ./sub/stop_do_logs.sh &
        sleep 1
    done

    #end stop all

    echo Moving logs to logs_${run}_${curr}
    mv logs logs_latency_ReallyLegion_${run}_${curr}

    file_num=$((file_num+1));
    sleep 20
done

##
##
##
##
##
var=$((var+1))
end=$((end*2))

done
exit 0




