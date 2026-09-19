package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun RoleSelectionScreen(
    onRoleSelected: (String) -> Unit
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
            text = "WHO ARE YOU?",
            fontWeight = FontWeight.Black,
            fontSize = 40.sp,
            modifier = Modifier.padding(bottom = 48.dp)
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .brutalStyle(borderWidth = 4.dp, shadowOffset = 8.dp)
                .background(BrutalTeal)
                .clickable { onRoleSelected("customer") }
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("I'M A CUSTOMER", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Black)
        }

        Spacer(modifier = Modifier.height(32.dp))

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(120.dp)
                .brutalStyle(borderWidth = 4.dp, shadowOffset = 8.dp)
                .background(BrutalYellow)
                .clickable { onRoleSelected("artisan") }
                .padding(24.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("I'M A TECHNICIAN", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Black)
        }
    }
}
