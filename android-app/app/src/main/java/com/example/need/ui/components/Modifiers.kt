package com.example.need.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Paint
import androidx.compose.ui.graphics.drawscope.drawIntoCanvas
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Adds a hard brutalist shadow and a solid black border.
 */
fun Modifier.brutalStyle(
    borderWidth: Dp = 4.dp,
    shadowOffset: Dp = 6.dp,
    shadowColor: Color = Color.Black
): Modifier = this
    .drawBehind {
        val offsetPx = shadowOffset.toPx()
        drawIntoCanvas { canvas ->
            val paint = Paint().apply {
                color = shadowColor
            }
            canvas.drawRect(
                left = offsetPx,
                top = offsetPx,
                right = size.width + offsetPx,
                bottom = size.height + offsetPx,
                paint = paint
            )
        }
    }
    .border(borderWidth, Color.Black)
    .padding(borderWidth)
