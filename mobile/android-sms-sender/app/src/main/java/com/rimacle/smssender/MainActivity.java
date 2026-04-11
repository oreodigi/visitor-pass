package com.rimacle.smssender;

import android.Manifest;
import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.telephony.SmsManager;
import android.view.Gravity;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.Spinner;
import android.widget.TextView;
import android.widget.Toast;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

public class MainActivity extends Activity {
    private static final int SMS_PERMISSION = 7001;
    private static final int HOURLY_LIMIT = 50;
    private static final int MIN_DELAY_SECONDS = 45;
    private static final int MAX_DELAY_SECONDS = 60;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Random random = new Random();
    private final List<Long> sentWindow = new ArrayList<>();

    private SharedPreferences prefs;
    private ApiClient api;
    private EditText baseUrlInput;
    private EditText emailInput;
    private EditText passwordInput;
    private Button loginButton;
    private Spinner eventSpinner;
    private Button refreshButton;
    private Button startButton;
    private Button stopButton;
    private TextView statusText;
    private TextView logText;
    private ProgressBar progressBar;

    private List<EventItem> events = new ArrayList<>();
    private List<SmsRecipient> queue = new ArrayList<>();
    private boolean running = false;
    private int currentIndex = 0;
    private int sent = 0;
    private int failed = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        prefs = getSharedPreferences("rimacle_sms_sender", Context.MODE_PRIVATE);
        api = new ApiClient(prefs.getString("base_url", "https://ticket.rimacle.com"), prefs.getString("token", ""));
        buildUi();
        if (!api.getToken().isEmpty()) loadEvents();
    }

    private void buildUi() {
        ScrollView scrollView = new ScrollView(this);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(28, 28, 28, 28);
        root.setBackgroundColor(0xfff8fafc);
        scrollView.addView(root);
        setContentView(scrollView);

        TextView title = label("Rimacle SMS Sender", 24, true);
        root.addView(title);
        root.addView(small("Send event pass links using this phone SIM. Safe speed: 50 SMS/hour."));

        baseUrlInput = input("App URL", prefs.getString("base_url", "https://ticket.rimacle.com"), false);
        emailInput = input("Email", prefs.getString("email", ""), false);
        passwordInput = input("Password", "", true);
        loginButton = button("Login");
        eventSpinner = new Spinner(this);
        refreshButton = button("Refresh Events");
        startButton = button("Start SMS Campaign");
        stopButton = button("Stop");
        statusText = small("Login to load events.");
        logText = small("");
        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);

        root.addView(baseUrlInput);
        root.addView(emailInput);
        root.addView(passwordInput);
        root.addView(loginButton);
        root.addView(space());
        root.addView(eventSpinner);
        root.addView(refreshButton);
        root.addView(startButton);
        root.addView(stopButton);
        root.addView(progressBar);
        root.addView(statusText);
        root.addView(logText);

        stopButton.setEnabled(false);
        loginButton.setOnClickListener(v -> login());
        refreshButton.setOnClickListener(v -> loadEvents());
        startButton.setOnClickListener(v -> startCampaign());
        stopButton.setOnClickListener(v -> stopCampaign("Stopped by operator."));
    }

    private TextView label(String text, int size, boolean bold) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(size);
        v.setTextColor(0xff0f172a);
        if (bold) v.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        v.setPadding(0, 8, 0, 8);
        return v;
    }

    private TextView small(String text) {
        TextView v = new TextView(this);
        v.setText(text);
        v.setTextSize(14);
        v.setTextColor(0xff475569);
        v.setPadding(0, 6, 0, 6);
        return v;
    }

    private EditText input(String hint, String value, boolean password) {
        EditText v = new EditText(this);
        v.setHint(hint);
        v.setText(value);
        v.setSingleLine(true);
        if (password) v.setInputType(0x00000081);
        v.setPadding(18, 12, 18, 12);
        return v;
    }

    private Button button(String text) {
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setGravity(Gravity.CENTER);
        return b;
    }

    private View space() {
        View v = new View(this);
        v.setLayoutParams(new LinearLayout.LayoutParams(1, 18));
        return v;
    }

    private void login() {
        setBusy("Logging in...");
        runBg(() -> {
            String baseUrl = baseUrlInput.getText().toString().trim();
            api = new ApiClient(baseUrl, "");
            User user = api.login(emailInput.getText().toString().trim(), passwordInput.getText().toString());
            prefs.edit()
                    .putString("base_url", baseUrl)
                    .putString("email", emailInput.getText().toString().trim())
                    .putString("token", api.getToken())
                    .apply();
            ui(() -> {
                toast("Logged in as " + user.name);
                loadEvents();
            });
        });
    }

    private void loadEvents() {
        setBusy("Loading events...");
        runBg(() -> {
            events = api.events();
            ui(() -> {
                ArrayAdapter<EventItem> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, events);
                eventSpinner.setAdapter(adapter);
                statusText.setText(events.isEmpty() ? "No assigned events found." : "Select event and start SMS campaign.");
                setIdle();
            });
        });
    }

    private void startCampaign() {
        if (checkSelfPermission(Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.SEND_SMS}, SMS_PERMISSION);
            return;
        }
        if (events.isEmpty()) {
            toast("No event selected.");
            return;
        }

        EventItem event = (EventItem) eventSpinner.getSelectedItem();
        setBusy("Loading SMS queue...");
        runBg(() -> {
            QueueResult result = api.queue(event.id, 500);
            queue = result.recipients;
            currentIndex = 0;
            sent = 0;
            failed = 0;
            running = true;
            ui(() -> {
                stopButton.setEnabled(true);
                startButton.setEnabled(false);
                logText.setText("");
                statusText.setText("Pending SMS: " + result.pending + " | Already sent: " + result.alreadySent);
                sendNext(event.id);
            });
        });
    }

    private void sendNext(String eventId) {
        if (!running) return;
        if (currentIndex >= queue.size()) {
            stopCampaign("Completed. Sent: " + sent + ", Failed: " + failed);
            return;
        }

        waitForHourlySlot(() -> {
            SmsRecipient recipient = queue.get(currentIndex);
            try {
                sendSms(recipient.mobile, recipient.message);
                sentWindow.add(System.currentTimeMillis());
                sent++;
                appendLog("Sent " + recipient.mobile);
                runBgQuiet(() -> api.mark(eventId, recipient, "sent", null));
            } catch (Exception e) {
                failed++;
                appendLog("Failed " + recipient.mobile + ": " + e.getMessage());
                runBgQuiet(() -> api.mark(eventId, recipient, "failed", e.getMessage()));
            }

            currentIndex++;
            progressBar.setProgress(queue.isEmpty() ? 0 : (currentIndex * 100 / queue.size()));

            int delay = (MIN_DELAY_SECONDS + random.nextInt(MAX_DELAY_SECONDS - MIN_DELAY_SECONDS + 1)) * 1000;
            statusText.setText("Sent " + sent + ", failed " + failed + ". Next SMS in " + (delay / 1000) + " seconds.");
            handler.postDelayed(() -> sendNext(eventId), delay);
        });
    }

    private void sendSms(String mobile, String message) {
        SmsManager sms = SmsManager.getDefault();
        ArrayList<String> parts = sms.divideMessage(message);
        if (parts.size() <= 1) {
            sms.sendTextMessage(mobile, null, message, null, null);
        } else {
            sms.sendMultipartTextMessage(mobile, null, parts, null, null);
        }
    }

    private void waitForHourlySlot(Runnable next) {
        long now = System.currentTimeMillis();
        long hour = 60L * 60L * 1000L;
        while (!sentWindow.isEmpty() && now - sentWindow.get(0) >= hour) {
            sentWindow.remove(0);
        }
        if (sentWindow.size() < HOURLY_LIMIT) {
            next.run();
            return;
        }
        long waitMs = Math.max(1000L, sentWindow.get(0) + hour - now);
        statusText.setText("Safety pause: 50 SMS/hour reached. Resuming in " + ((waitMs + 59999) / 60000) + " minute(s).");
        handler.postDelayed(() -> waitForHourlySlot(next), waitMs);
    }

    private void stopCampaign(String message) {
        running = false;
        stopButton.setEnabled(false);
        startButton.setEnabled(true);
        statusText.setText(message);
    }

    private void setBusy(String text) {
        statusText.setText(text);
        loginButton.setEnabled(false);
        refreshButton.setEnabled(false);
        startButton.setEnabled(false);
    }

    private void setIdle() {
        loginButton.setEnabled(true);
        refreshButton.setEnabled(true);
        startButton.setEnabled(true);
    }

    private void appendLog(String line) {
        ui(() -> logText.setText(line + "\n" + logText.getText()));
    }

    private void toast(String message) {
        Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    private void runBg(Task task) {
        new Thread(() -> {
            try {
                task.run();
            } catch (Exception e) {
                ui(() -> {
                    setIdle();
                    toast(e.getMessage());
                    statusText.setText(e.getMessage());
                });
            }
        }).start();
    }

    private void runBgQuiet(Task task) {
        new Thread(() -> {
            try {
                task.run();
            } catch (Exception e) {
                appendLog("Status sync failed: " + e.getMessage());
            }
        }).start();
    }

    private void ui(Runnable runnable) {
        handler.post(runnable);
    }

    interface Task {
        void run() throws Exception;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != SMS_PERMISSION) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            toast("SMS permission granted. Tap Start SMS Campaign.");
        } else {
            toast("SMS permission is required to send event passes.");
        }
    }
}
