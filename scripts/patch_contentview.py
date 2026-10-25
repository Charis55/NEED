import sys

file_path = '/home/Charis/projects/Need/Sources/Need/ContentView.swift'
with open(file_path, 'r', encoding='utf8') as f:
    content = f.read()

old_notif_recv = r'''        let actionId = response.actionIdentifier
        let userInfo = response.notification.request.content.userInfo
        let reqId = (userInfo["requestId"] as? String) ?? (userInfo["jobId"] as? String)

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
                    let action = userInfo["action"] as? String
                    if action == "incoming_call" {
                        NativeCallKitManager.shared.currentJobId = reqId
                    }
                    if let url = URL(string: "https://need-chi.vercel.app/chat/\(reqId)") {
                        WebViewModel.shared.webView?.load(URLRequest(url: url))
                    }
                }
            }
        }'''

new_notif_recv = r'''        let actionId = response.actionIdentifier
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
        }'''

if old_notif_recv in content:
    content = content.replace(old_notif_recv, new_notif_recv)
    with open(file_path, 'w', encoding='utf8') as f:
        f.write(content)
    print("SUCCESS: NotificationDelegate fixed!")
else:
    print("WARNING: old_notif_recv not found, checking if already updated...")
    if new_notif_recv in content:
        print("Already updated!")
    else:
        sys.exit(1)
