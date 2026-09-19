package com.example.need.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.need.ui.screens.AuthScreen

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    
    // TODO: Android Studio Agent - Check Firebase Auth current user to decide start destination
    val startDestination = "auth" 

    NavHost(navController = navController, startDestination = startDestination) {
        
        composable("auth") {
            AuthScreen(onAuthSuccess = {
                // Navigate to role check or dashboard
            })
        }
        
        // Add more routes here for Customer and Artisan flows
    }
}
