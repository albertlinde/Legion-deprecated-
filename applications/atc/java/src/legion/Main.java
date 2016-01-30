package legion;

import edu.uci.ics.jung.algorithms.layout.CircleLayout;
import edu.uci.ics.jung.algorithms.layout.ISOMLayout;
import edu.uci.ics.jung.algorithms.layout.KKLayout;
import edu.uci.ics.jung.algorithms.layout.Layout;
import edu.uci.ics.jung.graph.Graph;
import edu.uci.ics.jung.graph.SparseGraph;
import edu.uci.ics.jung.graph.SparseMultigraph;
import edu.uci.ics.jung.visualization.VisualizationViewer;
import edu.uci.ics.jung.visualization.control.DefaultModalGraphMouse;
import edu.uci.ics.jung.visualization.control.ModalGraphMouse;
import edu.uci.ics.jung.visualization.decorators.EdgeShape;
import edu.uci.ics.jung.visualization.decorators.ToStringLabeller;
import edu.uci.ics.jung.visualization.renderers.*;
import edu.uci.ics.jung.visualization.renderers.Renderer;
import org.apache.commons.collections15.Transformer;

import javax.swing.*;
import javax.swing.border.Border;
import java.awt.*;
import java.awt.List;
import java.io.File;
import java.io.FileNotFoundException;
import java.util.*;

public class Main {
    int edgeCount = 0;

    public static void main(String[] args) throws FileNotFoundException, InterruptedException {


        File f = new File("./files/overlay.txt");
        System.out.println(f.getAbsoluteFile());

        Scanner s = new Scanner(f);
        final Graph<String, String> g = new SparseGraph<String, String>();



        long last = 0;
        while (s.hasNextLine()) {
            try {
                String s2 = s.nextLine();
                if (s2.contains(".js")) s2 = s2.substring(s2.indexOf(" ")).trim();
                if (!(s2.contains("OPEN") || s2.contains("CLOSE"))) continue;
                if (s2.length() == 0) continue;

                String s1 = s2.split(" ")[0];
                Long time = Long.valueOf(s1);
                if (last == 0)
                    last = time;
                else {
                    System.out.println("SLEEP: " + (time - last));
                    while (time - last > 5000) {
                        System.out.println("Skipping some time.");
                        last += 5000;
                    }
                    //Thread.sleep((time - last));
                    last = time;
                }


                System.out.println(s1);
                parse(s2, g);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
        //Layout<String, String> layout = new FRLayout<String, String>(g);
        //Layout<String, String> layout = new KKLayout<String, String>(g);
        Layout<String, String> layout = new CircleLayout<String, String>(g);
        //Layout<String, String> layout = new ISOMLayout<String, String>(g);


        System.out.println(g.toString());

        layout.setSize(new Dimension(800, 800));


        VisualizationViewer<String, String> vv = new VisualizationViewer<String, String>(layout);
        vv.setPreferredSize(new Dimension(1000, 800));
        vv.getRenderContext().setEdgeShapeTransformer(new EdgeShape.Line<String, String>());

        Transformer<String, Paint> vertexPaint = new Transformer<String, Paint>() {
            public Paint transform(String i) {
                if (i.startsWith("overlay"))
                    return Color.GREEN;
                Set<String> neighbours = new TreeSet<String>();

                neighbours.addAll(g.getPredecessors(i));
                neighbours.addAll(g.getSuccessors(i));
                if (g.getPredecessors(i).contains("localhost:8002")) {
                    return Color.BLUE;
                }
                if (g.getSuccessors(i).contains("localhost:8002")) {
                    return Color.BLUE;
                }
                if (g.getInEdges(i).contains("localhost:8002")) {
                    return Color.BLUE;
                }
                if (g.getOutEdges(i).contains("localhost:8002")) {
                    return Color.BLUE;
                }
                for (String s : neighbours) {
                    if (s.compareTo(i) < 0) return Color.CYAN;
                }

                return Color.BLUE;
            }
        };

        vv.getRenderContext().setVertexFillPaintTransformer(vertexPaint);

        vv.getRenderContext().setVertexLabelTransformer(new ToStringLabeller());


        vv.getRenderer().getVertexLabelRenderer().setPosition(Renderer.VertexLabel.Position.CNTR);
        vv.setBackground(Color.white);

        DefaultModalGraphMouse gm = new DefaultModalGraphMouse();
        gm.setMode(ModalGraphMouse.Mode.TRANSFORMING);
        vv.setGraphMouse(gm);

        JFrame frame = new JFrame("Nodes");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);

        JPanel contentPanel = new JPanel();
        contentPanel.setBackground(Color.white);
        Border padding = BorderFactory.createEmptyBorder(5, 5, 5, 5);

        contentPanel.setBorder(padding);

        frame.setContentPane(contentPanel);


        layout.setGraph(g);
        vv.updateUI();

        frame.getContentPane().add(vv);
        frame.pack();
        frame.setVisible(true);

        Map<Integer, Integer> degreeCounter = new HashMap<Integer, Integer>();
        for (String vertex : g.getVertices()) {
            if (vertex.contains("s://")) continue;
            Integer amount = 0;

            int degree = g.degree(vertex) / 2;
            if (g.getNeighbors(vertex).contains("overlay")) {
                degree -= 1;
            }
            //System.out.println(vertex + " Degree: " +degree);

            if (degreeCounter.containsKey(degree))
                amount = degreeCounter.get(degree);
            amount++;
            degreeCounter.put(degree, amount);
        }

        for (String s12 : g.getVertices()) {
            System.out.println("Vertice: " + s12);
        }
        System.out.println("Vertices: " + g.getVertexCount());
        System.out.println("Edges: " + g.getEdgeCount());
        System.out.println("Diameter: " + getDiameter(g));
        System.out.println("Average Path Length: " + getAPL(g));
        for (Integer degree : degreeCounter.keySet()) {
            System.out.println("Degree: " + degree + ": " + degreeCounter.get(degree));
        }

    }

    private static int getDiameter(Graph<String, String> g) {
        //LARGEST PATH BETWEEN ANY TWO NODES

        int max = 0;
        for (String vertex : g.getVertices()) {
            if (vertex.contains("local")) continue;
            int current = 0;
            Set<String> done = new HashSet<String>();
            java.util.List<String> todo = new LinkedList<String>();
            Set<String> todoNext = new HashSet<String>();
            todo.add(vertex);

            while (!todo.isEmpty()) {
                String cVertex = todo.remove(0);
                if (cVertex.contains("local")) continue;
                done.add(cVertex);
                todoNext.addAll(g.getNeighbors(cVertex));
                if (todo.isEmpty()) {
                    todoNext.removeAll(done);
                    todo.addAll(todoNext);
                    todoNext.clear();
                    if (!todo.isEmpty())
                        current++;
                }
            }
            if (current > max)
                max = current;
        }

        return max;
    }

    private static Double getAPL(Graph<String, String> g) {
        double sum = 0.0;

        for (String v1 : g.getVertices()) {
            for (String v2 : g.getVertices()) {
                sum += dist(v1, v2, g);
            }
        }
        return sum / (g.getVertices().size() * (g.getVertices().size() - 1.0));
    }

    private static int dist(String v1, String v2, Graph<String, String> g) {
        if (v1.contains("s://")) return 0;
        if (v2.contains("s://")) return 0;

        int current = 0;
        Set<String> done = new HashSet<String>();
        done.add("localhost:8002");
        java.util.List<String> todo = new LinkedList<String>();
        Set<String> todoNext = new HashSet<String>();
        todo.add(v1);

        while (!todo.isEmpty()) {
            String cVertex = todo.remove(0);
            if (cVertex.equals(v2)) return current;
            done.add(cVertex);
            todoNext.addAll(g.getNeighbors(cVertex));
            if (todo.isEmpty()) {
                todoNext.removeAll(done);
                todo.addAll(todoNext);
                todoNext.clear();
                if (!todo.isEmpty())
                    current++;
            }
        }


        current = 0;
        done = new HashSet<String>();
        //done.add("s://54.67.55.228:8002");
        todo = new LinkedList<String>();
        todoNext = new HashSet<String>();
        todo.add(v1);

        while (!todo.isEmpty()) {
            String cVertex = todo.remove(0);
            if (cVertex.equals(v2)) return current;
            done.add(cVertex);
            todoNext.addAll(g.getNeighbors(cVertex));
            if (todo.isEmpty()) {
                todoNext.removeAll(done);
                todo.addAll(todoNext);
                todoNext.clear();
                if (!todo.isEmpty())
                    current++;
            }
        }

        return 0;

    }


    private static void parse(String s, Graph<String, String> g) {
        System.out.println(s);
        if (s.contains("run_")) {
            parse(s.substring(s.split("log")[0].length() + 1).trim(), g);
            return;
        }
        if (s.contains("Overlay")) {
            parse(s.substring(s.split(" ")[0].length()).trim(), g);
            return;
        }
        String[] line = s.split(" ");

        if (line[0].equals("OPEN")) {
            if (!g.containsVertex(line[1]))
                g.addVertex(line[1]);
            if (!g.containsVertex(line[3]))
                g.addVertex(line[3]);
            g.addEdge(line[1] + "-" + line[3], line[1], line[3]);
            g.addEdge(line[3] + "-" + line[1], line[3], line[1]);
        }
        if (line[0].equals("CLOSE")) {
            g.removeEdge(line[1] + "-" + line[3]);
            g.removeEdge(line[3] + "-" + line[1]);
        }
        //ELSE: who cares.
    }
}
