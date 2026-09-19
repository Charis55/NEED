package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
fun CustomerJobRequestScreen(
    artisanId: String,
    onBack: () -> Unit,
    onSubmitRequest: () -> Unit
) {
    var description by remember { mutableStateOf("") }
    var budget by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        // Header
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
            Text("DIRECT REQUEST", fontWeight = FontWeight.Black, fontSize = 20.sp)
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            Text("REQUEST TECHNICIAN", fontWeight = FontWeight.Black, fontSize = 28.sp)
            Text("You are requesting a job directly.", fontWeight = FontWeight.Bold, color = BrutalBlue)
            Spacer(modifier = Modifier.height(24.dp))
            
            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("Describe the job clearly", fontWeight = FontWeight.Bold) },
                modifier = Modifier.fillMaxWidth().height(150.dp).brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp).background(White),
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            OutlinedTextField(
                value = budget,
                onValueChange = { budget = it },
                label = { Text("Offer Amount (₦)", fontWeight = FontWeight.Bold) },
                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp).background(White),
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
            )

            Spacer(modifier = Modifier.height(24.dp))
            
            Text("LOCATION", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
            Box(modifier = Modifier.fillMaxWidth().height(150.dp).brutalStyle(borderWidth = 4.dp).background(BrutalPink), contentAlignment = Alignment.Center) {
                Text("MAP LOCATION", fontWeight = FontWeight.Black, fontSize = 20.sp)
            }

            Spacer(modifier = Modifier.height(48.dp))
            
            BrutalButton(
                text = "SEND REQUEST",
                backgroundColor = BrutalTeal,
                onClick = onSubmitRequest,
                modifier = Modifier.fillMaxWidth().height(64.dp)
            )
            
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}
