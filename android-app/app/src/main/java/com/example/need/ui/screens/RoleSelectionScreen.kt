package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.theme.*

@Composable
fun RoleSelectionScreen(
    onSelectCustomer: () -> Unit,
    onSelectArtisan: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "HOW DO YOU WANT TO USE NEED?",
            fontWeight = FontWeight.Black,
            fontSize = 32.sp,
            modifier = Modifier.padding(bottom = 32.dp),
            lineHeight = 36.sp
        )

        BrutalButton(
            text = "I NEED A TECHNICIAN",
            backgroundColor = BrutalTeal,
            onClick = onSelectCustomer,
            modifier = Modifier.fillMaxWidth()
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        
        BrutalButton(
            text = "I AM A TECHNICIAN",
            backgroundColor = BrutalPink,
            onClick = onSelectArtisan,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
