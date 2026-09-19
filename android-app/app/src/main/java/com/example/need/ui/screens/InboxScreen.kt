package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun InboxScreen(
    userRole: String, // "customer" or "artisan"
    onNavigateToChat: (String) -> Unit,
    onNavigateToNav: (String) -> Unit
) {
    // TODO: Agent - Fetch chat rooms from Firestore where user is a participant
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        Column(modifier = Modifier.fillMaxSize().padding(bottom = 96.dp)) {
            Text(
                text = "INBOX",
                fontWeight = FontWeight.Black,
                fontSize = 32.sp,
                modifier = Modifier.padding(16.dp)
            )

            LazyColumn(
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Placeholder list
                items(3) { index ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .brutalStyle()
                            .background(White)
                            // .clickable { onNavigateToChat("dummy_job_id") }
                            .padding(16.dp)
                    ) {
                        // Avatar placeholder
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .brutalStyle(borderWidth = 3.dp, shadowOffset = 0.dp)
                                .background(BrutalYellow)
                        )
                        Spacer(modifier = Modifier.width(16.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = if (userRole == "customer") "UNKNOWN TECHNICIAN" else "CUSTOMER",
                                fontWeight = FontWeight.Black,
                                fontSize = 18.sp
                            )
                            Text(
                                text = "Job description placeholder",
                                fontWeight = FontWeight.Bold,
                                color = BrutalBlue,
                                fontSize = 14.sp
                            )
                        }
                    }
                }
            }
        }
        
        // TODO: Agent - Render CustomerDock or ArtisanDock based on userRole
    }
}
