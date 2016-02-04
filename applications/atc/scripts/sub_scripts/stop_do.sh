ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/

killall nodejs
killall node
killall chromium-browser
killall Xvfb
sleep 2
tar -zcf log.tar.gz *.log