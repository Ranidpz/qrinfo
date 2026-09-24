import Foundation
func XCTAssertEqual<T: Equatable>(_ a: T, _ b: T) { precondition(a == b, "Unexpected workflow: \(a), expected \(b)") }
@main struct WorkflowTests {
    static func main() { let tests = WorkflowTests(); tests.testSetupAndVersionMismatchPrecedeOperations(); tests.testRecoveryFailureAndActivationAreDistinct(); print("Native workflow transitions passed") }
    func testSetupAndVersionMismatchPrecedeOperations() {
        var s = AgentSnapshot()
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: false, appVersion: "new"), .prepare)
        s.runnerVersion = "new"
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .importKey)
        s.connected = true
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .connect)
        s.state = "connected_needs_confirmation"
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .confirm)
        s.runnerVersion = "old"
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .prepare)
    }
    func testRecoveryFailureAndActivationAreDistinct() {
        var s = AgentSnapshot(); s.runnerVersion = "new"; s.connected = true; s.paired = true
        s.pending = true; s.previewReady = true
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .recover)
        s.pending = false; s.previewReady = false; s.lastError = "HISTORY_KNOWN_MESSAGES_MISSING"
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .preview)
        s.previewReady = true
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .activate)
        s.enabled = true
        XCTAssertEqual(AgentWorkflow.resolve(s, prepared: true, appVersion: "new"), .active)
    }
}
