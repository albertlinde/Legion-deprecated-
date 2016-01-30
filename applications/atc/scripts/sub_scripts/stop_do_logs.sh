
#kill iptraf
ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/

#rm logs
rm *.log

ps -A | awk '/iptraf/ {print "sudo kill -9 "$1}' | bash
sudo rm -r /var/run/iptraf/
