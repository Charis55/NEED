package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    isArtisan: Boolean = false,
    onSignOut: () -> Unit
) {
    var activeTab by remember { mutableStateOf("profile") }
    
    // Profile
    var firstName by remember { mutableStateOf("User") }
    var lastName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("user@example.com") }
    var phone by remember { mutableStateOf("") }
    
    // Preferences
    var pushNotifications by remember { mutableStateOf(true) }
    var inAppNotifications by remember { mutableStateOf(true) }
    var messagingAlerts by remember { mutableStateOf(true) }
    var locationTracking by remember { mutableStateOf(true) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(White)
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "SETTINGS",
            fontWeight = FontWeight.Black,
            fontSize = 40.sp,
            color = Black,
            modifier = Modifier.padding(bottom = 24.dp)
        )
        
        // Tabs
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp)
                .background(White)
                .padding(bottom = 16.dp)
        ) {
            val tabs = listOf("PROFILE", "ACCOUNT", "ALERTS", "ABOUT")
            tabs.forEach { tab ->
                val isActive = activeTab.equals(tab, ignoreCase = true)
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { activeTab = tab.lowercase() }
                        .background(if (isActive) BrutalYellow else White)
                        .padding(vertical = 12.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = tab,
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        color = if (isActive) Black else Gray
                    )
                }
            }
        }
        
        when (activeTab) {
            "profile" -> {
                // Profile Picture
                Column(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Box(
                        modifier = Modifier
                            .size(120.dp)
                            .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                            .background(BrutalYellow),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = firstName.take(1),
                            fontWeight = FontWeight.Black,
                            fontSize = 48.sp,
                            color = Black
                        )
                    }
                    Text(
                        text = "TAP ICON TO CHANGE",
                        fontWeight = FontWeight.Black,
                        fontSize = 12.sp,
                        color = Gray,
                        modifier = Modifier.padding(top = 8.dp)
                    )
                }
                
                // Details Form
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(BrutalTeal)
                        .padding(24.dp)
                ) {
                    Text("PERSONAL DETAILS", fontWeight = FontWeight.Black, fontSize = 20.sp, modifier = Modifier.padding(bottom = 16.dp))
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text("FIRST NAME", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 8.dp))
                            OutlinedTextField(
                                value = firstName,
                                onValueChange = { firstName = it },
                                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                            )
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("LAST NAME", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 8.dp))
                            OutlinedTextField(
                                value = lastName,
                                onValueChange = { lastName = it },
                                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                            )
                        }
                    }
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text("EMAIL ADDRESS", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 8.dp))
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                    )
                    
                    Spacer(modifier = Modifier.height(16.dp))
                    
                    Text("PHONE NUMBER", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 8.dp))
                    OutlinedTextField(
                        value = phone,
                        onValueChange = { phone = it },
                        modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                    )
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                BrutalButton(
                    text = "SAVE PROFILE",
                    backgroundColor = BrutalGreen,
                    onClick = { /* TODO */ },
                    modifier = Modifier.fillMaxWidth().height(64.dp)
                )
            }
            "account" -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(White)
                        .padding(24.dp)
                ) {
                    Text("ACCOUNT ACTIONS", fontWeight = FontWeight.Black, fontSize = 20.sp, modifier = Modifier.padding(bottom = 16.dp))
                    
                    BrutalButton(
                        text = "CHANGE PASSWORD",
                        backgroundColor = BrutalYellow,
                        onClick = { /* TODO */ },
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp).height(56.dp)
                    )
                    
                    BrutalButton(
                        text = "SIGN OUT",
                        backgroundColor = LightGray,
                        onClick = onSignOut,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp).height(56.dp)
                    )
                    
                    BrutalButton(
                        text = "DELETE ACCOUNT",
                        backgroundColor = White,
                        textColor = BrutalRed,
                        onClick = { /* TODO */ },
                        modifier = Modifier.fillMaxWidth().height(56.dp)
                    )
                }
            }
            "alerts" -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(BrutalPink)
                        .padding(24.dp)
                ) {
                    Text("PREFERENCES", fontWeight = FontWeight.Black, fontSize = 20.sp, modifier = Modifier.padding(bottom = 24.dp))
                    
                    PreferenceToggle("PUSH NOTIFICATIONS", pushNotifications) { pushNotifications = it }
                    Spacer(modifier = Modifier.height(16.dp))
                    PreferenceToggle("IN-APP NOTIFICATIONS", inAppNotifications) { inAppNotifications = it }
                    Spacer(modifier = Modifier.height(16.dp))
                    PreferenceToggle("MESSAGING ALERTS", messagingAlerts) { messagingAlerts = it }
                    Spacer(modifier = Modifier.height(16.dp))
                    PreferenceToggle("LOCATION TRACKING", locationTracking) { locationTracking = it }
                }
            }
            "about" -> {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(BrutalBlue)
                        .padding(24.dp)
                ) {
                    Text("THE NEED VISION", fontWeight = FontWeight.Black, fontSize = 24.sp, color = White, modifier = Modifier.padding(bottom = 16.dp))
                    Text(
                        text = "NEED is a premium service marketplace designed to bridge the gap between skilled technicians and customers.",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        color = White,
                        lineHeight = 24.sp
                    )
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(BrutalTeal)
                        .padding(24.dp)
                ) {
                    Text("DEVELOPED BY CHARISCORP", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
                    Text(
                        text = "CharisCorp is an elite software engineering collective dedicated to building high-fidelity digital products.",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        lineHeight = 24.sp
                    )
                }
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                        .background(BrutalPink)
                        .padding(24.dp)
                ) {
                    Text("THE VISIONARY", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
                    Text(
                        text = "GRADUATE ENGR. OBUNEZI CHIDUGAM CHARIS\nCEO & Lead Architect",
                        fontWeight = FontWeight.Black,
                        fontSize = 18.sp,
                        lineHeight = 24.sp,
                        modifier = Modifier.padding(bottom = 16.dp)
                    )
                    Text(
                        text = "A forward-thinking engineer with a passion for building software that isn't just functional, but inspiring.",
                        fontWeight = FontWeight.Bold,
                        fontSize = 16.sp,
                        lineHeight = 24.sp
                    )
                }
            }
        }
        
        Spacer(modifier = Modifier.height(48.dp))
    }
}

@Composable
fun PreferenceToggle(title: String, isChecked: Boolean, onToggle: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp)
            .background(White)
            .padding(16.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(title, fontWeight = FontWeight.Black, fontSize = 14.sp)
        Switch(
            checked = isChecked,
            onCheckedChange = onToggle,
            colors = SwitchDefaults.colors(
                checkedThumbColor = Black,
                checkedTrackColor = BrutalGreen,
                uncheckedThumbColor = Black,
                uncheckedTrackColor = LightGray
            )
        )
    }
}
