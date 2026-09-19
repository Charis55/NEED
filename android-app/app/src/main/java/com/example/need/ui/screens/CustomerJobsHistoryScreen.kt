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
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.CustomerDock
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun CustomerJobsHistoryScreen(
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
                text = "MY JOBS",
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
                    Text("ACTIVE", color = White, fontWeight = FontWeight.Bold)
                }
                Box(modifier = Modifier.weight(1f).brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp).background(White).padding(8.dp), contentAlignment = Alignment.Center) {
                    Text("HISTORY", color = Black, fontWeight = FontWeight.Bold)
                }
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(3) { index ->
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .brutalStyle()
                            .background(White)
                            .padding(16.dp)
                    ) {
                        Text("ELECTRICAL REPAIR", fontWeight = FontWeight.Black, fontSize = 20.sp)
                        Text("STATUS: ${if (index == 0) "IN PROGRESS" else "COMPLETED"}", 
                            fontWeight = FontWeight.Bold, 
                            color = if (index == 0) BrutalBlue else BrutalGreen
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Assigned to: UNKNOWN TECHNICIAN")
                        
                        if (index == 0) {
                            Spacer(modifier = Modifier.height(16.dp))
                            BrutalButton(
                                text = "VIEW DETAILS",
                                backgroundColor = BrutalYellow,
                                onClick = { /* TODO */ }
                            )
                        }
                    }
                }
            }
        }
        
        CustomerDock(
            currentRoute = "jobs",
            onNavigate = onNavigateToNav,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}
