package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun ArtisanEarningsScreen(onNavigateBack: () -> Unit) {
    // Dummy Data mirroring Next.js
    val weeklyEarnings = listOf(
        WeeklyEarning(
            weekKey = "2026-09-15",
            startDate = "Sep 15",
            totalEarnings = 55000,
            commissionOwed = 19250,
            isPaid = false,
            jobs = listOf("Plumbing Fix", "AC Repair")
        ),
        WeeklyEarning(
            weekKey = "2026-09-08",
            startDate = "Sep 08",
            totalEarnings = 120000,
            commissionOwed = 42000,
            isPaid = true,
            jobs = listOf("Full Wiring", "Generator Service", "TV Mounting")
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BrutalYellow)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = 0.dp)
                .padding(16.dp)
                .padding(top = 16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                    .background(White)
                    .clickable { onNavigateBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(28.dp), tint = Black)
            }
            
            Spacer(modifier = Modifier.width(16.dp))
            
            Column {
                Text(
                    text = "PAYMENT HISTORY",
                    fontWeight = FontWeight.Black,
                    fontSize = 24.sp,
                    color = Black
                )
                Text(
                    text = "WEEKLY SETTLEMENTS",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    color = Black,
                    modifier = Modifier.padding(top = 4.dp)
                )
            }
        }
        
        Divider(color = Black, thickness = 8.dp)
        
        // Content
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(24.dp)
        ) {
            if (weeklyEarnings.isEmpty()) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                        .background(White)
                        .padding(32.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("NO EARNINGS YET", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Black)
                        Text("Complete jobs to see your weekly breakdown.", fontWeight = FontWeight.Bold, fontSize = 14.sp, color = Gray, modifier = Modifier.padding(top = 8.dp))
                    }
                }
            } else {
                weeklyEarnings.forEach { week ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                            .background(White)
                    ) {
                        // Week Header
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Black)
                                .padding(16.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(Icons.Filled.DateRange, contentDescription = null, tint = White, modifier = Modifier.size(20.dp))
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("WEEK OF ${week.startDate.uppercase()}", fontWeight = FontWeight.Black, fontSize = 14.sp, color = White)
                            }
                            
                            Box(
                                modifier = Modifier
                                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 0.dp)
                                    .background(if (week.isPaid) BrutalGreen else BrutalRed)
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = if (week.isPaid) "SETTLED" else "PENDING",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 10.sp,
                                    color = if (week.isPaid) Black else White
                                )
                            }
                        }
                        
                        Divider(color = Black, thickness = 4.dp)
                        
                        // Week Content
                        Column(modifier = Modifier.padding(24.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.Bottom
                            ) {
                                Column {
                                    Text("TOTAL EARNED", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Gray)
                                    Text("₦${week.totalEarnings}", fontWeight = FontWeight.Black, fontSize = 32.sp, color = BrutalTeal)
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text("PLATFORM FEE (20%)", fontWeight = FontWeight.Bold, fontSize = 12.sp, color = BrutalRed)
                                    Text("₦${week.commissionOwed}", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Black)
                                }
                            }
                            
                            Divider(color = Black, thickness = 4.dp)
                            
                            Spacer(modifier = Modifier.height(24.dp))
                            
                            Text("JOBS COMPLETED (${week.jobs.size})", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 12.dp))
                            
                            week.jobs.forEach { jobName ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 8.dp)
                                        .brutalStyle(borderWidth = 2.dp, shadowOffset = 0.dp)
                                        .background(LightGray)
                                        .padding(12.dp),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Text(jobName, fontWeight = FontWeight.Bold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                }
                            }
                            
                            if (!week.isPaid) {
                                Spacer(modifier = Modifier.height(24.dp))
                                BrutalButton(
                                    text = "PAY COMMISSION (₦${week.commissionOwed})",
                                    backgroundColor = BrutalBlue,
                                    onClick = { /* TODO */ },
                                    modifier = Modifier.fillMaxWidth().height(64.dp)
                                )
                            }
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

data class WeeklyEarning(
    val weekKey: String,
    val startDate: String,
    val totalEarnings: Int,
    val commissionOwed: Int,
    val isPaid: Boolean,
    val jobs: List<String>
)
