import AppIntents

@available(iOS 17.0, *)
struct StudyTimerIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "暫停或繼續讀書計時"
    static var openAppWhenRun: Bool = false
    static var isDiscoverable: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .alwaysAllowed
    @Parameter(title: "計時識別碼") var sessionId: String
    @Parameter(title: "目前版本") var revision: Int
    @Parameter(title: "繼續計時") var running: Bool
    init() {}
    init(sessionId: String, revision: Int, running: Bool) { self.sessionId = sessionId; self.revision = revision; self.running = running }
    @MainActor func perform() async throws -> some IntentResult {
        // LiveActivityIntent executes in the app process, using the app target's implementation.
        #if !WIDGET_EXTENSION
        try await StudyLockTimerEngine.shared.change(id: sessionId, revision: revision, running: running)
        #endif
        return .result()
    }
}
