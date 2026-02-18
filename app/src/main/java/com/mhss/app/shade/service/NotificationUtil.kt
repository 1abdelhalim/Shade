package com.mhss.app.shade.service

import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.mhss.app.shade.R
import com.mhss.app.shade.service.ScreenCaptureService.Companion.ACTION_CLEAR
import com.mhss.app.shade.service.ScreenCaptureService.Companion.ACTION_STOP

const val CHANNEL_ID = "screen_capture_channel"
const val INIT_CHANNEL_ID = "screen_capture_initializing_channel"

fun Context.createCaptureServiceNotification(isInitializing: Boolean = false): Notification {

    val builder = NotificationCompat.Builder(
        this,
        if (isInitializing) INIT_CHANNEL_ID else CHANNEL_ID
    )
        .setContentTitle(
            getString(
                if (isInitializing) R.string.notification_title_initializing
                else R.string.notification_title
            )
        )
        .setContentText(
            getString(
                if (isInitializing) R.string.notification_text_initializing
                else R.string.notification_text
            )
        )
        .setSmallIcon(R.mipmap.ic_launcher_foreground)
        .setPriority(
            if (isInitializing) NotificationCompat.PRIORITY_HIGH
            else NotificationCompat.PRIORITY_LOW
        )
        .setOngoing(true)
        .setOnlyAlertOnce(true)

    if (isInitializing) {
        builder.setProgress(0, 0, true)
    } else {
        val pendingIntentFlag = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

        val clearIntent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ACTION_CLEAR
        }
        val clearPendingIntent = PendingIntent.getService(this, 1, clearIntent, pendingIntentFlag)

        val stopIntent = Intent(this, ScreenCaptureService::class.java).apply {
            action = ACTION_STOP
        }
        val stopPendingIntent = PendingIntent.getService(this, 0, stopIntent, pendingIntentFlag)
        builder
            .setProgress(0, 0, false)
            .addAction(
                R.mipmap.ic_launcher_foreground,
                getString(R.string.notification_action_clear),
                clearPendingIntent
            )
            .addAction(
                R.mipmap.ic_launcher_foreground,
                getString(R.string.notification_action_stop),
                stopPendingIntent
            )
    }

    return builder.build()
}
