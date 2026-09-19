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
fun CustomerSwipeScreen(
    onJobRequested: (String) -> Unit
) {
    // TODO: Agent - Implement fetching available artisans in the category from Firestore
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "AVAILABLE TECHNICIANS",
                fontWeight = FontWeight.Black,
                fontSize = 24.sp,
                modifier = Modifier.padding(bottom = 24.dp)
            )
            
            // Swipe Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 8.dp)
                    .background(White)
            ) {
                Column(
                    modifier = Modifier.fillMaxSize()
                ) {
                    // Photo Placeholder filling top half
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1.5f)
                            .background(BrutalPink),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("PROFILE PHOTO\n(SWIPEABLE)", fontWeight = FontWeight.Black, fontSize = 20.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    }
                    
                    // Details
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f)
                            .brutalStyle(borderWidth = 0.dp, shadowOffset = 0.dp)
                            .background(White)
                            .padding(24.dp)
                    ) {
                        Text("JOHN DOE, 32", fontWeight = FontWeight.Black, fontSize = 32.sp)
                        Text("EXPERT PLUMBER", fontWeight = FontWeight.Bold, color = BrutalBlue, fontSize = 18.sp)
                        Spacer(modifier = Modifier.height(16.dp))
                        
                        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                            Box(modifier = Modifier.brutalStyle().background(BrutalYellow).padding(8.dp)) {
                                Text("5 YEARS EXP", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                            Box(modifier = Modifier.brutalStyle().background(BrutalGreen).padding(8.dp)) {
                                Text("4.9 RATING", fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            }
                        }
                        
                        Spacer(modifier = Modifier.height(16.dp))
                        Text("Distance: 2.5km away", fontWeight = FontWeight.Bold)
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(32.dp))
            
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                BrutalButton(
                    text = "NOPE (X)",
                    backgroundColor = BrutalRed,
                    onClick = { /* TODO: Agent - Skip artisan */ },
                    modifier = Modifier.weight(1f).height(64.dp)
                )
                Spacer(modifier = Modifier.width(16.dp))
                BrutalButton(
                    text = "REQUEST",
                    backgroundColor = BrutalGreen,
                    onClick = { 
                        // TODO: Agent - Create job request in Firestore
                    },
                    modifier = Modifier.weight(1f).height(64.dp)
                )
            }
            Spacer(modifier = Modifier.height(48.dp))
        }
    }
}
