# iOS Deployment & Installation Rule

## Automatic iPhone Installation Protocol
Whenever an iOS IPA (`Need.ipa`) is built or signed after making changes to the codebase, assets, or native Swift configuration:
1. **Always install the newly signed `.ipa` on the user's physical iPhone immediately**.
2. **Never stop at just building or signing the `.ipa`**.
3. **Execution Pipeline**:
   - Ensure the iPhone is attached via USB/IP (`usbipd.exe attach --wsl --busid 2-2`).
   - Rebuild & sign the application using `xtool dev build --ipa --sign` in `/home/Charis/projects/Need`.
   - Install the signed `.ipa` directly to the device using:
     ```bash
     ideviceinstaller install /home/Charis/projects/Need/xtool/Need.ipa
     ```
   - Verify the device reports `Install: InstallComplete (100%)`.
   - Sync the output IPA to the Windows project root at `Need.ipa`.
