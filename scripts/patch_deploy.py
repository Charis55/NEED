path = "/home/Charis/projects/Need/scripts/deploy-need-ios.sh"
with open(path, "r") as f:
    content = f.read()

target = 'if [ "$IS_NATIVE" = "true" ]; then\n        ideviceinstaller -u "$UDID" install'
replacement = 'if [ "$IS_NATIVE" = "true" ]; then\n        ideviceinstaller -u "$UDID" uninstall XTL-R2UXMFNV3Z.com.chiduga.need 2>/dev/null || true\n        ideviceinstaller -u "$UDID" install'

if target in content:
    content = content.replace(target, replacement)
    with open(path, "w") as f:
        f.write(content)
    print("deploy-need-ios.sh updated successfully!")
else:
    print("Already updated or target not found")
