import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.*;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.locks.ReentrantLock;

/**
 * A small Java backend for the AURORA salon site.
 *
 * What this replaces: the old booking-logger.js used localStorage, which only
 * lives in one browser on one computer. This server instead:
 *   1. Serves your existing HTML/CSS/JS files (the "public" folder)
 *   2. Exposes a tiny REST API at /api/bookings that saves bookings to a
 *      real file (bookings.json) on the server, so every visitor shares
 *      the same data.
 *
 * Run it with:  java Main.java
 * Then open:    http://localhost:8080
 */
public class Main {

    static final Path DATA_FILE = Paths.get("bookings.json");
    static final Path PUBLIC_DIR = Paths.get(".");
    static final ReentrantLock lock = new ReentrantLock();

    public static void main(String[] args) throws IOException {
        int port = 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        server.createContext("/api/bookings", new BookingsHandler());
        server.createContext("/", new StaticFileHandler());

        server.setExecutor(null);
        server.start();

        System.out.println("✅ Server running at http://localhost:" + port);
    }

    // ---------- Serves index.html, salon.css, salon.js, etc. ----------
    static class StaticFileHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if (path.equals("/")) path = "/index.html";

            Path baseDir = PUBLIC_DIR.toAbsolutePath().normalize();
            Path file = baseDir.resolve(path.substring(1)).normalize();

            if (!file.startsWith(baseDir) || !Files.exists(file) || Files.isDirectory(file)) {
                respond(exchange, 404, "text/plain", "404 Not Found");
                return;
            }

            byte[] bytes = Files.readAllBytes(file);
            exchange.getResponseHeaders().set("Content-Type", guessContentType(file.toString()));
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        String guessContentType(String name) {
            if (name.endsWith(".html")) return "text/html";
            if (name.endsWith(".css")) return "text/css";
            if (name.endsWith(".js")) return "application/javascript";
            return "application/octet-stream";
        }
    }

    // ---------- GET / POST / DELETE  /api/bookings ----------
    static class BookingsHandler implements HttpHandler {
        public void handle(HttpExchange exchange) throws IOException {
            try {
                switch (exchange.getRequestMethod()) {
                    case "GET":
                        respond(exchange, 200, "application/json", toJsonArray(loadBookings()));
                        break;
                    case "POST":
                        handlePost(exchange);
                        break;
                    case "DELETE":
                        handleDelete(exchange);
                        break;
                    default:
                        respond(exchange, 405, "text/plain", "Method Not Allowed");
                }
            } catch (Exception e) {
                e.printStackTrace();
                respond(exchange, 500, "text/plain", "Server error: " + e.getMessage());
            }
        }

        void handlePost(HttpExchange exchange) throws IOException {
            Map<String, String> data = parseJsonObject(readBody(exchange));

            Map<String, String> booking = new LinkedHashMap<>();
            booking.put("id", generateId());
            booking.put("name", data.getOrDefault("name", ""));
            booking.put("service", data.getOrDefault("service", ""));
            booking.put("date", data.getOrDefault("date", ""));
            booking.put("time", data.getOrDefault("time", ""));
            booking.put("timestamp", new Date().toInstant().toString());
            booking.put("status", "Confirmed");

            lock.lock();
            try {
                List<Map<String, String>> bookings = loadBookings();
                bookings.add(booking);
                saveBookings(bookings);
            } finally {
                lock.unlock();
            }

            respond(exchange, 200, "application/json", toJsonObject(booking));
        }

        void handleDelete(HttpExchange exchange) throws IOException {
            String query = exchange.getRequestURI().getQuery();
            String id = null;
            if (query != null) {
                for (String pair : query.split("&")) {
                    String[] kv = pair.split("=", 2);
                    if (kv.length == 2 && kv[0].equals("id")) id = kv[1];
                }
            }
            if (id == null) {
                respond(exchange, 400, "text/plain", "Missing id");
                return;
            }
               final String idToDelete = id;
            lock.lock();
            try {
                List<Map<String, String>> bookings = loadBookings();
                 bookings.removeIf(b -> idToDelete.equals(b.get("id")));
                saveBookings(bookings);
            } finally {
                lock.unlock();
            }

            respond(exchange, 200, "application/json", "{\"deleted\":true}");
        }
    }

    // ---------- File-based storage (stands in for a database) ----------
    static List<Map<String, String>> loadBookings() throws IOException {
        if (!Files.exists(DATA_FILE)) return new ArrayList<>();
        String content = new String(Files.readAllBytes(DATA_FILE), StandardCharsets.UTF_8).trim();
        if (content.isEmpty() || content.equals("[]")) return new ArrayList<>();
        return parseJsonArray(content);
    }

    static void saveBookings(List<Map<String, String>> bookings) throws IOException {
        Files.write(DATA_FILE, toJsonArray(bookings).getBytes(StandardCharsets.UTF_8));
    }

    static String generateId() {
        return "BK" + System.currentTimeMillis()
                + Integer.toHexString(new Random().nextInt(0xFFFFFF)).toUpperCase();
    }

    // ---------- Minimal hand-rolled JSON (flat string objects only) ----------
    static String toJsonObject(Map<String, String> map) {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, String> e : map.entrySet()) {
            if (!first) sb.append(",");
            sb.append("\"").append(escape(e.getKey())).append("\":\"").append(escape(e.getValue())).append("\"");
            first = false;
        }
        return sb.append("}").toString();
    }

    static String toJsonArray(List<Map<String, String>> list) {
        StringBuilder sb = new StringBuilder("[");
        for (int i = 0; i < list.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append(toJsonObject(list.get(i)));
        }
        return sb.append("]").toString();
    }

    static Map<String, String> parseJsonObject(String json) {
        Map<String, String> map = new LinkedHashMap<>();
        json = json.trim();
        if (json.startsWith("{")) json = json.substring(1);
        if (json.endsWith("}")) json = json.substring(0, json.length() - 1);

        for (String pair : splitTopLevel(json)) {
            int colon = findColon(pair);
            if (colon == -1) continue;
            map.put(unquote(pair.substring(0, colon).trim()), unquote(pair.substring(colon + 1).trim()));
        }
        return map;
    }

    static List<Map<String, String>> parseJsonArray(String json) {
        List<Map<String, String>> list = new ArrayList<>();
        json = json.trim();
        if (json.startsWith("[")) json = json.substring(1);
        if (json.endsWith("]")) json = json.substring(0, json.length() - 1);

        for (String obj : splitTopLevelObjects(json)) {
            if (!obj.trim().isEmpty()) list.add(parseJsonObject(obj));
        }
        return list;
    }

    static List<String> splitTopLevel(String s) {
        List<String> result = new ArrayList<>();
        int depth = 0;
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\')) inQuotes = !inQuotes;
            if (!inQuotes) {
                if (c == '{' || c == '[') depth++;
                if (c == '}' || c == ']') depth--;
                if (c == ',' && depth == 0) {
                    result.add(current.toString());
                    current.setLength(0);
                    continue;
                }
            }
            current.append(c);
        }
        if (current.length() > 0) result.add(current.toString());
        return result;
    }

    static List<String> splitTopLevelObjects(String s) {
        List<String> result = new ArrayList<>();
        int depth = 0;
        boolean inQuotes = false;
        StringBuilder current = new StringBuilder();
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '"' && (i == 0 || s.charAt(i - 1) != '\\')) inQuotes = !inQuotes;
            if (!inQuotes) {
                if (c == '{') depth++;
                if (c == '}') depth--;
            }
            current.append(c);
            if (!inQuotes && depth == 0 && c == '}') {
                result.add(current.toString());
                current.setLength(0);
            }
        }
        return result;
    }

    static int findColon(String pair) {
        boolean inQuotes = false;
        for (int i = 0; i < pair.length(); i++) {
            char c = pair.charAt(i);
            if (c == '"' && (i == 0 || pair.charAt(i - 1) != '\\')) inQuotes = !inQuotes;
            if (c == ':' && !inQuotes) return i;
        }
        return -1;
    }

    static String unquote(String s) {
        s = s.trim();
        if (s.startsWith("\"") && s.endsWith("\"")) s = s.substring(1, s.length() - 1);
        return s.replace("\\\"", "\"").replace("\\\\", "\\");
    }

    static String escape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    // ---------- HTTP helpers ----------
    static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[1024];
            int n;
            while ((n = is.read(buf)) != -1) out.write(buf, 0, n);
            return out.toString(StandardCharsets.UTF_8);
        }
    }

    static void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType + "; charset=utf-8");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
