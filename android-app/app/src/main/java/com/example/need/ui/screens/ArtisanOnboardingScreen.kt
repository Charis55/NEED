package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ArtisanOnboardingScreen(
    onOnboardingComplete: () -> Unit
) {
    var step by remember { mutableIntStateOf(1) }
    
    // Step 1: Services
    var tradeCategory by remember { mutableStateOf("Plumbing") }
    var locationName by remember { mutableStateOf("") }
    
    // Step 2: Skill Assessment
    var yearsExp by remember { mutableStateOf("< 1 year") }
    var skillLevel by remember { mutableStateOf("Intermediate") }
    
    // Step 3: Bio
    var bio by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(White)
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            text = "CREATE YOUR PROFILE",
            fontWeight = FontWeight.Black,
            fontSize = 32.sp,
            color = Black,
            lineHeight = 36.sp,
            modifier = Modifier.padding(bottom = 8.dp)
        )
        
        Box(modifier = Modifier.padding(bottom = 32.dp)) {
            Text(
                text = "STEP $step OF 4",
                fontWeight = FontWeight.Black,
                fontSize = 14.sp,
                modifier = Modifier
                    .background(BrutalBlue)
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 0.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        when (step) {
            1 -> {
                Text("YOUR SERVICES", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                // Primary Trade
                Text("PRIMARY TRADE", fontWeight = FontWeight.Black, fontSize = 14.sp, modifier = Modifier.padding(bottom = 8.dp))
                OutlinedTextField(
                    value = tradeCategory,
                    onValueChange = { tradeCategory = it },
                    modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                    colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                // Location
                Text("SERVICE LOCATION *", fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                Text("We strictly require your location to connect you with nearby customers.", fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                BrutalButton(
                    text = "📍 DETECT MY LOCATION",
                    backgroundColor = BrutalYellow,
                    onClick = { locationName = "Lagos, Nigeria" },
                    modifier = Modifier.fillMaxWidth().height(64.dp)
                )
                if (locationName.isNotEmpty()) {
                    Text(text = locationName, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 8.dp))
                }
            }
            2 -> {
                Text("SKILL ASSESSMENT", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                Text("YEARS OF EXPERIENCE", fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                OutlinedTextField(
                    value = yearsExp,
                    onValueChange = { yearsExp = it },
                    modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                    colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                )
                
                Spacer(modifier = Modifier.height(24.dp))
                
                Text("SELF-ASSESSED SKILL LEVEL", fontWeight = FontWeight.Black, fontSize = 18.sp, modifier = Modifier.padding(bottom = 8.dp))
                OutlinedTextField(
                    value = skillLevel,
                    onValueChange = { skillLevel = it },
                    modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                    colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                )
            }
            3 -> {
                Text("BIO / EXPERIENCE", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                OutlinedTextField(
                    value = bio,
                    onValueChange = { bio = it },
                    placeholder = { Text("Tell customers about your experience...") },
                    modifier = Modifier.fillMaxWidth().height(200.dp).brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                    colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent)
                )
            }
            4 -> {
                Text("PORTFOLIO PHOTOS", fontWeight = FontWeight.Black, fontSize = 24.sp, modifier = Modifier.padding(bottom = 8.dp))
                Text("Upload photos of your past work.", fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                BrutalButton(
                    text = "SELECT PHOTOS",
                    backgroundColor = BrutalBlue,
                    onClick = { /* TODO */ },
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                )
                
                Spacer(modifier = Modifier.height(32.dp))
                
                Text("SECURITY & VERIFICATION *", fontWeight = FontWeight.Black, fontSize = 24.sp, color = BrutalRed, modifier = Modifier.padding(bottom = 8.dp))
                Text("A valid Police Clearance Certificate is strictly required.", fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(bottom = 16.dp))
                
                BrutalButton(
                    text = "UPLOAD POLICE CLEARANCE",
                    backgroundColor = BrutalRed,
                    textColor = White,
                    onClick = { /* TODO */ },
                    modifier = Modifier.fillMaxWidth().height(56.dp)
                )
            }
        }
        
        Spacer(modifier = Modifier.height(48.dp))
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            if (step > 1) {
                BrutalButton(
                    text = "BACK",
                    backgroundColor = White,
                    onClick = { step-- },
                    modifier = Modifier.weight(1f).height(64.dp)
                )
            }
            BrutalButton(
                text = if (step == 4) "COMPLETE" else "NEXT",
                backgroundColor = BrutalTeal,
                onClick = {
                    if (step < 4) step++ else onOnboardingComplete()
                },
                modifier = Modifier.weight(2f).height(64.dp)
            )
        }
    }
}
