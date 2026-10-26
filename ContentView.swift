import SwiftUI
import WebKit
import AVFoundation
import CoreLocation
import Photos
import UserNotifications
import CallKit

// MARK: - Native Notification Delegate (Foreground banners & action button handling)
@MainActor
final class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    // Show banners even when app is open in foreground
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        if #available(iOS 14.0, *) {
            completionHandler([.banner, .sound, .badge])
        } else {
            completionHandler([.alert, .sound, .badge])
        }
    }

    // Handle user tapping Answer or Decline buttons on persistent notifications
    nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let actionId = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo
        let reqId = (userInfo["requestId"] as? String) ?? (userInfo["jobId"] as? String)
        let isCall = (userInfo["action"] as? String) == "incoming_call"

        Task { @MainActor in
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            if actionId == "ANSWER_ACTION" {
                if let reqId = reqId, !reqId.isEmpty {
                    NativeCallKitManager.shared.currentJobId = reqId
                }
                NativeCallKitManager.shared.onNativeAnswerRequested()
            } else if actionId == "DECLINE_ACTION" {
                if let reqId = reqId, !reqId.isEmpty {
                    NativeCallKitManager.shared.currentJobId = reqId
                }
                NativeCallKitManager.shared.onNativeEndRequested()
            } else if actionId == UNNotificationDefaultActionIdentifier {
                if let reqId = reqId, !reqId.isEmpty {
                    if isCall {
                        NativeCallKitManager.shared.currentJobId = reqId
                    }
                    if let url = URL(string: "https://need-chi.vercel.app/chat/\(reqId)") {
                        WebViewModel.shared.webView?.load(URLRequest(url: url))
                    }
                }
            }
        }
        completionHandler()
    }
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
        print("[WebKit] Media capture permission granted for type: \(type.rawValue)")
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
}


// MARK: - Silent Background Audio Gateway
// Keeps iOS process and network pipeline alive 24/7 in background without interrupting other audio
@MainActor
final class SilentAudioGateway: NSObject, AVAudioPlayerDelegate {
    static let shared = SilentAudioGateway()
    private var audioPlayer: AVAudioPlayer?
    private var isRunning: Bool = false

    override init() {
        super.init()
        setupAudioPlayer()
        setupNotificationObservers()
    }

    private func setupAudioPlayer() {
        let sampleRate: Int32 = 8000
        let numChannels: Int16 = 1
        let bitsPerSample: Int16 = 16
        let durationSeconds: Int = 3
        let byteRate = sampleRate * Int32(numChannels) * Int32(bitsPerSample / 8)
        let blockAlign = numChannels * (bitsPerSample / 8)
        let dataSize = byteRate * Int32(durationSeconds)
        let chunkSize = 36 + dataSize

        var wavData = Data()
        // RIFF header
        wavData.append(contentsOf: [0x52, 0x49, 0x46, 0x46]) // "RIFF"
        var cSize = chunkSize.littleEndian
        wavData.append(Data(bytes: &cSize, count: 4))
        wavData.append(contentsOf: [0x57, 0x41, 0x56, 0x45]) // "WAVE"

        // "fmt " chunk
        wavData.append(contentsOf: [0x66, 0x6D, 0x74, 0x20]) // "fmt "
        var subchunk1Size: Int32 = Int32(16).littleEndian
        wavData.append(Data(bytes: &subchunk1Size, count: 4))
        var audioFormat: Int16 = Int16(1).littleEndian // PCM
        wavData.append(Data(bytes: &audioFormat, count: 2))
        var channels = numChannels.littleEndian
        wavData.append(Data(bytes: &channels, count: 2))
        var sRate = sampleRate.littleEndian
        wavData.append(Data(bytes: &sRate, count: 4))
        var bRate = byteRate.littleEndian
        wavData.append(Data(bytes: &bRate, count: 4))
        var bAlign = blockAlign.littleEndian
        wavData.append(Data(bytes: &bAlign, count: 2))
        var bps = bitsPerSample.littleEndian
        wavData.append(Data(bytes: &bps, count: 2))

        // "data" chunk
        wavData.append(contentsOf: [0x64, 0x61, 0x74, 0x61]) // "data"
        var dSize = dataSize.littleEndian
        wavData.append(Data(bytes: &dSize, count: 4))

        // Microscopic digital dither (+1 / -1 PCM samples).
        // Amplitude is 1/32768 (-90 dB). Combined with volume 0.001, output is -150 dB (imperceptible),
        // but CoreAudio hardware clock and mediaserverd maintain the active render thread.
        let totalSamples = Int(sampleRate) * durationSeconds
        for i in 0..<totalSamples {
            var sample: Int16 = (i % 2 == 0) ? Int16(1).littleEndian : Int16(-1).littleEndian
            wavData.append(Data(bytes: &sample, count: 2))
        }

        do {
            let player = try AVAudioPlayer(data: wavData)
            player.numberOfLoops = -1 // Infinite loop
            player.volume = 0.001 // Microscopic volume to keep hardware pipeline active
            player.delegate = self
            player.prepareToPlay()
            self.audioPlayer = player
        } catch {
            print("[SilentGateway] Failed to create silent audio player:", error)
        }
    }

    private func setupNotificationObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleInterruption(_:)),
            name: AVAudioSession.interruptionNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRouteChange(_:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppLifecycle(_:)),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAppLifecycle(_:)),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )
    }

    @objc private func handleInterruption(_ notification: Notification) {
        guard let userInfo = notification.userInfo,
              let typeValue = userInfo[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }

        if type == .ended {
            print("[SilentGateway] Audio interruption ended, resuming keepalive")
            resumeAfterCall()
        }
    }

    @objc private func handleRouteChange(_ notification: Notification) {
        if NativeCallKitManager.shared.activeCallUUID != nil || NativeCallKitManager.shared.isCallConnected {
            print("[SilentGateway] Route changed during call, preserving call audio")
            return
        }
        ensureActive()
    }

    @objc private func handleAppLifecycle(_ notification: Notification) {
        if NativeCallKitManager.shared.activeCallUUID != nil || NativeCallKitManager.shared.isCallConnected {
            return
        }
        ensureActive()
    }

    func start() {
        ensureActive()
    }

    func ensureActive() {
        if NativeCallKitManager.shared.activeCallUUID != nil || NativeCallKitManager.shared.isCallConnected {
            print("[SilentGateway] Call active, skipping keepalive audio activation")
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
            try session.setActive(true)
            if audioPlayer?.isPlaying != true {
                audioPlayer?.play()
                isRunning = true
                print("[SilentGateway] Silent background keepalive active (mixWithOthers, volume=0.001)")
            }
        } catch {
            print("[SilentGateway] Failed to activate audio session:", error)
        }
    }

    func pauseForCall() {
        audioPlayer?.pause()
        isRunning = false
        print("[SilentGateway] Paused for active CallKit call")
    }

    func resumeAfterCall() {
        ensureActive()
    }
}

// MARK: - Native Background Sync Gateway
// Continuous HTTP polling loop that detects incoming calls & unread notifications 24/7 in background
final class BackgroundSyncGateway: @unchecked Sendable {
    static let shared = BackgroundSyncGateway()
    private var currentUserId: String?
    private var lastReportedCallId: String?
    private var lastNotificationPollTime: Double
    private var presentedNotificationIds = Set<String>()
    private var isMonitoring: Bool = false
    private let urlSession: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 4.0
        config.timeoutIntervalForResource = 6.0
        config.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        self.urlSession = URLSession(configuration: config)

        self.lastNotificationPollTime = (Date().timeIntervalSince1970 * 1000) - 60000

        if let savedUid = UserDefaults.standard.string(forKey: "need_current_user_id"), !savedUid.isEmpty {
            self.currentUserId = savedUid
        }
    }

    func setUserId(_ uid: String?) {
        self.currentUserId = uid
        if let uid = uid, !uid.isEmpty {
            UserDefaults.standard.set(uid, forKey: "need_current_user_id")
            print("[SyncGateway] User ID registered: \(uid)")
        } else {
            UserDefaults.standard.removeObject(forKey: "need_current_user_id")
        }
        startMonitoring()
    }

    func startMonitoring() {
        guard !isMonitoring else { return }
        isMonitoring = true

        Task.detached(priority: .background) { [weak self] in
            while true {
                await self?.pollServer()
                try? await Task.sleep(nanoseconds: 5_000_000_000) // Poll every 1.6 seconds
            }
        }
    }

    private func pollServer() async {
        guard let uid = currentUserId, !uid.isEmpty else { return }
        let sinceMs = Int(lastNotificationPollTime)
        guard let url = URL(string: "https://need-chi.vercel.app/api/notifications/poll?uid=\(uid)&since=\(sinceMs)") else { return }

        do {
            let (data, response) = try await urlSession.data(from: url)
            guard let httpRes = response as? HTTPURLResponse, httpRes.statusCode == 200 else { return }
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { return }

            if let serverTime = json["serverTime"] as? Double {
                self.lastNotificationPollTime = serverTime
            } else if let serverTime = json["serverTime"] as? Int {
                self.lastNotificationPollTime = Double(serverTime)
            }

            // 1. Process Incoming Call
            var hasCall = false
            var isOngoing = false
            var callId: String? = nil
            var jobId: String? = nil
            var callerName: String = "Customer"
            var isVideo = false
            var callerId: String? = nil

            if let callDict = json["call"] as? [String: Any] {
                hasCall = callDict["hasCall"] as? Bool ?? false
                isOngoing = callDict["isOngoing"] as? Bool ?? false
                if hasCall {
                    callId = callDict["callId"] as? String
                    jobId = callDict["jobId"] as? String
                    callerName = (callDict["callerName"] as? String) ?? "Customer"
                    isVideo = callDict["isVideo"] as? Bool ?? false
                    callerId = callDict["callerId"] as? String
                }
            }

            await MainActor.run {
                if hasCall {
                    if UIApplication.shared.applicationState == .active {
                        print("[SyncGateway] App in foreground, letting in-app modal ring without CallKit/local push")
                        return
                    }
                    if callId != self.lastReportedCallId {
                        self.lastReportedCallId = callId
                        print("[SyncGateway] New ringing call detected in background for job \(jobId ?? "") from \(callerName)")
                        SilentAudioGateway.shared.pauseForCall()

                        // 1. Report to CallKit
                        NativeCallKitManager.shared.reportIncomingCall(
                            partnerName: callerName,
                            isVideo: isVideo,
                            jobId: jobId,
                            uid: callerId
                        )

                        // 2. Schedule local notification (guarantees lock screen banner with Answer/Decline buttons)
                        let callContent = UNMutableNotificationContent()
                        callContent.title = isVideo ? "Incoming Video Call" : "Incoming Voice Call"
                        callContent.body = "\(callerName) is calling you..."
                        callContent.sound = .default
                        callContent.categoryIdentifier = "INCOMING_CALL"
                        callContent.threadIdentifier = "need-incoming-call"
                        callContent.userInfo = [
                            "action": "incoming_call",
                            "jobId": jobId ?? "",
                            "requestId": jobId ?? "",
                            "callerName": callerName,
                            "isVideo": isVideo ? "true" : "false"
                        ]

                        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
                        let req = UNNotificationRequest(identifier: "call_\(callId ?? "incoming")", content: callContent, trigger: trigger)
                        UNUserNotificationCenter.current().add(req, withCompletionHandler: nil)
                    }
                } else if isOngoing || NativeCallKitManager.shared.isCallConnected {
                    // Call is active and ongoing! NEVER end it!
                    UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                } else {
                    // Only end if call was previously ringing and NOT yet connected
                    if NativeCallKitManager.shared.activeCallUUID != nil && self.lastReportedCallId != nil && !NativeCallKitManager.shared.isCallConnected {
                        print("[SyncGateway] Call was cancelled remotely before being answered, ending CallKit ringing")
                        NativeCallKitManager.shared.endCall()
                        self.lastReportedCallId = nil
                        SilentAudioGateway.shared.resumeAfterCall()
                        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                    }
                }
            }

            // 2. Process Notifications (Chat messages, job requests, counter offers)
            if let notifsList = json["notifications"] as? [[String: Any]] {
                for notif in notifsList {
                    guard let id = notif["id"] as? String else { continue }
                    if self.presentedNotificationIds.contains(id) { continue }
                    self.presentedNotificationIds.insert(id)

                    let title = (notif["title"] as? String) ?? "Need Notification"
                    let body = (notif["body"] as? String) ?? ""
                    var userInfo: [String: String] = [:]
                    if let dataDict = notif["data"] as? [String: Any] {
                        for (k, v) in dataDict {
                            userInfo[k] = String(describing: v)
                        }
                    }

                    print("[SyncGateway] New notification received: \(title) - \(body)")

                    let content = UNMutableNotificationContent()
                    content.title = title
                    content.body = body
                    content.sound = .default
                    content.userInfo = userInfo
                    content.badge = 1

                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: 0.1, repeats: false)
                    let request = UNNotificationRequest(identifier: id, content: content, trigger: trigger)

                    UNUserNotificationCenter.current().add(request) { error in
                        if let error = error {
                            print("[SyncGateway] Error scheduling local notification:", error)
                        } else {
                            print("[SyncGateway] Local notification successfully presented: \(id)")
                        }
                    }
                }
            }
        } catch {
            // Transient background connection glitch — ignore silently
        }
    }
}

// MARK: - Native CallKit & Dynamic Island Manager
@MainActor
final class NativeCallKitManager: NSObject, CXProviderDelegate {
    static let shared = NativeCallKitManager()

    let provider: CXProvider
    private let callController = CXCallController()
    private(set) var activeCallUUID: UUID?
    var isCallConnected: Bool = false

    weak var webView: WKWebView?
    var currentJobId: String?
    var currentCallerId: String?

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

        // Observe system audio route changes (speaker vs earpiece / bluetooth / headphones)
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleAudioRouteChange(notification:)),
            name: AVAudioSession.routeChangeNotification,
            object: nil
        )
    }

    @objc private func handleAudioRouteChange(notification: Notification) {
        guard let userInfo = notification.userInfo,
              let reasonValue = userInfo[AVAudioSessionRouteChangeReasonKey] as? UInt,
              let reason = AVAudioSession.RouteChangeReason(rawValue: reasonValue) else {
            return
        }

        // Only react to real hardware routing changes (Bluetooth connected/disconnected, headphones plugged/unplugged)
        // Never process internal app category or port overrides which causes an echo loop bouncing speaker back.
        guard reason == .newDeviceAvailable || reason == .oldDeviceUnavailable else {
            return
        }

        Task { @MainActor in
            let session = AVAudioSession.sharedInstance()
            let isSpeaker = session.currentRoute.outputs.contains { $0.portType == .builtInSpeaker }
            UIDevice.current.isProximityMonitoringEnabled = !isSpeaker && (self.activeCallUUID != nil)
            print("[CallKit] Physical audio route changed (reason=\(reason.rawValue)): isSpeaker=\(isSpeaker)")
            self.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('needNativeRouteChanged', { detail: { isSpeaker: \(isSpeaker) } }))", completionHandler: nil)
        }
    }

    func configureAudioSession(isSpeaker: Bool = true) {
        let session = AVAudioSession.sharedInstance()
        do {
            var options: AVAudioSession.CategoryOptions = [.allowBluetoothHFP, .allowBluetoothA2DP]
            if isSpeaker {
                options.insert(.defaultToSpeaker)
            }
            try session.setCategory(.playAndRecord, mode: .voiceChat, options: options)
            try session.setActive(true)
            if isSpeaker {
                try session.overrideOutputAudioPort(.speaker)
                UIDevice.current.isProximityMonitoringEnabled = false
            } else {
                try session.overrideOutputAudioPort(.none)
                UIDevice.current.isProximityMonitoringEnabled = true
            }
            print("[CallKit] Audio session route updated: isSpeaker=\(isSpeaker)")
        } catch {
            print("[CallKit] Error configuring audio session:", error)
        }
    }

    func activateCallAudio(isSpeaker: Bool = true) {
        self.isCallConnected = true
        SilentAudioGateway.shared.pauseForCall()
        configureAudioSession(isSpeaker: isSpeaker)
    }

    func answerActiveCall() {
        print("[CallKit] Answering active CallKit call from in-app overlay")
        self.isCallConnected = true
        SilentAudioGateway.shared.pauseForCall()
        configureAudioSession(isSpeaker: true)

        if let uuid = activeCallUUID {
            let answerAction = CXAnswerCallAction(call: uuid)
            let transaction = CXTransaction(action: answerAction)
            callController.request(transaction) { error in
                if let error = error {
                    print("[CallKit] Error requesting CXAnswerCallAction:", error)
                    self.provider.reportOutgoingCall(with: uuid, connectedAt: Date())
                } else {
                    print("[CallKit] CXAnswerCallAction successfully requested from in-app overlay")
                }
            }
        }
    }

    func reportIncomingCall(partnerName: String, isVideo: Bool, jobId: String? = nil, uid: String? = nil) {
        SilentAudioGateway.shared.pauseForCall()
        if UIApplication.shared.applicationState == .active {
            print("[CallKit] App is in foreground, suppressing CallKit UI for in-app ringing modal")
            return
        }
        self.currentJobId = jobId
        self.currentCallerId = uid
        self.isCallConnected = false

        let uuid = UUID()
        self.activeCallUUID = uuid

        let update = CXCallUpdate()
        update.remoteHandle = CXHandle(type: .generic, value: partnerName)
        update.localizedCallerName = partnerName
        update.hasVideo = isVideo
        update.supportsGrouping = false
        update.supportsUngrouping = false
        update.supportsHolding = false
        update.supportsDTMF = false

        print("[CallKit] Reporting incoming call for Dynamic Island / Banner: \(partnerName)")
        provider.reportNewIncomingCall(with: uuid, update: update) { error in
            if let error = error {
                print("[CallKit] Failed to report incoming call:", error)
            } else {
                print("[CallKit] Incoming call successfully presented on Dynamic Island / Lock Screen")
            }
        }
    }

    func startCall(partnerName: String, isVideo: Bool, jobId: String? = nil, uid: String? = nil) {
        if self.isCallConnected && self.activeCallUUID != nil {
            print("[CallKit] startCall skipped because call is already connected")
            return
        }
        self.currentJobId = jobId
        self.currentCallerId = uid
        self.isCallConnected = true
        SilentAudioGateway.shared.pauseForCall()

        let uuid = UUID()
        self.activeCallUUID = uuid
        let handle = CXHandle(type: .generic, value: partnerName)
        let startAction = CXStartCallAction(call: uuid, handle: handle)
        startAction.isVideo = isVideo

        let transaction = CXTransaction(action: startAction)
        callController.request(transaction) { error in
            if let error = error {
                print("[CallKit] CXStartCallAction transaction error:", error)
            } else {
                print("[CallKit] CXStartCallAction transaction requested")
            }
        }

        // Configure audio routing: default to loudspeaker
        activateCallAudio(isSpeaker: true)
    }

    func resetCallState() {
        self.activeCallUUID = nil
        self.currentJobId = nil
        self.currentCallerId = nil
        self.isCallConnected = false
        UIDevice.current.isProximityMonitoringEnabled = false
        SilentAudioGateway.shared.resumeAfterCall()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
    }

    func endCall() {
        print("[CallKit] Ending all CallKit calls")
        self.isCallConnected = false

        if let uuid = activeCallUUID {
            let endAction = CXEndCallAction(call: uuid)
            let transaction = CXTransaction(action: endAction)
            callController.request(transaction) { error in
                if error != nil {
                    self.provider.reportCall(with: uuid, endedAt: Date(), reason: .remoteEnded)
                }
            }
        }

        // Terminate any and all lingering calls in CallKit observer so Dynamic Island never sticks
        for call in callController.callObserver.calls {
            if !call.hasEnded {
                let endAction = CXEndCallAction(call: call.uuid)
                callController.request(CXTransaction(action: endAction)) { _ in }
                provider.reportCall(with: call.uuid, endedAt: Date(), reason: .remoteEnded)
            }
        }

        resetCallState()
        SilentAudioGateway.shared.resumeAfterCall()

        let session = AVAudioSession.sharedInstance()
        try? session.overrideOutputAudioPort(.none)
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }

    func onNativeAnswerRequested() {
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
        activateCallAudio(isSpeaker: true)

        let savedJobId = self.currentJobId
        print("[CallKit] Dynamic Island / CallKit Answer tapped for jobId: \(savedJobId ?? "")")

        // 1. Dispatch event to WKWebView so React updates state, dismisses incoming modal and mounts AgoraCallModal
        self.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('needNativeCallAnswer', { detail: { jobId: '\(savedJobId ?? "")' } }))") { _, error in
            if let error = error {
                print("[CallKit] Failed to dispatch needNativeCallAnswer:", error)
            }
        }

        // 2. Direct background HTTP POST to /api/calls/accept as an infallible fallback
        if let jobId = savedJobId, !jobId.isEmpty, let url = URL(string: "https://need-chi.vercel.app/api/calls/accept") {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload: [String: Any] = [
                "jobId": jobId,
                "requestId": jobId,
                "platform": "ios"
            ]
            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
            URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
        }
    }

    func onNativeEndRequested() {
        let savedJobId = self.currentJobId
        let savedCallerId = self.currentCallerId
        let wasConnected = self.isCallConnected

        // 1. Reset local state
        resetCallState()

        // 2. Dispatch event to webview
        let eventName = wasConnected ? "needNativeCallEnd" : "needNativeCallDecline"
        print("[CallKit] Dynamic Island / CallKit End/Decline tapped: \(eventName)")
        self.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(eventName)', { detail: { jobId: '\(savedJobId ?? "")' } }))") { _, error in
            if let error = error {
                print("[CallKit] Failed to dispatch \(eventName):", error)
            }
        }

        // 3. Fallback direct HTTP POST to server
        let endpoint = wasConnected ? "https://need-chi.vercel.app/api/calls/end" : "https://need-chi.vercel.app/api/calls/decline"
        if let jobId = savedJobId, !jobId.isEmpty, let url = URL(string: endpoint) {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let payload: [String: Any] = wasConnected ? [
                "jobId": jobId,
                "callerId": savedCallerId ?? "",
                "reason": "ended"
            ] : [
                "jobId": jobId,
                "requestId": jobId,
                "callerId": savedCallerId ?? "",
                "reason": "declined"
            ]
            request.httpBody = try? JSONSerialization.data(withJSONObject: payload)
            URLSession.shared.dataTask(with: request) { _, _, _ in }.resume()
        }

        // 4. Reset audio session
        let session = AVAudioSession.sharedInstance()
        try? session.overrideOutputAudioPort(.none)
        try? session.setActive(false, options: .notifyOthersOnDeactivation)
    }

    func setAudioMode(mode: String) {
        let isSpeaker = mode != "earpiece"
        activateCallAudio(isSpeaker: isSpeaker)
    }

    // MARK: - CXProviderDelegate
    nonisolated func providerDidReset(_ provider: CXProvider) {
        Task { @MainActor in
            NativeCallKitManager.shared.onNativeEndRequested()
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXStartCallAction) {
        let callUUID = action.callUUID
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.isCallConnected = true
            NativeCallKitManager.shared.configureAudioSession(isSpeaker: true)
            NativeCallKitManager.shared.provider.reportOutgoingCall(with: callUUID, connectedAt: Date())
            print("[CallKit] CXStartCallAction fulfilled successfully")
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.isCallConnected = true
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            NativeCallKitManager.shared.onNativeAnswerRequested()
            print("[CallKit] CXAnswerCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.isCallConnected = false
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            NativeCallKitManager.shared.onNativeEndRequested()
            print("[CallKit] CXEndCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }

    nonisolated func provider(_ provider: CXProvider, perform action: CXSetMutedCallAction) {
        let isMuted = action.isMuted
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('needNativeMuteToggle', { detail: { isMuted: \(isMuted) } }))", completionHandler: nil)
            print("[CallKit] CXSetMutedCallAction fulfilled from Dynamic Island: isMuted=\(isMuted)")
        }
    }

    nonisolated func provider(_ provider: CXProvider, didActivate audioSession: AVAudioSession) {
        Task { @MainActor in
            let session = audioSession
            do {
                try session.setCategory(.playAndRecord, mode: .voiceChat, options: [.allowBluetoothHFP, .allowBluetoothA2DP, .defaultToSpeaker])
                try session.setActive(true)
                try session.overrideOutputAudioPort(.speaker)
                print("[CallKit] Audio session activated by CallKit and configured for voiceChat")
            } catch {
                print("[CallKit] Error configuring audio session in didActivate:", error)
            }
        }
    }

    nonisolated func provider(_ provider: CXProvider, didDeactivate audioSession: AVAudioSession) {
        Task { @MainActor in
            print("[CallKit] Audio session deactivated by CallKit")
        }
    }
}

// MARK: - Native Permission Manager
@MainActor
final class PermissionManager: NSObject, CLLocationManagerDelegate {
    static let shared = PermissionManager()
    private let locationManager = CLLocationManager()
    private var onLocationDecision: (() -> Void)?

    override init() {
        super.init()
        locationManager.delegate = self
    }

    func requestAllPermissions() {
        print("[PermissionManager] requestAllPermissions() triggered explicitly from onboarding UI.")

        // Configure notification categories if not already done
        let answerAction = UNNotificationAction(
            identifier: "ANSWER_ACTION",
            title: "Answer",
            options: [.foreground]
        )
        let declineAction = UNNotificationAction(
            identifier: "DECLINE_ACTION",
            title: "Decline",
            options: [.destructive]
        )
        let callCategory = UNNotificationCategory(
            identifier: "INCOMING_CALL",
            actions: [answerAction, declineAction],
            intentIdentifiers: [],
            options: [.customDismissAction]
        )
        UNUserNotificationCenter.current().setNotificationCategories([callCategory])
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared

        // 1. Notification Permission
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .sound, .badge]
        ) { granted, _ in
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                }
            }

            // 2. Location Permission (Wait for user response before triggering next modal)
            DispatchQueue.main.async {
                self.requestLocationPermission {
                    // 3. Camera Permission
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) {
                        AVCaptureDevice.requestAccess(for: .video) { _ in
                            // 4. Microphone Permission
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                AVAudioSession.sharedInstance().requestRecordPermission { _ in
                                    // 5. Photos Library Permission
                                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                                        if #available(iOS 14, *) {
                                            PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
                                                print("[PermissionManager] Sequential permissions cycle complete.")
                                            }
                                        } else {
                                            PHPhotoLibrary.requestAuthorization { _ in
                                                print("[PermissionManager] Sequential permissions cycle complete.")
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    private func requestLocationPermission(completion: @escaping () -> Void) {
        let currentStatus: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            currentStatus = locationManager.authorizationStatus
        } else {
            currentStatus = CLLocationManager.authorizationStatus()
        }

        if currentStatus != .notDetermined {
            // Already determined, proceed immediately
            completion()
            return
        }

        self.onLocationDecision = completion
        locationManager.requestWhenInUseAuthorization()

        // Fallback safety timeout in case delegate doesn't fire
        DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { [weak self] in
            guard let self = self, let callback = self.onLocationDecision else { return }
            self.onLocationDecision = nil
            callback()
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status: CLAuthorizationStatus
        if #available(iOS 14.0, *) {
            status = manager.authorizationStatus
        } else {
            status = CLLocationManager.authorizationStatus()
        }
        if status != .notDetermined {
            let callback = onLocationDecision
            onLocationDecision = nil
            callback?()
        }
    }

    func locationManager(_ manager: CLLocationManager, didChangeAuthorization status: CLAuthorizationStatus) {
        if status != .notDetermined {
            let callback = onLocationDecision
            onLocationDecision = nil
            callback?()
        }
    }
}

// MARK: - Main ContentView
struct ContentView: View {
    @ObservedObject private var webViewModel = WebViewModel.shared

    var body: some View {
        ZStack {
            // Clean white background matching the Android load-up theme
            Color.white
                .ignoresSafeArea()

            // Full-screen WebView flowing completely edge-to-edge behind Dynamic Island and status bar
            WebView(viewModel: webViewModel)
                .ignoresSafeArea()

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
            SilentAudioGateway.shared.start()
            BackgroundSyncGateway.shared.startMonitoring()
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

// MARK: - Native App Delegate (APNs Push Token Handling)
@MainActor
final class AppDelegate: NSObject, UIApplicationDelegate {

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared

        // Ensure notification categories are configured for lock screen Answer/Decline actions
        let answerAction = UNNotificationAction(identifier: "ANSWER_ACTION", title: "Answer", options: [.foreground])
        let declineAction = UNNotificationAction(identifier: "DECLINE_ACTION", title: "Decline", options: [.destructive])
        let callCategory = UNNotificationCategory(identifier: "INCOMING_CALL", actions: [answerAction, declineAction], intentIdentifiers: [], options: [.customDismissAction])
        UNUserNotificationCenter.current().setNotificationCategories([callCategory])

        // Register for remote notifications ONLY if user previously authorized them
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }

        SilentAudioGateway.shared.ensureActive()
        BackgroundSyncGateway.shared.startMonitoring()
        return true
    }
    
    func applicationDidEnterBackground(_ application: UIApplication) {
        print("[AppDelegate] App entered background, ensuring SilentAudioGateway & BackgroundSyncGateway")
        SilentAudioGateway.shared.ensureActive()
        BackgroundSyncGateway.shared.startMonitoring()
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        print("[AppDelegate] App became active")
        application.registerForRemoteNotifications()
        SilentAudioGateway.shared.ensureActive()
        BackgroundSyncGateway.shared.startMonitoring()
    }

    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("[APNs] Registered native push device token: \(tokenString)")
        UserDefaults.standard.set(tokenString, forKey: "need_native_apns_token")
        WebViewModel.shared.apnsToken = tokenString
        WebViewModel.shared.bridgeDeviceToken(token: tokenString)

        if let uid = UserDefaults.standard.string(forKey: "need_current_user_id"), !uid.isEmpty {
            WebViewModel.shared.syncTokenToBackend(uid: uid, token: tokenString)
        }
    }

    func application(
        _ application: UIApplication,
        didFailToRegisterForRemoteNotificationsWithError error: Error
    ) {
        print("[APNs] Failed to register for remote notifications: \(error.localizedDescription)")
    }

    func application(
        _ application: UIApplication,
        didReceiveRemoteNotification userInfo: [AnyHashable: Any],
        fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
    ) {
        print("[APNs] Background notification received: \(userInfo)")
        let type = userInfo["type"] as? String
        if type == "call" {
            let callerName = (userInfo["callerName"] as? String) ?? (userInfo["title"] as? String) ?? "Caller"
            let isVideo = (userInfo["callType"] as? String) == "video"
            let jobId = (userInfo["jobId"] as? String) ?? (userInfo["requestId"] as? String)
            let uid = userInfo["uid"] as? String
            NativeCallKitManager.shared.reportIncomingCall(partnerName: callerName, isVideo: isVideo, jobId: jobId, uid: uid)
        } else if type == "cancel_call" {
            NativeCallKitManager.shared.endCall()
        }
        completionHandler(.newData)
    }
}

// MARK: - WebViewModel
@MainActor
final class WebViewModel: ObservableObject {
    func navigate(to path: String) {
        guard let webView = self.webView else { return }
        let cleanPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let js = "window.location.href = 'https://need-chi.vercel.app/\(cleanPath)';"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    static let shared = WebViewModel()
    @Published var isLoading: Bool = true
    @Published var hasLoadedOnce: Bool = false
    @Published var showError: Bool = false
    @Published var errorMessage: String = ""
    weak var webView: WKWebView?
    var apnsToken: String?

    func bridgeDeviceToken(token: String) {
        guard let webView = self.webView else { return }
        let js = "window.dispatchEvent(new CustomEvent('needNativePushToken', { detail: { token: '\(token)' } }));"
        webView.evaluateJavaScript(js, completionHandler: nil)
    }

    func syncTokenToBackend(uid: String, token: String) {
        guard let url = URL(string: "https://need-chi.vercel.app/api/notifications/register-token") else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        let payload: [String: Any] = ["uid": uid, "token": token]
        req.httpBody = try? JSONSerialization.data(withJSONObject: payload)
        URLSession.shared.dataTask(with: req) { _, res, err in
            if let http = res as? HTTPURLResponse, http.statusCode == 200 {
                print("[APNs] Token registered on backend for uid \(uid)")
            } else if let err = err {
                print("[APNs] Token register error:", err)
            }
        }.resume()
    }

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
        contentController.add(context.coordinator, name: "haptic")
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
        webView.isOpaque = false
        webView.backgroundColor = UIColor.clear
        webView.scrollView.backgroundColor = UIColor.clear

        // Canonical Mobile Safari User-Agent so Google OAuth and third-party auth providers allow sign-in without 403 disallowed_useragent
        let baseUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
        webView.customUserAgent = baseUA

        viewModel.webView = webView
        NativeCallKitManager.shared.webView = webView

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
    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
        var viewModel: WebViewModel

        init(viewModel: WebViewModel) {
            self.viewModel = viewModel
        }

        // MARK: - WKScriptMessageHandler (Bridge for CallKit, Haptics & Dynamic Island)
        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "haptic" {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
                return
            }

            guard message.name == "needNative", let dict = message.body as? [String: Any] else { return }
            let action = dict["action"] as? String ?? ""

            if action == "haptic" {
                let generator = UIImpactFeedbackGenerator(style: .medium)
                generator.prepare()
                generator.impactOccurred()
            } else if action == "reportIncomingCall" {
                let partnerName = dict["partnerName"] as? String ?? "Customer"
                let isVideo = dict["isVideo"] as? Bool ?? false
                let jobId = dict["jobId"] as? String
                let uid = dict["uid"] as? String
                NativeCallKitManager.shared.reportIncomingCall(partnerName: partnerName, isVideo: isVideo, jobId: jobId, uid: uid)
            } else if action == "startCall" {
                let partnerName = dict["partnerName"] as? String ?? "Technician"
                let isVideo = dict["isVideo"] as? Bool ?? false
                let jobId = dict["jobId"] as? String
                let uid = dict["uid"] as? String
                NativeCallKitManager.shared.startCall(partnerName: partnerName, isVideo: isVideo, jobId: jobId, uid: uid)
            } else if action == "answerCall" {
                NativeCallKitManager.shared.answerActiveCall()
            } else if action == "endCall" {
                NativeCallKitManager.shared.endCall()
                UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                UIApplication.shared.applicationIconBadgeNumber = 0
            } else if action == "clearDeliveredNotifications" {
                UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                UIApplication.shared.applicationIconBadgeNumber = 0
            } else if action == "setAudioMode" {
                let mode = dict["mode"] as? String ?? "speaker"
                NativeCallKitManager.shared.setAudioMode(mode: mode)
            } else if action == "setUserId" {
                let uid = dict["uid"] as? String
                BackgroundSyncGateway.shared.setUserId(uid)
                if let uid = uid, !uid.isEmpty, let token = WebViewModel.shared.apnsToken ?? UserDefaults.standard.string(forKey: "need_native_apns_token") {
                    WebViewModel.shared.syncTokenToBackend(uid: uid, token: token)
                }
            } else if action == "getPushToken" {
                let token = WebViewModel.shared.apnsToken ?? UserDefaults.standard.string(forKey: "need_native_apns_token")
                if let token = token {
                    WebViewModel.shared.bridgeDeviceToken(token: token)
                }
            } else if action == "requestAllPermissions" {
                PermissionManager.shared.requestAllPermissions()
            }
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
            let token = WebViewModel.shared.apnsToken ?? UserDefaults.standard.string(forKey: "need_native_apns_token")
            if let token = token {
                WebViewModel.shared.bridgeDeviceToken(token: token)
                if let uid = UserDefaults.standard.string(forKey: "need_current_user_id"), !uid.isEmpty {
                    WebViewModel.shared.syncTokenToBackend(uid: uid, token: token)
                }
            }
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
