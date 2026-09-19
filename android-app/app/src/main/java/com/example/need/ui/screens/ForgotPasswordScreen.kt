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
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun ForgotPasswordScreen(
    onResetRequested: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("RESET PASSWORD", fontWeight = FontWeight.Black, fontSize = 32.sp)
        Spacer(modifier = Modifier.height(32.dp))
        
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .brutalStyle()
                .background(White)
                .padding(16.dp)
        ) {
            Text("Phone Number Input Placeholder", fontWeight = FontWeight.Bold)
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        BrutalButton(
            text = "SEND RESET CODE",
            backgroundColor = BrutalPink,
            onClick = { 
                // TODO: Agent - Firebase Auth Password Reset logic
                onResetRequested() 
            },
            modifier = Modifier.fillMaxWidth()
        )
    }
}
