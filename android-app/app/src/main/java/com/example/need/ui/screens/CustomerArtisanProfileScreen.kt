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
fun CustomerArtisanProfileScreen(
    artisanId: String,
    onBack: () -> Unit,
    onRequestJob: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Back Button
        Row(modifier = Modifier.fillMaxWidth()) {
            Text(
                text = "BACK",
                fontWeight = FontWeight.Black,
                modifier = Modifier
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp)
                    .background(White)
                    .padding(8.dp)
            )
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Box(
            modifier = Modifier
                .size(150.dp)
                .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                .background(BrutalPink)
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        Text("TECHNICIAN PROFILE", fontWeight = FontWeight.Black, fontSize = 28.sp)
        Text("EXPERIENCE: 5 YEARS", fontWeight = FontWeight.Bold)
        
        Spacer(modifier = Modifier.weight(1f))
        
        BrutalButton(
            text = "HIRE TECHNICIAN",
            backgroundColor = BrutalGreen,
            onClick = onRequestJob,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
