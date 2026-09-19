package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
fun AdminDashboardScreen(
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
            .verticalScroll(rememberScrollState())
            .padding(24.dp)
    ) {
        Text("ADMIN CONTROL PANEL", fontWeight = FontWeight.Black, fontSize = 32.sp)
        Spacer(modifier = Modifier.height(32.dp))
        
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .brutalStyle()
                .background(BrutalRed)
                .padding(24.dp)
        ) {
            Text("WARNING: AUTHORIZED PERSONNEL ONLY", fontWeight = FontWeight.Black, color = White)
        }

        Spacer(modifier = Modifier.height(32.dp))

        // System Stats
        Text("SYSTEM STATS", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            Box(modifier = Modifier.weight(1f).aspectRatio(1f).brutalStyle().background(BrutalTeal).padding(16.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("1,245", fontWeight = FontWeight.Black, fontSize = 28.sp, color = White)
                    Text("USERS", fontWeight = FontWeight.Bold, color = White)
                }
            }
            Box(modifier = Modifier.weight(1f).aspectRatio(1f).brutalStyle().background(BrutalYellow).padding(16.dp), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("342", fontWeight = FontWeight.Black, fontSize = 28.sp, color = Black)
                    Text("TECHNICIANS", fontWeight = FontWeight.Bold, color = Black)
                }
            }
        }

        Spacer(modifier = Modifier.height(32.dp))

        // Actions
        Text("ACTIONS", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
        
        BrutalButton(
            text = "VERIFY TECHNICIANS (12 PENDING)",
            backgroundColor = BrutalPink,
            onClick = { /* TODO */ },
            modifier = Modifier.fillMaxWidth().height(64.dp)
        )
        Spacer(modifier = Modifier.height(16.dp))
        BrutalButton(
            text = "SYSTEM SETTINGS",
            backgroundColor = White,
            onClick = { /* TODO */ },
            modifier = Modifier.fillMaxWidth().height(64.dp)
        )

        Spacer(modifier = Modifier.height(48.dp))
        
        BrutalButton(
            text = "LOGOUT",
            backgroundColor = Black,
            textColor = White,
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth()
        )
    }
}
