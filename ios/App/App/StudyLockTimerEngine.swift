import Foundation
import ActivityKit

@MainActor final class StudyLockTimerEngine {
    static let shared = StudyLockTimerEngine()
    nonisolated static let changed = Notification.Name("GSATLockTimerChanged")
    private struct Journal: Codable { var current: LockTimerPayload?; var pending: [String: LockTimerPayload] = [:] }
    private var presentation: Task<Void, Never>?
    private var presentationError = false
    private func fileURL() throws -> URL {
        let directory = try FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        return directory.appendingPathComponent("gsat-lock-timer.json")
    }
    private func read() throws -> Journal {
        let url = try fileURL()
        if !FileManager.default.fileExists(atPath: url.path) { return Journal() }
        return try JSONDecoder().decode(Journal.self, from: Data(contentsOf: url))
    }
    private func save(_ journal: Journal) throws {
        try JSONEncoder().encode(journal).write(to: fileURL(), options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
    }
    private func object<T: Encodable>(_ value: T) throws -> Any { try JSONSerialization.jsonObject(with: JSONEncoder().encode(value)) }
    func envelope(applied: Bool = true) throws -> [String: Any] {
        let journal = try read()
        var pending = Array(journal.pending.values)
        if let current = journal.current, current.pending { pending.append(current) }
        let allowed = ActivityAuthorizationInfo().areActivitiesEnabled && !presentationError
        return ["current": try journal.current.map { try object($0) } ?? NSNull(), "pending": try object(pending),
                "applied": applied, "available": allowed, "reason": allowed ? "" : "activities-disabled"]
    }
    private func matches(_ current: LockTimerPayload?, _ id: String, _ revision: Int) -> Bool {
        if let current { return current.id == id && current.revision == revision }
        return id.isEmpty && revision == 0
    }
    func publish(_ session: LockTimerPayload, expectedId: String, expectedRevision: Int) async throws -> [String: Any] {
        try session.validate(); var journal = try read()
        guard matches(journal.current, expectedId, expectedRevision) else { return try envelope(applied: false) }
        if let previous = journal.current, previous.pending {
            guard previous.id != session.id else { return try envelope(applied: false) }
            journal.pending[previous.id] = previous
        }
        var saved = session
        saved.revision = (journal.current?.revision ?? 0) + 1; saved.acknowledgedRevision = saved.revision
        saved.baseAccumulatedSeconds = saved.accumulatedSeconds; saved.baseStartedAt = saved.startedAt
        journal.current = saved; try save(journal)
        await refreshPresentation(allowStart: true); return try envelope()
    }
    func acknowledge(id: String, revision: Int, seconds: Int, startedAt: Double?, discard: Bool) throws -> [String: Any] {
        var journal = try read()
        guard var state = journal.current?.id == id ? journal.current : journal.pending[id] else { return try envelope() }
        guard revision >= (state.acknowledgedRevision ?? 0), revision <= state.revision, !discard || revision == state.revision else { return try envelope(applied: false) }
        state.baseAccumulatedSeconds = discard ? state.accumulatedSeconds : seconds
        state.baseStartedAt = discard ? state.startedAt : startedAt; state.acknowledgedRevision = revision
        try state.validate()
        if journal.current?.id == id { journal.current = state }
        else if state.pending { journal.pending[id] = state } else { journal.pending.removeValue(forKey: id) }
        try save(journal); return try envelope()
    }
    func clear(id: String, revision: Int, preserve: Bool) async throws -> [String: Any] {
        var journal = try read()
        guard matches(journal.current, id, revision) else { return try envelope(applied: false) }
        if preserve, let current = journal.current, current.pending { journal.pending[id] = current }
        if !preserve { journal.pending.removeValue(forKey: id) }
        journal.current = nil; try save(journal)
        await refreshPresentation(allowStart: false); return try envelope()
    }
    func change(id: String, revision: Int, running: Bool) async throws {
        var journal = try read()
        guard var current = journal.current, matches(current, id, revision), (current.startedAt != nil) != running else { return }
        let now = Date().timeIntervalSince1970 * 1000
        if running { current.startedAt = now }
        else {
            current.accumulatedSeconds += max(0, Int((now - (current.startedAt ?? now)) / 1000)); current.startedAt = nil
        }
        current.revision += 1; journal.current = current; try save(journal)
        await refreshPresentation(allowStart: false)
        NotificationCenter.default.post(name: Self.changed, object: nil)
    }
    func handle(_ url: URL) -> Bool {
        guard url.scheme == "gsattracker", url.host == "timer", url.path == "/control",
              let values = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems else { return false }
        let value = { (name: String) in values.first { $0.name == name }?.value }
        guard let id = value("sessionId"), let revision = value("revision").flatMap(Int.init), let running = value("running"), ["true", "false"].contains(running) else { return false }
        Task { try? await change(id: id, revision: revision, running: running == "true") }; return true
    }
    private func refreshPresentation(allowStart: Bool) async {
        let previous = presentation
        let task = Task { @MainActor in await previous?.value; await self.present(allowStart: allowStart) }
        presentation = task; await task.value
    }
    private func present(allowStart: Bool) async {
        guard let journal = try? read() else { presentationError = true; return }
        for activity in Activity<StudyTimerAttributes>.activities where activity.attributes.sessionId != journal.current?.id {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        guard let current = journal.current else { presentationError = false; return }
        let content = ActivityContent(state: current.content, staleDate: nil)
        if let activity = Activity<StudyTimerAttributes>.activities.first(where: { $0.attributes.sessionId == current.id && ($0.activityState == .active || $0.activityState == .stale) }) {
            await activity.update(content); presentationError = false
        } else if allowStart {
            do { _ = try Activity.request(attributes: StudyTimerAttributes(sessionId: current.id), content: content, pushType: nil); presentationError = false }
            catch { presentationError = true }
        }
    }
}
