const fs = require('fs');
const svg = fs.readFileSync('scratch/potrace_test/output.svg', 'utf8');
const pathMatch = svg.match(/<path d=\"([^\"]+)\"/);
if (!pathMatch) throw new Error('No path found');
const pathData = pathMatch[1];

const getXml = (color, viewport, translate) => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="${viewport}"
    android:viewportHeight="${viewport}">
    <group android:translateX="${translate}" android:translateY="${translate}">
        <path android:fillColor="${color}" android:pathData="${pathData}" />
    </group>
</vector>`;

fs.writeFileSync('android/app/src/main/res/drawable/ic_launcher_foreground.xml', getXml('#FFFFFF', 1800, 273));
fs.writeFileSync('android/app/src/main/res/drawable/ic_launcher_monochrome.xml', getXml('#000000', 1800, 273));

const getStatXml = () => `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp"
    android:height="24dp"
    android:viewportWidth="1800"
    android:viewportHeight="1800">
    <group android:translateX="273" android:translateY="273">
        <path android:fillColor="#FFFFFF" android:pathData="${pathData}" />
    </group>
</vector>`;

fs.writeFileSync('android/app/src/main/res/drawable/ic_stat_icon.xml', getStatXml());
console.log('Successfully wrote XML files');
