#!/usr/bin/env bash
sudo iptables -A INPUT -s 216.58.217.142 -j DROP
sudo iptables -A INPUT -s 216.58.216.142 -j DROP
sudo iptables -A INPUT -s 173.194.33.0/24 -j DROP
sudo iptables -A INPUT -s 173.194.121.0/24 -j DROP
sudo iptables -A INPUT -s 173.194.0.0/16 -j DROP
sudo iptables -A INPUT -s 216.58.216.0/24 -j DROP
sudo iptables -A INPUT -s 216.58.0.0/16 -j DROP
sudo iptables -A INPUT -s 74.125.228.0/24 -j DROP
