package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.ArtisanDock
import com.example.need.ui.components.CustomerDock
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun InboxScreen(
    userRole: String,
    onNavigateToNav: (String) -> Unit,
    onNavigateToChat: (String) -> Unit
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
                text = "MESSAGES",
                fontWeight = FontWeight.Black,
                fontSize = 32.sp,
                modifier = Modifier.padding(24.dp)
            )

            LazyColumn(
                contentPadding = PaddingValues(horizontal = 24.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Dummy Inbox Threads
                items(5) { index ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp)
                            .background(White)
                            .clickable { onNavigateToChat("requestId_$index") }
                            .padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(modifier = Modifier.size(56.dp).background(BrutalPink, CircleShape))
                        Spacer(modifier = Modifier.width(16.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(if (userRole == "customer") "JOHN THE PLUMBER" else "CUSTOMER JANE", fontWeight = FontWeight.Black, fontSize = 18.sp)
                            Text("Sounds good, see you at 4pm!", fontWeight = FontWeight.Bold, color = BrutalBlue)
                        }
                        if (index == 0) {
                            Box(modifier = Modifier.size(16.dp).background(BrutalRed, CircleShape))
                        }
                    }
                }
            }
        }
        
        if (userRole == "artisan") {
            ArtisanDock(
                currentRoute = "inbox",
                onNavigate = onNavigateToNav,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        } else {
            CustomerDock(
                currentRoute = "inbox",
                onNavigate = onNavigateToNav,
                modifier = Modifier.align(Alignment.BottomCenter)
            )
        }
    }
}
