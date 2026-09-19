package com.example.need.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.need.ui.components.BrutalButton
import com.example.need.ui.components.brutalStyle
import com.example.need.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AuthScreen(onAuthSuccess: () -> Unit, onNavigateBack: () -> Unit = {}) {
    var isLogin by remember { mutableStateOf(true) }
    var role by remember { mutableStateOf("customer") } // "customer" or "artisan"
    
    // Form States
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var phoneNumber by remember { mutableStateOf("") }
    var showPassword by remember { mutableStateOf(false) }
    var rememberMe by remember { mutableStateOf(true) }
    var termsAccepted by remember { mutableStateOf(false) }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(White)
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
    ) {
        // Top Header
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 32.dp)
                .brutalStyle(borderWidth = 0.dp, shadowOffset = 0.dp)
                .background(Transparent),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .brutalStyle(borderWidth = 3.dp, shadowOffset = 4.dp)
                    .background(BrutalYellow)
                    .clickable { onNavigateBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Black, modifier = Modifier.size(28.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.size(36.dp).background(Black)) // Logo placeholder
                Text(
                    text = "EED",
                    fontWeight = FontWeight.Black,
                    fontSize = 32.sp,
                    color = Black,
                    modifier = Modifier.padding(start = 4.dp)
                )
            }
        }

        // Title Section
        Text(
            text = if (isLogin) "WELCOME BACK!" else "SETUP NEED ACCOUNT",
            fontWeight = FontWeight.Black,
            fontSize = 36.sp,
            color = Black,
            lineHeight = 40.sp,
            modifier = Modifier.padding(bottom = 16.dp)
        )

        Box(modifier = Modifier.padding(bottom = 32.dp)) {
            Text(
                text = if (isLogin) "Login to continue" else "Create your account",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                modifier = Modifier
                    .background(BrutalYellow)
                    .brutalStyle(borderWidth = 2.dp, shadowOffset = 0.dp)
                    .padding(horizontal = 8.dp, vertical = 4.dp)
            )
        }

        // Social Login (Only for Login)
        if (isLogin) {
            BrutalButton(
                text = "GOOGLE SIGN IN",
                backgroundColor = White,
                onClick = { /* TODO: Agent - Implement Google Sign In */ },
                modifier = Modifier.fillMaxWidth().height(56.dp)
            )
            
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth().padding(vertical = 32.dp)
            ) {
                Divider(modifier = Modifier.weight(1f), color = Black, thickness = 4.dp)
                Text(
                    text = "OR",
                    fontWeight = FontWeight.Black,
                    fontSize = 20.sp,
                    modifier = Modifier.padding(horizontal = 16.dp)
                )
                Divider(modifier = Modifier.weight(1f), color = Black, thickness = 4.dp)
            }
        }

        // Signup Role Selector
        if (!isLogin) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp)
                    .background(BrutalBg)
                    .padding(8.dp)
                    .padding(bottom = 24.dp)
            ) {
                BrutalButton(
                    text = "CUSTOMER",
                    backgroundColor = if (role == "customer") BrutalBlue else Transparent,
                    onClick = { role = "customer" },
                    modifier = Modifier.weight(1f).height(48.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                BrutalButton(
                    text = "TECHNICIAN",
                    backgroundColor = if (role == "artisan") BrutalBlue else Transparent,
                    onClick = { role = "artisan" },
                    modifier = Modifier.weight(1f).height(48.dp)
                )
            }
            Spacer(modifier = Modifier.height(24.dp))
            
            // Name Fields
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("FIRST NAME", fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
                    OutlinedTextField(
                        value = firstName,
                        onValueChange = { firstName = it },
                        modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent),
                        placeholder = { Text("First") }
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("LAST NAME", fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
                    OutlinedTextField(
                        value = lastName,
                        onValueChange = { lastName = it },
                        modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                        colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent),
                        placeholder = { Text("Last") }
                    )
                }
            }
            Spacer(modifier = Modifier.height(24.dp))
            
            // Phone
            Text("PHONE", fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
            OutlinedTextField(
                value = phoneNumber,
                onValueChange = { phoneNumber = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
                colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent),
                placeholder = { Text("+2348012345678") }
            )
            Spacer(modifier = Modifier.height(24.dp))
        }

        // Email
        Text("EMAIL", fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
        OutlinedTextField(
            value = email,
            onValueChange = { email = it },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent),
            placeholder = { Text("email@example.com") }
        )
        Spacer(modifier = Modifier.height(24.dp))

        // Password
        Text("PASSWORD", fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.padding(bottom = 8.dp))
        OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(White),
            trailingIcon = {
                Text(
                    text = if (showPassword) "HIDE" else "SHOW",
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.clickable { showPassword = !showPassword }.padding(8.dp)
                )
            },
            colors = TextFieldDefaults.outlinedTextFieldColors(focusedBorderColor = Transparent, unfocusedBorderColor = Transparent),
            placeholder = { Text("••••••••") }
        )

        if (isLogin) {
            Box(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.CenterEnd) {
                Text(
                    text = "FORGOT PASSWORD?",
                    fontWeight = FontWeight.Black,
                    fontSize = 14.sp,
                    modifier = Modifier.clickable { /* Handle click */ }
                )
            }
        }
        
        Spacer(modifier = Modifier.height(32.dp))

        if (isLogin) {
            Row(
                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(BrutalTeal).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(checked = rememberMe, onCheckedChange = { rememberMe = it })
                Text("REMEMBER ME", fontWeight = FontWeight.Black, fontSize = 18.sp)
            }
        } else {
            Row(
                modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(BrutalBg).padding(16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Checkbox(checked = termsAccepted, onCheckedChange = { termsAccepted = it })
                Text("I have read and unconditionally agree to the Security Disclaimer & Terms of Service.", fontWeight = FontWeight.Bold, fontSize = 14.sp, lineHeight = 18.sp)
            }
        }

        Spacer(modifier = Modifier.height(32.dp))
        
        BrutalButton(
            text = if (isLogin) "SIGN IN" else "CREATE ACCOUNT",
            backgroundColor = if (isLogin) BrutalTeal else BrutalYellow,
            onClick = { onAuthSuccess() },
            modifier = Modifier.fillMaxWidth().height(64.dp)
        )
        
        Spacer(modifier = Modifier.height(32.dp))

        // Switch Mode
        Box(modifier = Modifier.fillMaxWidth().brutalStyle(borderWidth = 4.dp, shadowOffset = 0.dp).background(BrutalBg).padding(16.dp), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(text = if (isLogin) "NO ACCOUNT?" else "ALREADY JOINED?", fontWeight = FontWeight.Black, fontSize = 18.sp)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (isLogin) "SIGN UP" else "LOG IN",
                    fontWeight = FontWeight.Black,
                    fontSize = 20.sp,
                    color = BrutalBlue,
                    modifier = Modifier.clickable { isLogin = !isLogin }
                )
            }
        }
        
        Spacer(modifier = Modifier.height(48.dp))
    }
}
