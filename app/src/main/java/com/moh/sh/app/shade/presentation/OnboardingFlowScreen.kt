package com.moh.sh.app.shade.presentation

import androidx.annotation.DrawableRes
import androidx.annotation.StringRes
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.moh.sh.app.shade.R
import com.moh.sh.app.shade.detection.MAX_DOWNSAMPLE_FACTOR
import com.moh.sh.app.shade.detection.MIN_DOWNSAMPLE_FACTOR
import kotlin.math.roundToInt
import kotlinx.coroutines.launch

@Composable
fun OnboardingFlowScreen(
    uiState: MainUiState,
    onConfidenceChanged: (Float) -> Unit,
    onOverlayOpacityChanged: (Float) -> Unit,
    onPixelationLevelChanged: (Int) -> Unit,
    onDetailedModeChanged: (Boolean) -> Unit,
    onDone: () -> Unit
) {
    val pagerState = rememberPagerState(pageCount = { 4 })
    val scope = rememberCoroutineScope()

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f),
                            MaterialTheme.colorScheme.background
                        )
                    )
                )
        )

        Scaffold(containerColor = Color.Transparent) { paddingValues ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(paddingValues)
                    .padding(12.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text(
                    text = stringResource(R.string.onboarding_title),
                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.Bold),
                    color = MaterialTheme.colorScheme.onBackground,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    text = stringResource(R.string.onboarding_subtitle),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                Spacer(modifier = Modifier.height(10.dp))

                HorizontalPager(
                    state = pagerState,
                    modifier = Modifier.weight(1f),
                    userScrollEnabled = true
                ) { page ->
                    val buttonText = if (page == pagerState.pageCount - 1) {
                        stringResource(R.string.onboarding_done)
                    } else {
                        stringResource(R.string.onboarding_next)
                    }
                    fun onButtonClick() {
                        if (page == pagerState.pageCount - 1) {
                            onDone()
                        } else {
                            scope.launch { pagerState.animateScrollToPage(page + 1) }
                        }
                    }

                    when (page) {
                        0 -> {
                            OnboardingSettingPage(
                                title = stringResource(R.string.detection_confidence),
                                description = stringResource(R.string.onboarding_confidence_description),
                                buttonText = buttonText,
                                onButtonClick = { onButtonClick() },
                                settingBar = {
                                    SettingsSliderBar(
                                        minLabel = stringResource(R.string.confidence_label_low),
                                        valueLabel = "${uiState.confidence.roundToInt()}%",
                                        maxLabel = stringResource(R.string.confidence_label_high),
                                        value = uiState.confidence,
                                        onValueChange = onConfidenceChanged,
                                        valueRange = 0f..100f
                                    )
                                }
                            )
                        }

                        1 -> {
                            OnboardingSettingPage(
                                title = stringResource(R.string.overlay_opacity),
                                description = stringResource(R.string.onboarding_overlay_opacity_description),
                                previewContent = {
                                    OnboardingExampleImages(
                                        firstImageRes = R.drawable.full_low_pixelation_example,
                                        firstLabelRes = R.string.full_opacity,
                                        secondImageRes = R.drawable.full_low_opacity_example,
                                        secondLabelRes = R.string.low_opacity
                                    )
                                },
                                buttonText = buttonText,
                                onButtonClick =  { onButtonClick() },
                                settingBar = {
                                    SettingsSliderBar(
                                        minLabel = stringResource(R.string.opacity_label_transparent),
                                        valueLabel = "${uiState.overlayOpacity.roundToInt()}%",
                                        maxLabel = stringResource(R.string.opacity_label_solid),
                                        value = uiState.overlayOpacity,
                                        onValueChange = onOverlayOpacityChanged,
                                        valueRange = 0f..100f
                                    )
                                }
                            )
                        }

                        2 -> {
                            OnboardingSettingPage(
                                title = stringResource(R.string.pixelation_level),
                                description = stringResource(R.string.onboarding_pixelation_level_description),
                                previewContent = {
                                    OnboardingExampleImages(
                                        firstImageRes = R.drawable.full_low_pixelation_example,
                                        firstLabelRes = R.string.low_pixelation,
                                        secondImageRes = R.drawable.full_high_pixelation_example,
                                        secondLabelRes = R.string.high_pixelation
                                    )
                                },
                                buttonText = buttonText,
                                onButtonClick =  { onButtonClick() },
                                settingBar = {
                                    SettingsSliderBar(
                                        minLabel = stringResource(R.string.pixelation_label_low),
                                        valueLabel = uiState.pixelationLevel.toString(),
                                        maxLabel = stringResource(R.string.pixelation_label_high),
                                        value = uiState.pixelationLevel.toFloat(),
                                        onValueChange = { onPixelationLevelChanged(it.roundToInt()) },
                                        valueRange = MIN_DOWNSAMPLE_FACTOR.toFloat()..MAX_DOWNSAMPLE_FACTOR.toFloat()
                                    )
                                }
                            )
                        }

                        else -> {
                            OnboardingSettingPage(
                                title = stringResource(R.string.detailed_mode),
                                description = stringResource(R.string.onboarding_detailed_mode_description),
                                previewContent = {
                                    OnboardingExampleImages(
                                        firstImageRes = R.drawable.full_low_pixelation_example,
                                        firstLabelRes = R.string.normal_mode,
                                        secondImageRes = R.drawable.detailed_mode_example,
                                        secondLabelRes = R.string.detailed_mode
                                    )
                                },
                                buttonText = buttonText,
                                onButtonClick =  { onButtonClick() },
                                settingBar = {
                                    DetailedModeBar(
                                        detailedModeEnabled = uiState.detailedModeEnabled,
                                        onDetailedModeChanged = onDetailedModeChanged
                                    )
                                }
                            )
                        }
                    }
                }
                Spacer(modifier = Modifier.height(8.dp))
            }
        }
    }
}

@Composable
private fun OnboardingSettingPage(
    title: String,
    description: String,
    buttonText: String,
    onButtonClick: () -> Unit,
    settingBar: @Composable () -> Unit,
    previewContent: (@Composable () -> Unit)? = null
) {
    Card(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 3.dp, vertical = 6.dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surface
        )
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(16.dp),
            horizontalAlignment = Alignment.Start
        ) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .verticalScroll(rememberScrollState())
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
                    color = MaterialTheme.colorScheme.onSurface
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = description,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )

                if (previewContent != null) {
                    Spacer(modifier = Modifier.height(18.dp))
                    previewContent()
                }

                Spacer(modifier = Modifier.height(18.dp))
                settingBar()
                Spacer(modifier = Modifier.height(12.dp))
            }

            Spacer(modifier = Modifier.height(8.dp))

            Button(
                onClick = onButtonClick,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp)
            ) {
                Text(text = buttonText)
            }
        }
    }
}

@Composable
private fun SettingsSliderBar(
    minLabel: String,
    valueLabel: String,
    maxLabel: String,
    value: Float,
    onValueChange: (Float) -> Unit,
    valueRange: ClosedFloatingPointRange<Float>
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHighest
    ) {
        Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = minLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = valueLabel,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.primary
                )
                Text(
                    text = maxLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Slider(
                value = value,
                onValueChange = onValueChange,
                valueRange = valueRange,
                colors = SliderDefaults.colors(
                    thumbColor = MaterialTheme.colorScheme.primary,
                    activeTrackColor = MaterialTheme.colorScheme.primary,
                    inactiveTrackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            )
        }
    }
}

@Composable
private fun DetailedModeBar(
    detailedModeEnabled: Boolean,
    onDetailedModeChanged: (Boolean) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        color = MaterialTheme.colorScheme.surfaceContainerHighest
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(10.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            FilterChip(
                selected = !detailedModeEnabled,
                onClick = { onDetailedModeChanged(false) },
                label = { 
                    Text(
                        text = stringResource(R.string.normal_mode),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
                    ) 
                },
                modifier = Modifier.weight(1f)
            )
            FilterChip(
                selected = detailedModeEnabled,
                onClick = { onDetailedModeChanged(true) },
                label = {
                    Text(
                        text = stringResource(R.string.detailed_mode),
                        modifier = Modifier.fillMaxWidth(),
                        textAlign = TextAlign.Center,
                        style = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
                    )
                },
                modifier = Modifier.weight(1f)
            )
        }
    }
}

@Composable
private fun OnboardingExampleImages(
    @DrawableRes firstImageRes: Int,
    @StringRes firstLabelRes: Int,
    @DrawableRes secondImageRes: Int,
    @StringRes secondLabelRes: Int
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        OnboardingExampleColumn(
            imageRes = firstImageRes,
            label = stringResource(firstLabelRes),
            modifier = Modifier.weight(1f)
        )
        OnboardingExampleColumn(
            imageRes = secondImageRes,
            label = stringResource(secondLabelRes),
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun OnboardingExampleColumn(
    @DrawableRes imageRes: Int,
    label: String,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Image(
            painter = painterResource(id = imageRes),
            contentDescription = label,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxWidth()
                .aspectRatio(0.62f)
                .clip(RoundedCornerShape(12.dp))
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
    }
}
