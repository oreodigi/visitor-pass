package com.rimacle.smssender;

import java.util.List;

final class User {
    final String id;
    final String name;
    final String email;
    final String role;

    User(String id, String name, String email, String role) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
    }
}

final class EventItem {
    final String id;
    final String title;
    final String eventDate;
    final String venue;

    EventItem(String id, String title, String eventDate, String venue) {
        this.id = id;
        this.title = title;
        this.eventDate = eventDate;
        this.venue = venue;
    }

    @Override
    public String toString() {
        return title + (eventDate.isEmpty() ? "" : " - " + eventDate);
    }
}

final class SmsRecipient {
    final String id;
    final String mobile;
    final String name;
    final String message;

    SmsRecipient(String id, String mobile, String name, String message) {
        this.id = id;
        this.mobile = mobile;
        this.name = name;
        this.message = message;
    }
}

final class QueueResult {
    final int totalPasses;
    final int alreadySent;
    final int pending;
    final List<SmsRecipient> recipients;

    QueueResult(int totalPasses, int alreadySent, int pending, List<SmsRecipient> recipients) {
        this.totalPasses = totalPasses;
        this.alreadySent = alreadySent;
        this.pending = pending;
        this.recipients = recipients;
    }
}
