package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    requestId: String,
    userRole: String,
    onBack: () -> Unit
) {
    var message by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        // Chat Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(White)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = 4.dp)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = "BACK",
                fontWeight = FontWeight.Black,
                modifier = Modifier
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp)
                    .background(BrutalYellow)
                    .padding(8.dp)
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text("JOB #$requestId", fontWeight = FontWeight.Black, fontSize = 20.sp)
        }

        // Messages List
        LazyColumn(
            modifier = Modifier.weight(1f),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Customer Message Bubble
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (userRole == "customer") Arrangement.End else Arrangement.Start) {
                    Box(modifier = Modifier.fillMaxWidth(0.8f).brutalStyle(borderWidth = 3.dp).background(if (userRole == "customer") BrutalPink else White).padding(16.dp)) {
                        Text("Hey! I need you to fix a broken pipe under my sink as soon as possible.", fontWeight = FontWeight.Bold)
                    }
                }
            }
            // Artisan Message Bubble
            item {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = if (userRole == "artisan") Arrangement.End else Arrangement.Start) {
                    Box(modifier = Modifier.fillMaxWidth(0.8f).brutalStyle(borderWidth = 3.dp).background(if (userRole == "artisan") BrutalTeal else White).padding(16.dp)) {
                        Text("I can be there in 30 minutes! Can you send a picture?", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // Input Box
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(White)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = -2.dp)
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.size(48.dp).brutalStyle(borderWidth = 2.dp).background(BrutalYellow), contentAlignment = Alignment.Center) {
                Text("+", fontWeight = FontWeight.Black, fontSize = 24.sp)
            }
            Spacer(modifier = Modifier.width(8.dp))
            OutlinedTextField(
                value = message,
                onValueChange = { message = it },
                modifier = Modifier.weight(1f).brutalStyle(borderWidth = 3.dp).background(White),
                placeholder = { Text("Type a message...", fontWeight = FontWeight.Bold) },
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
            )
            Spacer(modifier = Modifier.width(8.dp))
            BrutalButton(
                text = "SEND",
                backgroundColor = BrutalTeal,
                onClick = { /* TODO: Agent - Send to Firestore */ }
            )
        }
    }
}
