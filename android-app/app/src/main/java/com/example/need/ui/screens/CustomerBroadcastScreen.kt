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
fun CustomerBroadcastScreen(
    onBroadcastSent: () -> Unit
) {
    var description by remember { mutableStateOf("") }
    var budget by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("BROADCAST JOB TO ALL", fontWeight = FontWeight.Black, fontSize = 28.sp)
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "This will ping all nearby technicians matching your category.",
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(bottom = 32.dp)
        )
        
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
            label = { Text("Budget (₦)", fontWeight = FontWeight.Bold) },
            modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp).background(White),
            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
        )

        Spacer(modifier = Modifier.height(48.dp))
        
        BrutalButton(
            text = "SEND BROADCAST",
            backgroundColor = BrutalPink,
            onClick = onBroadcastSent,
            modifier = Modifier.fillMaxWidth().height(64.dp)
        )
    }
}
