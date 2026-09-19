package com.example.need.ui.screens

import androidx.compose.animation.Crossfade
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.R
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*
import kotlinx.coroutines.delay

@Composable
fun LandingScreen(
    onNavigateToCustomerAuth: () -> Unit,
    onNavigateToArtisanAuth: () -> Unit,
    onSignIn: () -> Unit
) {
    // Slideshow state
    val backgrounds = listOf(
        BrutalYellow,
        BrutalPink,
        BrutalTeal
    )
    var bgIndex by remember { mutableIntStateOf(0) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(5000)
            bgIndex = (bgIndex + 1) % backgrounds.size
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
        ) {
            // Navbar
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp)
                            .background(Black),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("N", color = White, fontWeight = FontWeight.Black, fontSize = 24.sp)
                    }
                    Text(
                        text = "EED",
                        fontWeight = FontWeight.Black,
                        fontSize = 32.sp,
                        color = Black,
                        modifier = Modifier.padding(start = 8.dp)
                    )
                }

                BrutalButton(
                    text = "SIGN IN",
                    backgroundColor = BrutalYellow,
                    onClick = onSignIn,
                    modifier = Modifier.height(48.dp)
                )
            }

            // Slideshow Image Box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(300.dp)
                    .padding(horizontal = 24.dp)
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 8.dp)
                    .background(White)
                    .clipToBounds(),
                contentAlignment = Alignment.Center
            ) {
                Crossfade(
                    targetState = bgIndex,
                    animationSpec = tween(1000),
                    label = "slideshow"
                ) { index ->
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .background(backgrounds[index])
                    )
                }
                Text(
                    "BROWSE PORTFOLIOS", 
                    fontWeight = FontWeight.Black, 
                    color = Black,
                    fontSize = 20.sp,
                    modifier = Modifier
                        .background(White)
                        .border(4.dp, Black)
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                )
            }

            // Hero Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp)
            ) {
                Row(
                    modifier = Modifier
                        .brutalStyle(borderWidth = 2.dp, shadowOffset = 3.dp)
                        .background(White)
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        Icons.Filled.CheckCircle, 
                        contentDescription = null, 
                        tint = BrutalRed, 
                        modifier = Modifier.size(20.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        "100% VERIFIED PROS", 
                        fontWeight = FontWeight.Black, 
                        fontSize = 12.sp, 
                        letterSpacing = 1.sp
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                Text(
                    text = "THE RAW WAY TO HIRE",
                    fontWeight = FontWeight.Black,
                    fontSize = 42.sp,
                    lineHeight = 44.sp,
                    letterSpacing = (-1).sp
                )
                
                Box(
                    modifier = Modifier
                        .padding(top = 8.dp)
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                        .background(BrutalTeal)
                        .padding(horizontal = 12.dp, vertical = 6.dp)
                ) {
                    Text(
                        text = "TRUSTED TECHNICIANS.",
                        fontWeight = FontWeight.Black,
                        fontSize = 30.sp,
                        color = Black
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Description with vertical line
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .width(6.dp)
                            .height(80.dp)
                            .background(Black)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Text(
                        text = "From plumbers to electricians to tailors. Browse verified portfolios, read real reviews, and request skilled professionals instantly.",
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp,
                        lineHeight = 24.sp,
                        color = Black
                    )
                }

                Spacer(modifier = Modifier.height(40.dp))

                BrutalButton(
                    text = "START EXPLORING →",
                    backgroundColor = BrutalRed,
                    textColor = White,
                    onClick = onNavigateToCustomerAuth,
                    modifier = Modifier.fillMaxWidth().height(64.dp)
                )

                Spacer(modifier = Modifier.height(16.dp))

                BrutalButton(
                    text = "BECOME A TECHNICIAN",
                    backgroundColor = White,
                    onClick = onNavigateToArtisanAuth,
                    modifier = Modifier.fillMaxWidth().height(64.dp)
                )

                Spacer(modifier = Modifier.height(48.dp))

                // Feature Section Header
                Text(
                    "WHY CHOOSE NEED?",
                    fontWeight = FontWeight.Black,
                    fontSize = 24.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )

                // Feature Grid
                FeatureCard(
                    "VETTED & VERIFIED", 
                    "Every technician on our platform goes through a strict verification process before they can accept jobs.", 
                    BrutalBlue, 
                    Icons.Filled.CheckCircle
                )
                Spacer(modifier = Modifier.height(24.dp))
                FeatureCard(
                    "LOCAL TO YOU", 
                    "Find professionals who are already working in your exact neighborhood for faster response times.", 
                    BrutalYellow, 
                    Icons.Filled.LocationOn
                )
                Spacer(modifier = Modifier.height(24.dp))
                FeatureCard(
                    "TRANSPARENT PORTFOLIOS", 
                    "Don't rely on word of mouth. View photos of their past work and read reviews from your neighbors.", 
                    BrutalPink, 
                    Icons.Filled.Warning
                )
                
                Spacer(modifier = Modifier.height(64.dp))
            }
        }
    }
}

@Composable
fun FeatureCard(title: String, desc: String, bgColor: Color, icon: ImageVector) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
            .background(bgColor)
            .padding(24.dp)
    ) {
        Column {
            Box(
                modifier = Modifier
                    .size(64.dp)
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 2.dp)
                    .background(White),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = Black, modifier = Modifier.size(32.dp))
            }
            Spacer(modifier = Modifier.height(24.dp))
            Text(title, fontWeight = FontWeight.Black, fontSize = 24.sp, letterSpacing = 1.sp, color = Black)
            Spacer(modifier = Modifier.height(16.dp))
            Text(desc, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Black, lineHeight = 22.sp)
        }
    }
}
