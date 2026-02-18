package com.mhss.app.shade.presentation.components

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import com.mhss.app.shade.R

@Composable
fun SingleAppCaptureTipDialog(
    onDismiss: () -> Unit,
    onContinue: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(text = stringResource(R.string.single_app_recommended_title))
        },
        text = {
            Text(text = stringResource(R.string.single_app_recommended_description))
        },
        confirmButton = {
            TextButton(onClick = onContinue) {
                Text(text = stringResource(R.string.continue_action))
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(text = stringResource(R.string.cancel))
            }
        }
    )
}
