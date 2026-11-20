import ActivityKit
import WidgetKit
import SwiftUI

private struct TimerDigits: View {
    var state: StudyTimerAttributes.ContentState
    var body: some View {
        Group {
            if let startedAt = state.startedAt {
                Text(timerInterval: Date(timeIntervalSince1970: startedAt / 1000 - Double(state.accumulatedSeconds))...Date.distantFuture, countsDown: false, showsHours: false)
            } else { Text(String(format: "%02d:%02d", state.accumulatedSeconds / 60, state.accumulatedSeconds % 60)) }
        }.monospacedDigit()
    }
}
private struct TimerControl: View {
    var context: ActivityViewContext<StudyTimerAttributes>
    private var running: Bool { context.state.startedAt != nil }
    var body: some View {
        if #available(iOS 17.0, *) {
            Button(intent: StudyTimerIntent(sessionId: context.attributes.sessionId, revision: context.state.revision, running: !running)) {
                Label(running ? "暫停" : "繼續", systemImage: running ? "pause.fill" : "play.fill")
            }.buttonStyle(.borderedProminent).tint(.blue)
        } else {
            Link(destination: URL(string: "gsattracker://timer/control?sessionId=\(context.attributes.sessionId)&revision=\(context.state.revision)&running=\(!running)")!) {
                Label(running ? "暫停" : "繼續", systemImage: running ? "pause.fill" : "play.fill")
            }.buttonStyle(.borderedProminent).tint(.blue)
        }
    }
}
struct StudyTimerWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: StudyTimerAttributes.self) { context in
            VStack(alignment: .leading, spacing: 10) {
                HStack { Label("GSAT Tracker", systemImage: "book"); Spacer(); Text(context.state.startedAt == nil ? "已暫停" : "計時中") }.font(.caption).foregroundStyle(.secondary)
                Text(context.state.title).font(.headline).lineLimit(2)
                HStack { TimerDigits(state: context.state).font(.system(size: 32, weight: .semibold)); Spacer(); TimerControl(context: context) }
            }.padding(16).activityBackgroundTint(Color(.systemBackground))
                .widgetURL(URL(string: "gsattracker://timer/open?sessionId=\(context.attributes.sessionId)"))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Image(systemName: "book") }
                DynamicIslandExpandedRegion(.trailing) { TimerDigits(state: context.state).frame(width: 100).font(.title3) }
                DynamicIslandExpandedRegion(.bottom) { HStack { Text(context.state.title).lineLimit(2); Spacer(); TimerControl(context: context) } }
            } compactLeading: { Image(systemName: context.state.startedAt == nil ? "pause.fill" : "timer") }
              compactTrailing: { TimerDigits(state: context.state).frame(width: 70).font(.caption) }
              minimal: { Image(systemName: context.state.startedAt == nil ? "pause.fill" : "timer") }
              .widgetURL(URL(string: "gsattracker://timer/open?sessionId=\(context.attributes.sessionId)"))
        }
    }
}
@main struct StudyTimerWidgetBundle: WidgetBundle { var body: some Widget { StudyTimerWidget() } }
