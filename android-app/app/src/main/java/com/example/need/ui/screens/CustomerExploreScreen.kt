package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.CustomerDock
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@Composable
fun CustomerExploreScreen(
    onNavigateToCategory: (String) -> Unit,
    onNavigateToNav: (String) -> Unit
) {
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
            // Header
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = "NEED",
                    fontWeight = FontWeight.Black,
                    fontSize = 28.sp,
                    modifier = Modifier
                        .brutalStyle(borderWidth = 4.dp, shadowOffset = 4.dp)
                        .background(BrutalYellow)
                        .padding(horizontal = 8.dp, vertical = 4.dp)
                )
                // TODO: Agent - Add UserAvatar component here mapping to Firebase user
            }

            Text(
                text = "WHAT DO YOU NEED DONE?",
                fontWeight = FontWeight.Black,
                fontSize = 32.sp,
                modifier = Modifier.padding(16.dp),
                lineHeight = 36.sp
            )

            // Categories Grid
            val categories = listOf("PLUMBING", "ELECTRICAL", "CLEANING", "CARPENTRY")
            LazyVerticalGrid(
                columns = GridCells.Fixed(2),
                contentPadding = PaddingValues(16.dp),
                horizontalArrangement = Arrangement.spacedBy(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                items(categories.size) { index ->
                    val category = categories[index]
                    Box(
                        modifier = Modifier
                            .aspectRatio(1f)
                            .brutalStyle()
                            .background(if (index % 2 == 0) BrutalPink else BrutalTeal)
                            // .clickable { onNavigateToCategory(category) }
                    ) {
                        Text(
                            text = category,
                            fontWeight = FontWeight.Black,
                            modifier = Modifier.padding(16.dp)
                        )
                    }
                }
            }
        }

        // Dock
        CustomerDock(
            currentRoute = "explore",
            onNavigate = onNavigateToNav,
            modifier = Modifier.align(androidx.compose.ui.Alignment.BottomCenter)
        )
    }
}
