package legion;

import java.io.File;
import java.io.FileNotFoundException;
import java.util.*;


public class Disconnect {

    public static Integer clientCount = 4;
    public static Integer window = 1 * 1000;

    public static List<Double> allUpdates = new ArrayList<Double>();
    public static Map<Integer, SortedSet<Double>> individualSets = new TreeMap<Integer, SortedSet<Double>>();
    public static Map<Integer, SortedMap<Double, Double>> individualGottenSets = new TreeMap<Integer, SortedMap<Double, Double>>();

    public static void main(String[] args) {
        for (int i = 1; i <= clientCount; i++) {
            SortedSet<Double> clientUpdates = new TreeSet<Double>();
            SortedMap<Double, Double> clientGotten = new TreeMap<Double, Double>();
            individualSets.put(i, clientUpdates);
            individualGottenSets.put(i, clientGotten);
        }
        for (int i = 1; i <= clientCount; i++) {
            //File f = new File("./src/com/company/data_disconnect" + i + "_b.txt");
            File f = new File("folder/" + i + ".log");
            System.out.println(f.getAbsoluteFile());

            Scanner s = null;
            try {
                s = new Scanner(f);
                while (s.hasNextLine()) {
                    parse(s.nextLine(), i);
                }
            } catch (FileNotFoundException e) {
                e.printStackTrace();
            }

        }
        Collections.sort(allUpdates);

        Double first = allUpdates.get(0);
        Double last = allUpdates.get(allUpdates.size() - 1);

        System.out.println("First: " + first);
        System.out.println("Last: " + last);
        System.out.println("Interval: " + (last - first));
        System.out.println("Intervals: " + (last - first) / (window));
        System.out.println("Updates: " + allUpdates.size());

        int nasd = 0;
        for (Double interval = first; interval <= last + window; interval += window) {
            double totel = 0;
            double gott = 0;
            for (int i = 1; i <= clientCount; i++) {
                SortedMap<Double, Double> clientGotten = individualGottenSets.get(i);

                double totalUpdates = 0;
                double gottenUpdates = 0;
                for (Double d : allUpdates) {
                    if (d < interval) totalUpdates++;
                }
                for (double n = interval; n >= first; n--) {
                    if (clientGotten.containsKey(n)) {
                        gottenUpdates = clientGotten.get(n);
                        break;
                    }
                }
                totel += totalUpdates;
                gott += gottenUpdates;
            }
            totel = totel / clientCount;
            gott = gott / clientCount;
            //System.out.println("Per: " + (((int) gott) / ( totel+1)) + " Total: " + (int) totel + " Gotten: " + (int) gott);
            System.out.println(++nasd + " " + (((int) gott) / (totel + 1)));
            //System.out.println(rcc);
        }
    }

    public static void parse(String s, int i) {
        if (s.startsWith(" ")) {
            parse(s.substring(1), i);
        } else if (s.contains("gapi")) {
            parse(s.substring(s.indexOf(' ')), i);
        } else {
            if (s.contains("update")) {
                Double time = Double.parseDouble(s.split(" ")[1]);
                allUpdates.add(time);
                individualSets.get(i).add(time);
            }
            if (s.contains("gotten")) {
                Double time = Double.parseDouble(s.split(" ")[1]);
                Double amount = Double.parseDouble(s.split(" ")[2]);
                individualGottenSets.get(i).put(time, amount);
            }
        }
    }
}
