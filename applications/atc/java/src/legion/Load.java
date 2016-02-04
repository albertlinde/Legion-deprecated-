package legion;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.*;

public class Load {

    static String useast = "54.175.91.143 172.31.46.192A" +
            "54.164.156.67 172.31.35.178A" +
            "54.175.97.196 172.31.45.113A" +
            "52.91.37.72 172.31.36.173A" +
            "54.175.98.49 172.31.41.99A" +
            "54.175.97.204 172.31.35.155A" +
            "54.84.236.19 172.31.37.251A" +
            "54.175.97.250 172.31.40.103 ";
    static String uswest = "52.88.57.33 172.31.9.218A" +
            "52.89.234.76 172.31.3.81A" +
            "52.89.235.134 172.31.5.212A" +
            "54.68.10.29 172.31.0.184A" +
            "52.89.235.68 172.31.4.155A" +
            "52.88.116.164 172.31.0.133A" +
            "52.26.38.53 172.31.1.68A" +
            "52.32.216.210 172.31.1.222 ";


    static String Server_ip_pub = "54.86.104.60";
    static String Server_ip_pri = "172.31.42.197";

    static String Server_ip_m1_pub = "54.175.49.66";
    static String Server_ip_m1_pri = "172.31.45.70";
    static String Server_ip_m2_pub = "52.27.50.22";
    static String Server_ip_m2_pri = "172.31.8.18";

    static String local = "193.136.122.18";


    public static class Instance {
        public String publicIP;
        public String privateIP;
        public String zone;

        public Instance(String zone, String publicIP, String privateIP) {
            this.publicIP = publicIP;
            this.privateIP = privateIP;
            this.zone = zone;
        }

        @Override
        public String toString() {
            return "I:" + zone + ":" + publicIP + ":" + privateIP;
        }
    }

    static Map<String, Instance> publicIps = new HashMap<String, Instance>();
    static Map<String, Instance> privateIps = new HashMap<String, Instance>();
    static Set<String> ipmap = new HashSet<String>();

    static Set<String> node_servers = new TreeSet<String>();
    static double
            bytes_node = 0.0,
            bytes_local_server = 0.0,
            bytes_drive = 0.0,
            bytes_peers_same_zone = 0.0,
            bytes_peers_not_same_zone = 0.0,
            other = 0.0;


    public static void main(String[] args) throws FileNotFoundException {
        node_servers.add(Server_ip_pub);
        node_servers.add(Server_ip_pri);

        node_servers.add(Server_ip_m1_pub);
        node_servers.add(Server_ip_m1_pri);

        node_servers.add(Server_ip_m2_pub);
        node_servers.add(Server_ip_m2_pri);

        for (String s : useast.split("A")) {
            System.out.println(s);
            String[] stuff = s.split(" ");
            Instance i = new Instance("useast", stuff[0], stuff[1]);
            publicIps.put(stuff[0], i);
            privateIps.put(stuff[1], i);
            ipmap.add(stuff[0]);
            ipmap.add(stuff[1]);
        }

        for (String s : uswest.split("A")) {
            System.out.println(s);
            String[] stuff = s.split(" ");
            Instance i = new Instance("uswest", stuff[0], stuff[1]);
            publicIps.put(stuff[0], i);
            privateIps.put(stuff[1], i);
            ipmap.add(stuff[0]);
            ipmap.add(stuff[1]);
        }

        File folder = new File("folder/");
        System.out.println("Processing folder:" + folder.getAbsolutePath());
        File[] listOfFiles = folder.listFiles();

        for (int i = 0; i < listOfFiles.length; i++) {
            if (listOfFiles[i].isFile() && listOfFiles[i].getName().startsWith("network")) {
                System.out.println("Processing file:" + listOfFiles[i].getName());
                try {
                    Scanner s = new Scanner(listOfFiles[i]);
                    while (s.hasNextLine()) {
                        String toParse = s.nextLine();
                        while (toParse.contains("  "))
                            toParse = toParse.replaceAll("  ", " ");
                        try {
                            parse(toParse);
                        } catch (Exception e) {
                            System.err.println(toParse);
                            e.printStackTrace();
                            return;
                        }
                    }
                } catch (FileNotFoundException e) {
                    e.printStackTrace();
                    return;
                }
            }
        }
        System.out.println("All done.");
        System.out.format("Node : %15.0f\n", bytes_node);
        System.out.format("LocalServer: %15.0f\n", bytes_local_server);
        System.out.format("GDrive: %15.0f\n", bytes_drive);
        System.out.format("PeersZ : %15.0f\n", bytes_peers_same_zone);
        System.out.format("PeersNZ : %15.0f\n", bytes_peers_not_same_zone);
        System.out.format("Other : %15.0f\n", other);
    }


    private static void parse(String s) throws Exception {
        String[] data = s.split(" ");
        if (s.contains("ICMP")) {
            return;
        } else if (s.contains("IGMP")) {
            return;
        } else if (s.contains("******** IP traffic monitor started ********")) {
            return;
        } else if (s.contains("UDP")) {
            add(data[7], data[10], data[12], s);
            return;
        } else if (s.contains("FIN acknowleged")) {
            add(data[7], data[10], data[12], s);
            return;
        } else if (s.contains("first packet")) {
            add(data[7], data[10], data[12], s);
            return;
        } else if (s.contains("FIN sent")) {
            add(data[7], data[10], data[12], s);
            add(data[17], data[10], data[12], s);
            return;
        } else if (s.contains("Connection reset")) {
            add(data[7], data[10], data[12], s);
            add(data[17], data[10], data[12], s);
            return;
        }
        throw new Exception();
    }

    private static void add(String bytes, String from, String to, String s) {
        from = from.split(":")[0];
        to = to.split(":")[0];

        long l_bytes = Long.parseLong(bytes);
        if (s.contains(local)) {
            bytes_local_server += l_bytes;
            return;
        }
        try {
            Instance i1 = null, i2 = null;
            if (from.startsWith("1")) {
                i1 = privateIps.get(from);
            } else if (from.startsWith("5")) {
                i1 = publicIps.get(from);
            }
            if (to.startsWith("1")) {
                i2 = privateIps.get(to);
            } else if (to.startsWith("5")) {
                i2 = publicIps.get(to);
            }
            if (i1 != null && i2 != null) {
                if (i1.zone.equals(i2.zone)) {
                    bytes_peers_same_zone += l_bytes;
                } else {
                    bytes_peers_not_same_zone += l_bytes;
                }
            } else if (i1 != null || i2 != null) {
                if (mine(to.split(":")[0]) || mine(from.split(":")[0])) {
                    bytes_node += l_bytes;
                } else {
                    if ((s.contains("TCP"))) {
                        bytes_drive += l_bytes;
                    } else {
                        other += l_bytes;
                    }
                }
            } else {
                System.err.println(s);
            }
        } catch (Exception e) {
            System.err.println(s);
            e.printStackTrace();
        }
    }

    private static boolean mine(String s) {
        return node_servers.contains(s);
    }
}
