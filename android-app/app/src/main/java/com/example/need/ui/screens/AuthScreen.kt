package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.theme.Black
import com.example.need.ui.theme.BrutalBg
import com.example.need.ui.theme.BrutalPink
import com.example.need.ui.theme.BrutalYellow

@Composable
fun AuthScreen(onAuthSuccess: () -> Unit) {
    var phoneNumber by remember { mutableStateOf("") }
    var verificationCode by remember { mutableStateOf("") }
    var codeSent by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "NEED",
            fontWeight = FontWeight.Black,
            fontSize = 48.sp,
            color = Black,
            modifier = Modifier.padding(bottom = 32.dp)
        )

        // TODO: Android Studio Agent - Implement Firebase Phone Auth UI state here.
        // For now, this is a placeholder UI that matches the Neo-Brutalist design.
        
        if (!codeSent) {
            Text(
                text = "Enter Phone Number",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            // Replace with BrutalTextField
            
            Spacer(modifier = Modifier.height(24.dp))
            BrutalButton(
                text = "Send Code",
                backgroundColor = BrutalYellow,
                onClick = { 
                    codeSent = true 
                    // Trigger Firebase Phone Auth here
                }
            )
        } else {
            Text(
                text = "Enter Verification Code",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier.padding(bottom = 8.dp)
            )
            // Replace with BrutalTextField
            
            Spacer(modifier = Modifier.height(24.dp))
            BrutalButton(
                text = "Verify & Login",
                backgroundColor = BrutalPink,
                onClick = { 
                    onAuthSuccess() 
                    // Verify Firebase OTP here
                }
            )
        }
    }
}
