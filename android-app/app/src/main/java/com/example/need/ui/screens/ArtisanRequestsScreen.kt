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
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun ArtisanRequestsScreen(
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
                .padding(bottom = 96.dp)
        ) {
            Text(
                text = "JOB REQUESTS",
                fontWeight = FontWeight.Black,
                fontSize = 32.sp,
                modifier = Modifier.padding(24.dp)
            )
            
            // Tabs
            Row(
                modifier = Modifier.fillMaxWidth().padding(start = 24.dp, end = 24.dp, bottom = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Box(modifier = Modifier.weight(1f).brutalStyle().background(Black).padding(8.dp), contentAlignment = Alignment.Center) {
                    Text("NEW REQUESTS", color = White, fontWeight = FontWeight.Bold)
                }
                Box(modifier = Modifier.weight(1f).brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp).background(White).padding(8.dp), contentAlignment = Alignment.Center) {
                    Text("ACTIVE JOBS", color = Black, fontWeight = FontWeight.Bold)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(2) { index ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                            .background(White)
                            .padding(24.dp)
                    ) {
                        Text("PLUMBING REPAIR", fontWeight = FontWeight.Black, fontSize = 24.sp)
                        Text("2.5km away • Victoria Island", fontWeight = FontWeight.Bold, color = BrutalBlue)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Customer: John Doe", fontWeight = FontWeight.Bold)
                        Text("Budget: ₦15,000", fontWeight = FontWeight.Black, fontSize = 20.sp, color = BrutalGreen)
                        
                        Spacer(modifier = Modifier.height(24.dp))
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(16.dp)
                        ) {
                            BrutalButton(
                                text = "DECLINE",
                                backgroundColor = BrutalRed,
                                onClick = { /* TODO */ },
                                modifier = Modifier.weight(1f)
                            )
                            BrutalButton(
                                text = "ACCEPT",
                                backgroundColor = BrutalGreen,
                                onClick = { /* TODO */ },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        }
        
        ArtisanDock(
            currentRoute = "requests",
            onNavigate = onNavigateToNav,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}
