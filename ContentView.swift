import SwiftUI
import WebKit
import AVFoundation
import CoreLocation
import Photos
import UserNotifications
import CallKit

// MARK: - Native CallKit & Dynamic Island Manager
@MainActor
final class NativeCallKitManager: NSObject, CXProviderDelegate {
    static let shared = NativeCallKitManager()

    private let provider: CXProvider
    private let callController = CXCallController()
    private var activeCallUUID: UUID?

    override init() {
        let config = CXProviderConfiguration()
        config.supportsVideo = true
        config.maximumCallGroups = 1
        config.maximumCallsPerCallGroup = 1
        config.supportedHandleTypes = [.generic]
        config.includesCallsInRecents = false

        self.provider = CXProvider(configuration: config)
        super.init()
        self.provider.setDelegate(self, queue: nil)
    }

    func startCall(partnerName: String, isVideo: Bool) {
        let uuid = UUID()
        self.activeCallUUID = uuid
        let handle = CXHandle(type: .generic, value: partnerName)
        let startAction = CXStartCallAction(call: uuid, handle: handle)
        startAction.isVideo = isVideo

        let transaction = CXTransaction(action: startAction)
        callController.request(transaction) { [weak self] error in
            if error == nil {
                Task { @MainActor in
                    self?.provider.reportOutgoingCall(with: uuid, connectedAt: Date())
                }
            }
        }

        // Configure audio routing: earpiece for voice, speaker for video
        setAudioMode(mode: isVideo ? "speaker" : "earpiece")
    }

    func resetCallState() {
        self.activeCallUUID = nil
        UIDevice.current.isProximityMonitoringEnabled = false
    }

    func endCall() {
        guard let uuid = activeCallUUID else { return }
        let endAction = CXEndCallAction(call: uuid)
        let transaction = CXTransaction(action: endAction)
        callController.request(transaction) { _ in }
        provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
        resetCallState()

        // Reset audio session
        let session = AVAudioSession.sharedInstance()
        try? session.overrideOutputAudioPort(.none)
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }

    func setAudioMode(mode: String) {
        let session = AVAudioSession.sharedInstance()
        do {
            if mode == "speaker" {
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker])
                try session.overrideOutputAudioPort(.speaker)
                UIDevice.current.isProximityMonitoringEnabled = false
            } else {
                // Discrete earpiece
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP])
                try session.overrideOutputAudioPort(.none)
                // Turn on proximity sensor so screen sleeps when close to ear
                UIDevice.current.isProximityMonitoringEnabled = true
            }
            try session.setActive(true)
        } catch {
            print("Failed to set audio session mode:", error)
        }
    }

    // MARK: - CXProviderDelegate
    nonisolated func providerDidReset(_ provider: CXProvider) {
        Task { @MainActor in
            NativeCallKitManager.shared.resetCallState()
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.resetCallState()
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        action.fulfill()
    }
}

// MARK: - Native Permission Manager
@MainActor
final class PermissionManager: NSObject, CLLocationManagerDelegate {
    static let shared = PermissionManager()
    private let locationManager = CLLocationManager()

    override init() {
        super.init()
        locationManager.delegate = self
    }

    func requestAllPermissions() {
        // 1. Audio / Microphone (For in-app calling)
        AVAudioSession.sharedInstance().requestRecordPermission { _ in
            try? AVAudioSession.sharedInstance().setCategory(
                .playAndRecord,
                mode: .voiceChat,
                options: [.allowBluetoothHFP, .allowBluetoothA2DP]
            )
        }

        // 2. Camera (For taking job photos and verification)
        AVCaptureDevice.requestAccess(for: .video) { _ in }

        // 3. Photo Library (For uploading job images and service documentation)
        PHPhotoLibrary.requestAuthorization { _ in }

        // 4. Location (For connecting to nearby artisans)
        locationManager.requestWhenInUseAuthorization()

        // 5. Push Notifications (For job alerts and incoming call notifications)
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }
        }
    }
}

// MARK: - Main ContentView
struct ContentView: View {
    @StateObject private var webViewModel = WebViewModel()

    var body: some View {
        ZStack {
            // Clean white background matching the Android load-up theme
            Color.white
                .ignoresSafeArea()

            // Full-screen WebView respecting top safe area (pulled below Dynamic Island / status bar)
            // while flowing completely edge-to-edge at the bottom
            WebView(viewModel: webViewModel)
                .ignoresSafeArea(.all, edges: .bottom)

            // Official Android-style load-up splash screen with the authentic NEED logo
            if webViewModel.isLoading && !webViewModel.hasLoadedOnce {
                AndroidStyleSplashScreen()
                    .transition(.opacity)
                    .zIndex(1)
            }

            // High-contrast Error Screen
            if webViewModel.showError {
                ErrorView(
                    errorMessage: webViewModel.errorMessage,
                    retryAction: {
                        webViewModel.reload()
                    }
                )
                .transition(.opacity)
                .zIndex(2)
            }
        }
        .preferredColorScheme(.light)
        .animation(.easeInOut(duration: 0.3), value: webViewModel.isLoading)
        .animation(.easeInOut(duration: 0.3), value: webViewModel.showError)
        .onAppear {
            PermissionManager.shared.requestAllPermissions()
        }
    }
}

// MARK: - Official NEED Android-Style Load-Up Screen
struct AndroidStyleSplashScreen: View {
    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack {
                if let logo = loadNeedLogo() {
                    Image(uiImage: logo)
                        .resizable()
                        .aspectRatio(contentMode: .fit)
                        .frame(width: 150, height: 150)
                }
            }
        }
    }

    private func loadNeedLogo() -> UIImage? {
        // 1. Try bundle path directly
        let bundlePath = Bundle.main.bundleURL.appendingPathComponent("AppIcon.png").path
        if FileManager.default.fileExists(atPath: bundlePath),
           let img = UIImage(contentsOfFile: bundlePath) {
            return img
        }

        // 2. Try standard UIImage(named:)
        if let img = UIImage(named: "AppIcon") {
            return img
        }

        // 3. Infallible embedded base64 fallback of the official Need logo
        if let data = Data(base64Encoded: needLogoBase64),
           let img = UIImage(data: data) {
            return img
        }

        return nil
    }
}

// MARK: - Error View
struct ErrorView: View {
    let errorMessage: String
    let retryAction: () -> Void

    var body: some View {
        ZStack {
            Color.white
                .ignoresSafeArea()

            VStack(spacing: 20) {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.exclamationmark")
                        .font(.system(size: 44, weight: .bold))
                        .foregroundColor(.black)

                    Text("CONNECTION ERROR")
                        .font(.system(size: 20, weight: .black))
                        .tracking(1)
                        .foregroundColor(.black)

                    Text(errorMessage.isEmpty ? "Unable to load NEED marketplace. Please check your internet connection." : errorMessage)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(Color.black.opacity(0.75))
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 16)

                    Button(action: retryAction) {
                        Text("TRY AGAIN")
                            .font(.system(size: 14, weight: .heavy))
                            .tracking(1.5)
                            .foregroundColor(.black)
                            .padding(.horizontal, 28)
                            .padding(.vertical, 12)
                            .background(Color(red: 1.0, green: 0.843, blue: 0.0))
                            .overlay(Rectangle().stroke(Color.black, lineWidth: 3))
                            .background(Rectangle().fill(Color.black).offset(x: 4, y: 4))
                    }
                    .padding(.top, 8)
                }
                .padding(28)
                .background(Color.white)
                .overlay(Rectangle().stroke(Color.black, lineWidth: 4))
                .background(Rectangle().fill(Color.black).offset(x: 8, y: 8))
            }
            .padding(24)
        }
    }
}

// MARK: - WebViewModel
@MainActor
final class WebViewModel: ObservableObject {
    @Published var isLoading: Bool = true
    @Published var hasLoadedOnce: Bool = false
    @Published var showError: Bool = false
    @Published var errorMessage: String = ""
    weak var webView: WKWebView?

    func reload() {
        showError = false
        isLoading = true
        errorMessage = ""
        if let url = URL(string: "https://need-chi.vercel.app") {
            var request = URLRequest(url: url)
            request.cachePolicy = .useProtocolCachePolicy
            request.timeoutInterval = 30.0
            webView?.load(request)
        }
    }
}

// MARK: - WebView Representable
struct WebView: UIViewRepresentable {
    @ObservedObject var viewModel: WebViewModel

    func makeCoordinator() -> Coordinator {
        Coordinator(viewModel: viewModel)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.preferences.javaScriptCanOpenWindowsAutomatically = true
        config.websiteDataStore = WKWebsiteDataStore.default()

        let contentController = WKUserContentController()
        contentController.add(context.coordinator, name: "needNative")
        config.userContentController = contentController

        if #available(iOS 14.0, *) {
            config.defaultWebpagePreferences.allowsContentJavaScript = true
        }

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.bounces = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = true
        webView.backgroundColor = UIColor.white
        webView.scrollView.backgroundColor = UIColor.white

        // Native pull-to-refresh
        let refreshControl = UIRefreshControl()
        refreshControl.addTarget(context.coordinator, action: #selector(Coordinator.handleRefreshControl(_:)), for: .valueChanged)
        webView.scrollView.refreshControl = refreshControl

        // Canonical Mobile Safari User-Agent so Google OAuth and third-party auth providers allow sign-in without 403 disallowed_useragent
        let baseUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        webView.customUserAgent = baseUA

        viewModel.webView = webView

        if let url = URL(string: "https://need-chi.vercel.app") {
            var request = URLRequest(url: url)
            request.cachePolicy = .useProtocolCachePolicy
            request.timeoutInterval = 30.0
            webView.load(request)
        }

        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var viewModel: WebViewModel

        init(viewModel: WebViewModel) {
            self.viewModel = viewModel
        }

        // MARK: - Native Pull to Refresh
        @objc func handleRefreshControl(_ sender: UIRefreshControl) {
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            generator.impactOccurred()
            if let webView = viewModel.webView {
                webView.reload()
            } else {
                sender.endRefreshing()
            }
        }

        // MARK: - WKScriptMessageHandler (Bridge for CallKit, Earpiece & Dynamic Island)
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "needNative", let dict = message.body as? [String: Any] else { return }
            let action = dict["action"] as? String ?? ""

            if action == "startCall" {
                let partnerName = dict["partnerName"] as? String ?? "Technician"
                let isVideo = dict["isVideo"] as? Bool ?? false
                NativeCallKitManager.shared.startCall(partnerName: partnerName, isVideo: isVideo)
            } else if action == "endCall" {
                NativeCallKitManager.shared.endCall()
            } else if action == "setAudioMode" {
                let mode = dict["mode"] as? String ?? "earpiece"
                NativeCallKitManager.shared.setAudioMode(mode: mode)
            }
        }

        // MARK: - WKUIDelegate: Media Capture Permissions (Mic & Camera for Calls)
        @available(iOS 15.0, *)
        func webView(
            _ webView: WKWebView,
            requestMediaCapturePermissionFor origin: WKSecurityOrigin,
            initiatedByFrame frame: WKFrameInfo,
            type: WKMediaCaptureType,
            decisionHandler: @escaping @MainActor (WKPermissionDecision) -> Void
        ) {
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

        // MARK: - WKNavigationDelegate
        func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
            if !viewModel.hasLoadedOnce {
                viewModel.isLoading = true
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            webView.scrollView.refreshControl?.endRefreshing()
            viewModel.isLoading = false
            viewModel.hasLoadedOnce = true
            viewModel.showError = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled {
                return
            }
            viewModel.isLoading = false
            if !viewModel.hasLoadedOnce {
                viewModel.errorMessage = error.localizedDescription
                viewModel.showError = true
            }
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            webView.scrollView.refreshControl?.endRefreshing()
            let nsError = error as NSError
            if nsError.code == NSURLErrorCancelled {
                return
            }
            viewModel.isLoading = false
            if !viewModel.hasLoadedOnce {
                viewModel.errorMessage = error.localizedDescription
                viewModel.showError = true
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if let scheme = url.scheme, ["tel", "mailto", "sms"].contains(scheme.lowercased()) {
                if UIApplication.shared.canOpenURL(url) {
                    UIApplication.shared.open(url)
                    decisionHandler(.cancel)
                    return
                }
            }

            decisionHandler(.allow)
        }
    }
}

// Infallible embedded base64 of the official NEED logo
private let needLogoBase64 = "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"
