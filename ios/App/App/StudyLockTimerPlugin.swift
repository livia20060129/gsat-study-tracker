import Foundation
import Capacitor

@objc(StudyLockTimerPlugin)
public class StudyLockTimerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StudyLockTimerPlugin"
    public let jsName = "StudyLockTimer"
    public let pluginMethods: [CAPPluginMethod] = ["getState", "publish", "acknowledge", "clear"].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }
    private var observer: NSObjectProtocol?
    public override func load() {
        observer = NotificationCenter.default.addObserver(forName: StudyLockTimerEngine.changed, object: nil, queue: .main) { [weak self] _ in self?.notifyListeners("timerChanged", data: [:]) }
    }
    deinit { if let observer { NotificationCenter.default.removeObserver(observer) } }
    @objc func getState(_ call: CAPPluginCall) { Task { @MainActor in do { call.resolve(try StudyLockTimerEngine.shared.envelope()) } catch { call.reject("無法讀取裝置計時") } } }
    @objc func publish(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                guard let session = call.getObject("session") else { throw LockTimerError.invalid }
                let payload = try JSONDecoder().decode(LockTimerPayload.self, from: JSONSerialization.data(withJSONObject: session))
                call.resolve(try await StudyLockTimerEngine.shared.publish(payload, expectedId: call.getString("expectedId") ?? "", expectedRevision: call.getInt("expectedRevision") ?? 0))
            } catch { call.reject("無法保存鎖定畫面計時") }
        }
    }
    @objc func acknowledge(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try StudyLockTimerEngine.shared.acknowledge(id: call.getString("id") ?? "", revision: call.getInt("revision") ?? -1,
                seconds: call.getInt("accumulatedSeconds") ?? 0, startedAt: call.getDouble("startedAt"), discard: call.getBool("discard") ?? false)) }
            catch { call.reject("計時尚未確認") }
        }
    }
    @objc func clear(_ call: CAPPluginCall) {
        Task { @MainActor in
            do { call.resolve(try await StudyLockTimerEngine.shared.clear(id: call.getString("id") ?? "", revision: call.getInt("revision") ?? -1, preserve: call.getBool("preserve") ?? false)) }
            catch { call.reject("無法結束鎖定畫面計時") }
        }
    }
}
