import fs from 'fs';

const filePath = '/home/Charis/projects/Need/Sources/Need/ContentView.swift';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Update BackgroundSyncGateway call processing
const oldSyncCallBlock = `            var hasCall = false
            var callId: String? = nil
            var jobId: String? = nil
            var callerName: String = "Customer"
            var isVideo = false
            var callerId: String? = nil

            if let callDict = json["call"] as? [String: Any] {
                hasCall = callDict["hasCall"] as? Bool ?? false
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
                    if callId != self.lastReportedCallId {
                        self.lastReportedCallId = callId
                        print("[SyncGateway] New ringing call detected in background for job \\(jobId ?? \\"\\") from \\(callerName)")
                        SilentAudioGateway.shared.pauseForCall()
                        NativeCallKitManager.shared.reportIncomingCall(
                            partnerName: callerName,
                            isVideo: isVideo,
                            jobId: jobId,
                            uid: callerId
                        )
                    }
                } else {
                    if NativeCallKitManager.shared.activeCallUUID != nil && self.lastReportedCallId != nil {
                        print("[SyncGateway] Call was cancelled remotely, ending CallKit ringing")
                        NativeCallKitManager.shared.endCall()
                        self.lastReportedCallId = nil
                        SilentAudioGateway.shared.resumeAfterCall()
                    }
                }
            }`;

const newSyncCallBlock = `            var hasCall = false
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
                    if callId != self.lastReportedCallId {
                        self.lastReportedCallId = callId
                        print("[SyncGateway] New ringing call detected in background for job \\(jobId ?? \\"\\") from \\(callerName)")
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
                        callContent.body = "\\(callerName) is calling you..."
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
                        let req = UNNotificationRequest(identifier: "call_\\(callId ?? \\"incoming\\")", content: callContent, trigger: trigger)
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
            }`;

if (!content.includes(oldSyncCallBlock)) {
    console.error("Could not find oldSyncCallBlock!");
    process.exit(1);
}
content = content.replace(oldSyncCallBlock, newSyncCallBlock);

// 2. Update resetCallState
const oldReset = `    func resetCallState() {
        self.activeCallUUID = nil
        self.currentJobId = nil
        self.currentCallerId = nil
        self.isCallConnected = false
        UIDevice.current.isProximityMonitoringEnabled = false
        SilentAudioGateway.shared.resumeAfterCall()
    }`;

const newReset = `    func resetCallState() {
        self.activeCallUUID = nil
        self.currentJobId = nil
        self.currentCallerId = nil
        self.isCallConnected = false
        UIDevice.current.isProximityMonitoringEnabled = false
        SilentAudioGateway.shared.resumeAfterCall()
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
    }`;

if (!content.includes(oldReset)) {
    console.error("Could not find oldReset!");
    process.exit(1);
}
content = content.replace(oldReset, newReset);

// 3. Update onNativeAnswerRequested
const oldAnswer = `    func onNativeAnswerRequested() {
        self.isCallConnected = true
        configureAudioSession(isSpeaker: true)`;

const newAnswer = `    func onNativeAnswerRequested() {
        self.isCallConnected = true
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
        configureAudioSession(isSpeaker: true)`;

if (!content.includes(oldAnswer)) {
    console.error("Could not find oldAnswer!");
    process.exit(1);
}
content = content.replace(oldAnswer, newAnswer);

// 4. Update provider perform action: CXAnswerCallAction
const oldProviderAnswer = `    nonisolated func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.onNativeAnswerRequested()
            print("[CallKit] CXAnswerCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }`;

const newProviderAnswer = `    nonisolated func provider(_ provider: CXProvider, perform action: CXAnswerCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.isCallConnected = true
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            NativeCallKitManager.shared.onNativeAnswerRequested()
            print("[CallKit] CXAnswerCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }`;

if (!content.includes(oldProviderAnswer)) {
    console.error("Could not find oldProviderAnswer!");
    process.exit(1);
}
content = content.replace(oldProviderAnswer, newProviderAnswer);

// 5. Update provider perform action: CXEndCallAction
const oldProviderEnd = `    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.onNativeEndRequested()
            print("[CallKit] CXEndCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }`;

const newProviderEnd = `    nonisolated func provider(_ provider: CXProvider, perform action: CXEndCallAction) {
        action.fulfill()
        Task { @MainActor in
            NativeCallKitManager.shared.isCallConnected = false
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            UIApplication.shared.applicationIconBadgeNumber = 0
            NativeCallKitManager.shared.onNativeEndRequested()
            print("[CallKit] CXEndCallAction fulfilled successfully from Dynamic Island / CallKit")
        }
    }`;

if (!content.includes(oldProviderEnd)) {
    console.error("Could not find oldProviderEnd!");
    process.exit(1);
}
content = content.replace(oldProviderEnd, newProviderEnd);

// 6. Update userContentController to handle clearDeliveredNotifications
const oldEndCallCase = `            } else if action == "endCall" {
                NativeCallKitManager.shared.endCall()
            } else if action == "setAudioMode" {`;

const newEndCallCase = `            } else if action == "endCall" {
                NativeCallKitManager.shared.endCall()
                UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                UIApplication.shared.applicationIconBadgeNumber = 0
            } else if action == "clearDeliveredNotifications" {
                UNUserNotificationCenter.current().removeAllDeliveredNotifications()
                UIApplication.shared.applicationIconBadgeNumber = 0
            } else if action == "setAudioMode" {`;

if (!content.includes(oldEndCallCase)) {
    console.error("Could not find oldEndCallCase!");
    process.exit(1);
}
content = content.replace(oldEndCallCase, newEndCallCase);

// 7. Update NotificationDelegate didReceive to dismiss notifications and handle call taps
const oldNotifReceive = `        Task { @MainActor in
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
                    if let url = URL(string: "https://need-chi.vercel.app/chat/\\(reqId)") {
                        WebViewModel.shared.webView?.load(URLRequest(url: url))
                    }
                }
            }
        }`;

const newNotifReceive = `        Task { @MainActor in
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
                    let action = userInfo["action"] as? String
                    if action == "incoming_call" {
                        NativeCallKitManager.shared.currentJobId = reqId
                    }
                    if let url = URL(string: "https://need-chi.vercel.app/chat/\\(reqId)") {
                        WebViewModel.shared.webView?.load(URLRequest(url: url))
                    }
                }
            }
        }`;

if (!content.includes(oldNotifReceive)) {
    console.error("Could not find oldNotifReceive!");
    process.exit(1);
}
content = content.replace(oldNotifReceive, newNotifReceive);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Successfully patched ContentView.swift in WSL!");
