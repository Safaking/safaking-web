// Turns a folder of photographs of a real safa into a 3D model.
//
// Apple's own photogrammetry, which is on every Apple Silicon Mac — no
// subscription, no upload, and the safa never leaves this computer. It writes
// an OBJ with its textures; scan.sh then converts that to the .glb the mirror
// loads.
//
// Built and run by tools/safa-scan/scan.sh — see docs/safa-3d-scanning.md.

import Foundation
import RealityKit

@available(macOS 12.0, *)
func detailLevel(_ name: String) -> PhotogrammetrySession.Request.Detail {
    switch name.lowercased() {
    case "preview": return .preview
    case "medium": return .medium
    case "full": return .full
    case "raw": return .raw
    default: return .reduced
    }
}

@available(macOS 12.0, *)
func run() async {
    let arguments = CommandLine.arguments
    guard arguments.count >= 3 else {
        print("usage: safa-scan <folder-of-photos> <output.obj or output.usdz> [preview|reduced|medium|full|raw]")
        exit(2)
    }

    let input = URL(fileURLWithPath: arguments[1], isDirectory: true)
    let output = URL(fileURLWithPath: arguments[2])
    let detail = detailLevel(arguments.count > 3 ? arguments[3] : "reduced")

    let photos = (try? FileManager.default.contentsOfDirectory(atPath: input.path))?
        .filter { ["jpg", "jpeg", "png", "heic"].contains(($0 as NSString).pathExtension.lowercased()) } ?? []
    guard photos.count >= 20 else {
        print("Found \(photos.count) photographs in \(input.path).")
        print("Photogrammetry needs at least 20, and works best with 50 to 80 taken all the way around.")
        exit(1)
    }
    print("Reading \(photos.count) photographs…")

    // An OBJ is written into a folder of its own; a .usdz is a single file.
    if output.pathExtension.lowercased() != "usdz" {
        try? FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
    } else {
        try? FileManager.default.createDirectory(
            at: output.deletingLastPathComponent(), withIntermediateDirectories: true)
    }

    do {
        var configuration = PhotogrammetrySession.Configuration()
        // The safa is the only thing that matters; the stand and the table are not.
        configuration.isObjectMaskingEnabled = true
        configuration.featureSensitivity = .high

        let session = try PhotogrammetrySession(input: input, configuration: configuration)
        try session.process(requests: [.modelFile(url: output, detail: detail)])

        for try await update in session.outputs {
            switch update {
            case .requestProgress(_, let fraction):
                let percent = Int(fraction * 100)
                if percent % 5 == 0 { print("  \(percent)%") }
            case .requestComplete:
                print("Done — \(output.path)")
            case .requestError(_, let error):
                print("Failed: \(error.localizedDescription)")
                exit(1)
            case .processingComplete:
                exit(0)
            case .invalidSample(let id, let reason):
                print("  skipped photo \(id): \(reason)")
            case .processingCancelled:
                exit(1)
            default:
                break
            }
        }
    } catch {
        print("Could not start: \(error.localizedDescription)")
        print("This needs an Apple Silicon Mac; on 8 GB use 'reduced' or 'preview' detail.")
        exit(1)
    }
}

if #available(macOS 12.0, *) {
    Task { await run() }
    RunLoop.main.run()
} else {
    print("Needs macOS 12 or newer.")
    exit(1)
}
