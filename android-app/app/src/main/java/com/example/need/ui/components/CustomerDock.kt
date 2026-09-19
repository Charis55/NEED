package com.example.need.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
            .padding(bottom = 8.dp),
        horizontalArrangement = Arrangement.Center
    ) {
        Row(
            modifier = Modifier
                .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                .background(White)
                .padding(horizontal = 24.dp, vertical = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(32.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val navItems = listOf(
                Pair("explore", Icons.Filled.Home),
                Pair("jobs", Icons.Filled.List),
                Pair("inbox", Icons.Filled.Email),
                Pair("settings", Icons.Filled.Settings)
            )

            navItems.forEach { (route, icon) ->
                val isActive = currentRoute == route
                Box(
                    modifier = Modifier
                        .brutalStyle(borderWidth = 2.dp, shadowOffset = if (isActive) 2.dp else 0.dp)
                        .background(if (isActive) BrutalGreen else Transparent)
                        .clickable { onNavigate(route) }
                        .padding(8.dp)
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = route,
                        tint = Black,
                        modifier = Modifier.size(24.dp)
                    )
                }
            }
        }
    }
}
