package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.CustomerDock
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CustomerExploreScreen(
    onNavigateToCategory: (String) -> Unit,
    onNavigateToNav: (String) -> Unit
) {
    var searchQuery by remember { mutableStateOf("") }
    
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(BrutalBg)
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(bottom = 96.dp) // Room for the dock
        ) {
            // Header Section
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BrutalGreen)
                    .padding(24.dp)
            ) {
                // Top Row (User Info + Sort)
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 32.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                                .background(BrutalYellow),
                            contentAlignment = Alignment.Center
                        ) {
                            Text("U", fontWeight = FontWeight.Black, fontSize = 24.sp, color = Black)
                        }
                        Spacer(modifier = Modifier.width(16.dp))
                        Column {
                            Text("NEW USER", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Black)
                            Box(modifier = Modifier.padding(top = 4.dp)) {
                                Text(
                                    "09.11.2022",
                                    fontWeight = FontWeight.Black,
                                    fontSize = 10.sp,
                                    color = Black,
                                    modifier = Modifier
                                        .background(White)
                                        .brutalStyle(borderWidth = 2.dp, shadowOffset = 2.dp)
                                        .padding(horizontal = 4.dp, vertical = 2.dp)
                                )
                            }
                        }
                    }
                    
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                            .background(BrutalPink)
                            .clickable { /* Handle sort */ },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Filled.List, contentDescription = "Sort", modifier = Modifier.size(24.dp), tint = Black)
                    }
                }
                
                // Huge Text
                Text(
                    text = "HOW CAN WE\nHELP YOU?",
                    fontWeight = FontWeight.Black,
                    fontSize = 52.sp,
                    color = Black,
                    lineHeight = 48.sp,
                    modifier = Modifier.padding(bottom = 24.dp)
                )
            }
            
            Divider(color = Black, thickness = 8.dp)
            
            // Search Bar Area
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(BrutalBg)
                    .padding(24.dp)
            ) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("SEARCH SERVICES...", fontWeight = FontWeight.Black) },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = "Search", tint = Black) },
                    modifier = Modifier
                        .fillMaxWidth()
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                        .background(White),
                    colors = TextFieldDefaults.outlinedTextFieldColors(
                        focusedBorderColor = Transparent,
                        unfocusedBorderColor = Transparent
                    )
                )
            }
            
            // Categories Grid
            Column(modifier = Modifier.fillMaxWidth().padding(16.dp).weight(1f)) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text("SERVICES", fontWeight = FontWeight.Black, fontSize = 20.sp, color = Black)
                    Box {
                        Text(
                            "BY AVAILABILITY",
                            fontWeight = FontWeight.Bold,
                            fontSize = 10.sp,
                            color = Black,
                            modifier = Modifier
                                .background(BrutalPink)
                                .brutalStyle(borderWidth = 2.dp, shadowOffset = 0.dp)
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
                
                val categories = listOf(
                    Pair("PLUMBING", BrutalBlue),
                    Pair("ELECTRICAL REPAIRS", White),
                    Pair("AC & REFRIGERATION", Black),
                    Pair("GENERATOR MAINTENANCE", BrutalYellow),
                    Pair("CARPENTRY", BrutalPink),
                    Pair("MASONRY & TILING", BrutalTeal)
                )
                
                LazyVerticalGrid(
                    columns = GridCells.Fixed(2),
                    horizontalArrangement = Arrangement.spacedBy(16.dp),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    items(categories.size) { index ->
                        val (category, color) = categories[index]
                        val textColor = if (color == Black) White else Black
                        
                        Box(
                            modifier = Modifier
                                .height(140.dp)
                                .brutalStyle(borderWidth = 4.dp, shadowOffset = 6.dp)
                                .background(color)
                                .clickable { onNavigateToCategory(category) }
                                .padding(12.dp),
                            contentAlignment = Alignment.BottomStart
                        ) {
                            Column {
                                Text(
                                    text = category,
                                    fontWeight = FontWeight.Black,
                                    fontSize = 14.sp,
                                    color = textColor,
                                    lineHeight = 16.sp,
                                    modifier = Modifier.padding(bottom = 4.dp)
                                )
                                Divider(color = if (color == Black) White else Black, thickness = 2.dp, modifier = Modifier.padding(bottom = 4.dp))
                                Text(
                                    text = "3 SPECIFIC SERVICES",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp,
                                    color = if (color == Black) LightGray else Color.DarkGray
                                )
                            }
                        }
                    }
                }
            }
        }

        // Dock
        CustomerDock(
            currentRoute = "explore",
            onNavigate = onNavigateToNav,
            modifier = Modifier.align(Alignment.BottomCenter)
        )
    }
}
