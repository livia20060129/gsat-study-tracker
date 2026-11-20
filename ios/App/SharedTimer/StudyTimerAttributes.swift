import Foundation
import ActivityKit

struct StudyTimerAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var title: String
        var accumulatedSeconds: Int
        var startedAt: Double?
        var revision: Int
    }
    var sessionId: String
}

struct LockTimerPayload: Codable {
    var id: String; var scope: String; var date: String; var itemId: String; var entryId: String?
    var title: String; var revision: Int
    var accumulatedSeconds: Int; var startedAt: Double?
    var baseAccumulatedSeconds: Int; var baseStartedAt: Double?
    var acknowledgedRevision: Int?
    var pending: Bool { accumulatedSeconds != baseAccumulatedSeconds || startedAt != baseStartedAt }
    var content: StudyTimerAttributes.ContentState {
        .init(title: title, accumulatedSeconds: accumulatedSeconds, startedAt: startedAt, revision: revision)
    }
    func validate() throws {
        guard id.range(of: "^[A-Za-z0-9-]{1,80}$", options: .regularExpression) != nil,
              scope.range(of: "^study-v11:(guest|user:[^:]+):$", options: .regularExpression) != nil,
              date.range(of: "^\\d{4}-\\d{2}-\\d{2}$", options: .regularExpression) != nil,
              !itemId.isEmpty, accumulatedSeconds >= 0, baseAccumulatedSeconds >= 0,
              startedAt == nil || (startedAt!.isFinite && startedAt! > 0),
              baseStartedAt == nil || (baseStartedAt!.isFinite && baseStartedAt! > 0) else { throw LockTimerError.invalid }
    }
}
enum LockTimerError: Error { case invalid }
