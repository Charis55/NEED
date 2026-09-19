package com.example.need.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.need.ui.screens.*

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    // Check Firebase Auth in real app
    val startDestination = "landing" 

    NavHost(navController = navController, startDestination = startDestination) {
        
        composable("landing") {
            LandingScreen(
                onNavigateToCustomerAuth = { navController.navigate("auth") },
                onNavigateToArtisanAuth = { navController.navigate("auth") },
                onSignIn = { navController.navigate("auth") }
            )
        }

        composable("auth") {
            AuthScreen(
                onAuthSuccess = { navController.navigate("role_selection") },
                onNavigateBack = { navController.popBackStack() }
            )
        }

        composable("role_selection") {
            RoleSelectionScreen(
                onRoleSelected = { role ->
                    if (role == "customer") navController.navigate("customer_explore")
                    else navController.navigate("artisan_dashboard")
                }
            )
        }

        composable("customer_explore") {
            CustomerExploreScreen(
                onNavigateToCategory = { /* Handle category */ },
                onNavigateToNav = { route -> navController.navigate(route) }
            )
        }

        composable("artisan_dashboard") {
            ArtisanDashboardScreen(
                onNavigateToNav = { route -> navController.navigate(route) }
            )
        }
        
        // Add more routes as needed
    }
}
