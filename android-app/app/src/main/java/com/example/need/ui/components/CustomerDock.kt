package com.example.need.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.example.need.ui.theme.*

@Composable
fun CustomerDock(
    currentRoute: String,
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp)
            .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
            .background(White)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceAround,
        verticalAlignment = Alignment.CenterVertically
    ) {
        val navItems = listOf(
            Pair("explore", "HOME"),
            Pair("jobs", "JOBS"),
            Pair("inbox", "INBOX"),
            Pair("settings", "SETTINGS")
        )

        navItems.forEach { (route, label) ->
            val isActive = currentRoute == route
            Box(
                modifier = Modifier
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = if (isActive) 2.dp else 0.dp)
                    .background(if (isActive) BrutalGreen else White)
                    // .clickable { onNavigate(route) }
                    .padding(8.dp)
            ) {
                Text(
                    text = label,
                    fontWeight = FontWeight.Black,
                    color = Black
                )
            }
        }
    }
}
