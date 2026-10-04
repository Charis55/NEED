const fs = require('fs');
let html = fs.readFileSync('public/error.html', 'utf8');
const b64 = fs.readFileSync('public/base64_logo.txt', 'utf8');

html = html.replace('src="LOGO.png"', 'src="data:image/png;base64,' + b64 + '"');
html = html.replace("window.location.replace('/');", "window.location.href = 'https://need-chi.vercel.app';");
// Also update if they are just returning to the app without using replace() to keep history context
html = html.replace("window.location.replace('https://need-chi.vercel.app');", "window.location.href = 'https://need-chi.vercel.app';");

fs.writeFileSync('public/error.html', html);
console.log('Successfully updated error.html');
