package com.mhss.app.shade

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import com.mhss.app.shade.service.ModelFiles
import com.mhss.app.shade.service.CHANNEL_ID
import com.mhss.app.shade.service.INIT_CHANNEL_ID
import java.io.File
import org.koin.android.ext.koin.androidContext
import org.koin.core.annotation.ComponentScan
import org.koin.core.annotation.Module
import org.koin.core.context.GlobalContext.startKoin
import org.koin.ksp.generated.module

class ShadeApplication : Application() {
    override fun onCreate() {
        super.onCreate()

        createNotificationChannels()
        cleanOldGpuDelegateCaches()

        startKoin {
            androidContext(this@ShadeApplication)
            modules(ShadeApplicationModule().module)
        }
    }

    private fun createNotificationChannels() {
        val manager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notification_channel_name),
                NotificationManager.IMPORTANCE_LOW
            )
        )

        val initChannel = NotificationChannel(
            INIT_CHANNEL_ID,
            getString(R.string.notification_channel_name_initializing),
            NotificationManager.IMPORTANCE_HIGH
        )
        initChannel.enableVibration(false)
        initChannel.vibrationPattern = longArrayOf(0L)
        initChannel.setSound(null, null)
        manager.createNotificationChannel(initChannel)
    }

    private fun cleanOldGpuDelegateCaches() = runCatching {
        val cacheRoot = File(filesDir, GPU_DELEGATE_CACHE_DIR_NAME)
        if (!cacheRoot.exists() || !cacheRoot.isDirectory) return@runCatching

        val currentTokens = listOf(
            ModelFiles.SMALL_MODEL_PATH.substringBeforeLast('.'),
            ModelFiles.LARGE_MODEL_PATH.substringBeforeLast('.'),
            ModelFiles.SEGMENTATION_MODEL_PATH.substringBeforeLast('.')
        )

        cacheRoot.listFiles()?.forEach { child ->
            if (child.name !in currentTokens) {
                child.deleteRecursively()
            }
        }
    }

    companion object {
        private const val GPU_DELEGATE_CACHE_DIR_NAME = "gpu_delegate_cache"
    }
}

@Module
@ComponentScan("com.mhss.app.shade")
class ShadeApplicationModule
