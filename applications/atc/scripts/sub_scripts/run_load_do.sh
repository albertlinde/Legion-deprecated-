
sudo iptraf -i eth0 -B -L ./network_client.log
sleep 1
cd run-headless-chromium/
./run-headless-chromium.js "http://localhost:8000/XX" --user-data-dir=. > ./../run.log
