import Capacitor
class StudyBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(StudyLockTimerPlugin()) }
}
