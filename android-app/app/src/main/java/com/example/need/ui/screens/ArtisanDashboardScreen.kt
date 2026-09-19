package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.ArtisanDock
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun ArtisanDashboardScreen(
    onNavigateToNav: (String) -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 96.dp) // Room for dock
        ) {
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = "DASHBOARD",
                    fontWeight = FontWeight.Black,
                    fontSize = 28.sp,
                    modifier = Modifier
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                        .background(BrutalYellow)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
            }

            // TODO: Agent - Fetch Artisan profile status and earnings from Firestore
            
            // Status Card
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp)
                    .brutalStyle()
                    .background(White)
                    .padding(24.dp)
            ) {
                Text(
                    text = "STATUS: ONLINE",
                    fontWeight = FontWeight.Black,
                    color = BrutalGreen,
                    fontSize = 24.sp
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Waiting for job requests...",
                    fontWeight = FontWeight.Bold
                )
            }

            // Stats
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .brutalStyle()
                        .background(BrutalTeal)
                        .padding(16.dp)
                ) {
                    Column {
                        Text("TOTAL EARNINGS", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("₦0", fontWeight = FontWeight.Black, fontSize = 24.sp)
                    }
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .brutalStyle()
                        .background(BrutalPink)
                        .padding(16.dp)
                ) {
                    Column {
                        Text("JOBS COMPLETED", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Text("0", fontWeight = FontWeight.Black, fontSize = 24.sp)
                    }
                }
            }
        }

        // Dock
        ArtisanDock(
            currentRoute = "dashboard",
            onNavigate = onNavigateToNav,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}
