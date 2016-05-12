sudo iptraf -i eth0 -B -L ./network_client.log
sleep 1
cd run-headless-chromium/
./run-headless-chromium.js "http://localhost:8000/applications/tests/load_map_b2b_init.html?id=0Bx-QiF4z2CEtOEdFZmJ5bkJoX0U" --user-data-dir=. > ./../run.log