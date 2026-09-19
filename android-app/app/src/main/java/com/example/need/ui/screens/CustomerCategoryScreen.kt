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
fun CustomerCategoryScreen(
    category: String,
    subcategory: String,
    onContinueToSwipe: () -> Unit,
    onBack: () -> Unit
) {
    var description by remember { mutableStateOf("") }
    var budget by remember { mutableStateOf("") }
    var urgency by remember { mutableStateOf("As soon as possible") }

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
                    // .clickable { onBack() }
            )
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                text = subcategory.uppercase(),
                fontWeight = FontWeight.Black,
                fontSize = 20.sp,
                color = Black
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(24.dp)
        ) {
            Text(
                text = "DESCRIBE THE JOB",
                fontWeight = FontWeight.Black,
                fontSize = 24.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )

            OutlinedTextField(
                value = description,
                onValueChange = { description = it },
                label = { Text("What exactly do you need done?", fontWeight = FontWeight.Bold) },
                modifier = Modifier.fillMaxWidth().height(120.dp).brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp).background(White),
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
            )
            
            Spacer(modifier = Modifier.height(24.dp))
            
            OutlinedTextField(
                value = budget,
                onValueChange = { budget = it },
                label = { Text("Estimated Budget (₦)", fontWeight = FontWeight.Bold) },
                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp).background(White),
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Color.Transparent, unfocusedBorderColor = Color.Transparent)
            )

            Spacer(modifier = Modifier.height(24.dp))
            
            Text(
                text = "LOCATION",
                fontWeight = FontWeight.Black,
                fontSize = 24.sp,
                modifier = Modifier.padding(bottom = 16.dp)
            )
            
            // Map Component Placeholder
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                    .background(BrutalTeal),
                contentAlignment = Alignment.Center
            ) {
                Text("GOOGLE MAPS", fontWeight = FontWeight.Black, color = White, fontSize = 24.sp)
                Text("\n(Tap to set exact location)", color = White, fontWeight = FontWeight.Bold)
            }

            Spacer(modifier = Modifier.height(48.dp))

            BrutalButton(
                text = "FIND TECHNICIANS",
                backgroundColor = BrutalTeal,
                onClick = onContinueToSwipe,
                modifier = Modifier.fillMaxWidth()
            )
            
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}
