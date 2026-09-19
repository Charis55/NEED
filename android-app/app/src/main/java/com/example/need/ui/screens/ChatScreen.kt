package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun ChatScreen(
    jobRequestId: String,
    onBack: () -> Unit
) {
    // TODO: Agent - Subscribe to Firestore messages for jobRequestId
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        // Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(BrutalBlue)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = 4.dp)
                .padding(top = 40.dp, bottom = 16.dp, start = 16.dp, end = 16.dp)
        ) {
            Text(
                text = "BACK",
                fontWeight = FontWeight.Black,
                modifier = Modifier
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp)
                    .background(White)
                    .padding(8.dp)
                    // .clickable { onBack() }
            )
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text(
                    text = "PARTNER NAME",
                    fontWeight = FontWeight.Black,
                    fontSize = 20.sp,
                    color = Black
                )
                Text(
                    text = "SUBCATEGORY",
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    modifier = Modifier
                        .background(White)
                        .brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp)
                        .padding(horizontal = 4.dp, vertical = 2.dp)
                )
            }
        }

        // Messages List (Weight 1f)
        Box(modifier = Modifier.weight(1f)) {
            // TODO: Render LazyColumn with messages here
        }

        // Input Area
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(White)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = 0.dp)
                .padding(16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            // Input field
            Box(
                modifier = Modifier
                    .weight(1f)
                    .brutalStyle()
                    .background(BrutalBg)
                    .padding(16.dp)
            ) {
                Text(text = "Type a message...", color = Color.Gray, fontWeight = FontWeight.Bold)
            }
            
            // Send Button
            Box(
                modifier = Modifier
                    .brutalStyle()
                    .background(BrutalPink)
                    .padding(16.dp)
            ) {
                Text(text = "SEND", fontWeight = FontWeight.Black)
            }
        }
    }
}
