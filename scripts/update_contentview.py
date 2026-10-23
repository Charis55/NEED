path = "/home/Charis/projects/Need/Sources/Need/ContentView.swift"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Remove WKUIDelegate from Coordinator inheritance list
old_decl = "final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {"
new_decl = "final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {"
assert old_decl in content, "old_decl not found"
content = content.replace(old_decl, new_decl)

# Extract WKUIDelegate methods out of Coordinator body and place in an extension
old_wkuidelegate_block = """        // MARK: - WKUIDelegate: Media Capture Permissions (Mic & Camera for Calls)
        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            print("[WebKit] Media capture permission granted for type: \\(type.rawValue)")
            decisionHandler(.grant)
        }

        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            decisionHandler: @escaping (WKPermissionDecision) -> Void
        ) {
            decisionHandler(.grant)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil {
                webView.load(navigationAction.request)
            }
            return nil
        }"""

assert old_wkuidelegate_block in content, "old_wkuidelegate_block not found"
content = content.replace(old_wkuidelegate_block, "")

# Find end of WebView struct
end_webview = "    }\n}"
assert end_webview in content, "end_webview not found"

extension_code = """    }
}

// MARK: - WKUIDelegate Extension (Guarantees protocol witness matching in Swift)
extension WebView.Coordinator: WKUIDelegate {
    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping @MainActor (WKPermissionDecision) -> Void
    ) {
        print("[WebKit] Media capture permission granted for type: \\(type.rawValue)")
        decisionHandler(.grant)
    }

    @available(iOS 15.0, *)
    func webView(
        _ webView: WKWebView,
        requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        decisionHandler: @escaping @MainActor (WKPermissionDecision) -> Void
    ) {
        decisionHandler(.grant)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }
}"""

content = content.replace(end_webview, extension_code, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)

print("SUCCESS: Moved WKUIDelegate to extension in ContentView.swift")
