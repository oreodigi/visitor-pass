package com.rimacle.smssender;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.OutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

final class ApiClient {
    private final String baseUrl;
    private String token;

    ApiClient(String baseUrl, String token) {
        this.baseUrl = trimSlash(baseUrl);
        this.token = token;
    }

    void setToken(String token) {
        this.token = token;
    }

    String getToken() {
        return token;
    }

    User login(String email, String password) throws Exception {
        JSONObject body = new JSONObject()
                .put("email", email)
                .put("password", password);
        JSONObject data = request("POST", "/api/auth/login", body).getJSONObject("data");
        token = data.getString("token");
        JSONObject userJson = data.getJSONObject("user");
        return new User(
                userJson.getString("id"),
                userJson.getString("name"),
                userJson.optString("email", ""),
                userJson.getString("role")
        );
    }

    List<EventItem> events() throws Exception {
        JSONObject data = request("GET", "/api/sms-runner/events", null).getJSONObject("data");
        JSONArray arr = data.getJSONArray("events");
        List<EventItem> out = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject item = arr.getJSONObject(i);
            out.add(new EventItem(
                    item.getString("id"),
                    item.getString("title"),
                    item.optString("event_date", ""),
                    item.optString("venue_name", "")
            ));
        }
        return out;
    }

    QueueResult queue(String eventId, int limit) throws Exception {
        String path = "/api/sms-runner/queue?event_id=" + enc(eventId) + "&limit=" + limit;
        JSONObject data = request("GET", path, null).getJSONObject("data");
        JSONArray arr = data.getJSONArray("recipients");
        List<SmsRecipient> recipients = new ArrayList<>();
        for (int i = 0; i < arr.length(); i++) {
            JSONObject item = arr.getJSONObject(i);
            recipients.add(new SmsRecipient(
                    item.getString("id"),
                    item.getString("mobile"),
                    item.optString("name", ""),
                    item.getString("message")
            ));
        }
        return new QueueResult(
                data.optInt("total_passes", recipients.size()),
                data.optInt("already_sent", 0),
                data.optInt("pending", recipients.size()),
                recipients
        );
    }

    void mark(String eventId, SmsRecipient recipient, String status, String error) throws Exception {
        JSONObject body = new JSONObject()
                .put("event_id", eventId)
                .put("attendee_id", recipient.id)
                .put("mobile", recipient.mobile)
                .put("message", recipient.message)
                .put("status", status);
        if (error != null) body.put("error", error);
        request("POST", "/api/sms-runner/mark", body);
    }

    private JSONObject request(String method, String path, JSONObject body) throws Exception {
        URL url = new URL(baseUrl + path);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod(method);
        conn.setConnectTimeout(20000);
        conn.setReadTimeout(30000);
        conn.setRequestProperty("Accept", "application/json");
        conn.setRequestProperty("Content-Type", "application/json");
        if (token != null && !token.isEmpty()) {
            conn.setRequestProperty("Authorization", "Bearer " + token);
        }
        if (body != null) {
            conn.setDoOutput(true);
            byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(bytes);
            }
        }

        int code = conn.getResponseCode();
        BufferedReader reader = new BufferedReader(new InputStreamReader(
                code >= 200 && code < 300 ? conn.getInputStream() : conn.getErrorStream(),
                StandardCharsets.UTF_8
        ));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
        JSONObject json = new JSONObject(sb.toString());
        if (code < 200 || code >= 300 || !json.optBoolean("success")) {
            JSONObject err = json.optJSONObject("error");
            throw new Exception(err != null ? err.optString("message", "Request failed") : "Request failed");
        }
        return json;
    }

    private static String trimSlash(String value) {
        while (value.endsWith("/")) value = value.substring(0, value.length() - 1);
        return value;
    }

    private static String enc(String value) throws Exception {
        return URLEncoder.encode(value, "UTF-8");
    }
}
