import { useEffect, useRef, useState, type MouseEvent } from "react";
import {
  Camera,
  Check,
  CircleHelp,
  Crosshair,
  FlipHorizontal,
  Ruler,
  Trash2,
  X,
} from "lucide-react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";

type Point = { x: number; y: number };
type Measurement = { id: number; label: string; mm: number; points: [Point, Point] };
type BodyMetric = { id: string; label: string };
type PosePoint = { x: number; y: number; visibility?: number };

const BODY_METRICS: BodyMetric[] = [
  { id: "shoulders", label: "Shoulder width" },
  { id: "hips", label: "Hip width" },
  { id: "arms", label: "Arm length (average)" },
  { id: "legs", label: "Leg length (average)" },
  { id: "height", label: "Estimated height" },
];

const POSE_LINES: Record<string, number[][]> = {
  shoulders: [[11, 12]],
  hips: [[23, 24]],
  arms: [[11, 13, 15], [12, 14, 16]],
  legs: [[23, 25, 27], [24, 26, 28]],
  height: [[0, 27], [0, 28]],
};

let openCvPromise: Promise<any> | null = null;

function loadOpenCv(): Promise<any> {
  if (openCvPromise) return openCvPromise;
  openCvPromise = new Promise((resolve, reject) => {
    const existing = (window as unknown as { cv?: any }).cv;
    if (existing?.Mat) {
      resolve(existing);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://docs.opencv.org/4.x/opencv.js";
    script.async = true;
    const timeout = window.setTimeout(() => reject(new Error("OpenCV.js took too long to load.")), 20_000);
    script.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error("OpenCV.js could not be loaded. You can still place the calibration points manually."));
    };
    script.onload = () => {
      const cv = (window as unknown as { cv?: any }).cv;
      if (cv?.Mat) {
        window.clearTimeout(timeout);
        resolve(cv);
      } else if (cv) {
        cv.onRuntimeInitialized = () => {
          window.clearTimeout(timeout);
          resolve(cv);
        };
      } else {
        window.clearTimeout(timeout);
        reject(new Error("OpenCV.js did not initialize."));
      }
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    openCvPromise = null;
    throw error;
  });
  return openCvPromise;
}

function distance(first: Point, second: Point, width: number, height: number) {
  return Math.hypot((first.x - second.x) * width, (first.y - second.y) * height);
}

export function WebcamMeasurePage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const landmarksRef = useRef<PosePoint[] | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectionRef = useRef(0);
  const nextIdRef = useRef(1);
  const facingRef = useRef<"user" | "environment">("user");
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [mode, setMode] = useState<"calibration" | "body" | "object">("body");
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mirror, setMirror] = useState(true);
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });
  const [reference, setReference] = useState("85.6");
  const [customWidth, setCustomWidth] = useState("100");
  const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
  const [pixelsPerMm, setPixelsPerMm] = useState<number | null>(null);
  const [metrics, setMetrics] = useState<string[]>(["shoulders", "hips", "arms", "legs", "height"]);
  const [liveMeasurements, setLiveMeasurements] = useState<Record<string, number>>({});
  const [visibilityWarning, setVisibilityWarning] = useState("");
  const [objectLabel, setObjectLabel] = useState("Measurement");
  const [objectPoints, setObjectPoints] = useState<Point[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [detectingEdges, setDetectingEdges] = useState(false);

  const referenceMm = reference === "custom" ? Number(customWidth) : Number(reference);
  const scaleReady = pixelsPerMm !== null && Number.isFinite(pixelsPerMm) && pixelsPerMm > 0;

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    landmarkerRef.current?.close();
  }, []);

  function stopCamera() {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setVisibilityWarning("");
    landmarksRef.current = null;
  }

  async function startCamera() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access requires HTTPS or localhost and a supported browser. Check your browser settings, or try a secure connection.");
      return;
    }
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingRef.current }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (!videoRef.current) throw new Error("The camera preview could not be opened.");
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const { videoWidth, videoHeight } = videoRef.current;
      setFrameSize({ width: videoWidth, height: videoHeight });
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = videoWidth;
        canvas.height = videoHeight;
      }

      if (!landmarkerRef.current) {
        const { FilesetResolver, PoseLandmarker: MediaPipePoseLandmarker } = await import("@mediapipe/tasks-vision");
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.2/wasm");
        landmarkerRef.current = await MediaPipePoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: `${import.meta.env.BASE_URL}models/pose_landmarker_lite.task` },
          runningMode: "VIDEO",
          numPoses: 1,
          minPoseDetectionConfidence: 0.55,
          minPosePresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });
      }
      setActive(true);
      setNotice("Camera ready. Calibrate with a known-size object in the same plane as the measurement.");
    } catch (cameraError) {
      stopCamera();
      setError(cameraError instanceof Error
        ? `Could not start the camera: ${cameraError.message} Check camera permission and try again.`
        : "Could not start the camera. Check camera permission and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!active) return;
    let lastUiUpdate = 0;
    let lastWarningUpdate = 0;
    const drawAndDetect = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!video || !canvas || !context || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        frameRef.current = requestAnimationFrame(drawAndDetect);
        return;
      }
      if (mode === "body" && video.currentTime !== lastVideoTimeRef.current && now - lastDetectionRef.current >= 33) {
        lastVideoTimeRef.current = video.currentTime;
        lastDetectionRef.current = now;
        try {
          const result = landmarkerRef.current?.detectForVideo(video, now);
          const detected = result?.landmarks[0] as PosePoint[] | undefined;
          landmarksRef.current = detected ?? null;
          result?.close();
        } catch {
          landmarksRef.current = null;
        }
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      if (mode === "body" && landmarksRef.current) {
        const points = landmarksRef.current;
        const required = new Set(metrics.flatMap((id) => POSE_LINES[id].flat()));
        const missing = [...required].some((index) => !points[index] || (points[index].visibility ?? 0) < 0.45);
        if (now - lastWarningUpdate >= 200) {
          lastWarningUpdate = now;
          setVisibilityWarning(missing ? "Some landmarks are obscured or out of frame. Step back, use even lighting, and keep the selected body areas visible." : "");
        }
        context.lineWidth = Math.max(2, canvas.width / 300);
        context.strokeStyle = "#ffe36d";
        context.fillStyle = "#fffefa";
        for (const id of metrics) {
          for (const segment of POSE_LINES[id]) {
            if (segment.some((index) => !points[index] || (points[index].visibility ?? 0) < 0.45)) continue;
            context.beginPath();
            segment.forEach((index, position) => {
              const point = points[index];
              const x = (mirror ? 1 - point.x : point.x) * canvas.width;
              if (!position) context.moveTo(x, point.y * canvas.height);
              else context.lineTo(x, point.y * canvas.height);
            });
            context.stroke();
          }
        }
        for (const index of required) {
          const point = points[index];
          if (!point || (point.visibility ?? 0) < 0.45) continue;
          context.beginPath();
          context.arc((mirror ? 1 - point.x : point.x) * canvas.width, point.y * canvas.height, Math.max(3, canvas.width / 180), 0, Math.PI * 2);
          context.fill();
        }
        if (scaleReady && now - lastUiUpdate >= 200) {
          lastUiUpdate = now;
          const point = (index: number) => points[index] && (points[index].visibility ?? 0) >= 0.45
            ? { x: points[index].x, y: points[index].y }
            : null;
          const mm = (first: Point | null, second: Point | null) =>
            first && second ? distance(first, second, canvas.width, canvas.height) / pixelsPerMm! : null;
          const pathLength = (indices: number[]) => {
            const path = indices.map(point);
            if (path.some((value) => value === null)) return null;
            return path.slice(1).reduce((sum, current, index) => sum + mm(path[index], current)!, 0);
          };
          const average = (...values: (number | null)[]) => {
            const valid = values.filter((value): value is number => value !== null);
            return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
          };
          const shoulders = mm(point(11), point(12));
          const hips = mm(point(23), point(24));
          const arms = average(pathLength([11, 13, 15]), pathLength([12, 14, 16]));
          const legs = average(pathLength([23, 25, 27]), pathLength([24, 26, 28]));
          const nose = point(0);
          const shoulderLeft = point(11);
          const shoulderRight = point(12);
          const ankleLeft = point(27);
          const ankleRight = point(28);
          const shoulderCenter = shoulderLeft && shoulderRight
            ? { x: (shoulderLeft.x + shoulderRight.x) / 2, y: (shoulderLeft.y + shoulderRight.y) / 2 }
            : null;
          const ankleCenter = ankleLeft && ankleRight
            ? { x: (ankleLeft.x + ankleRight.x) / 2, y: (ankleLeft.y + ankleRight.y) / 2 }
            : null;
          const height = nose && shoulderCenter && ankleCenter
            ? mm({ x: nose.x, y: Math.max(0, nose.y - Math.abs(shoulderCenter.y - nose.y) * 0.35) }, ankleCenter)
            : null;
          const next: Record<string, number> = {};
          for (const [id, value] of Object.entries({ shoulders, hips, arms, legs, height })) {
            if (metrics.includes(id) && value !== null && Number.isFinite(value)) next[id] = value;
          }
          setLiveMeasurements(next);
        }
      } else {
        if (mode === "body" && now - lastWarningUpdate >= 200) {
          lastWarningUpdate = now;
          setLiveMeasurements({});
          setVisibilityWarning("No person detected. Stand fully in frame with good lighting.");
        }
      }

      const allPoints = mode === "calibration" ? calibrationPoints : objectPoints;
      if (mode !== "body") {
        context.lineWidth = Math.max(2, canvas.width / 300);
        context.strokeStyle = "#ffe36d";
        context.fillStyle = "#fffefa";
        measurements.forEach(({ points, label, mm }) => {
          context.beginPath();
          context.moveTo((mirror ? 1 - points[0].x : points[0].x) * canvas.width, points[0].y * canvas.height);
          context.lineTo((mirror ? 1 - points[1].x : points[1].x) * canvas.width, points[1].y * canvas.height);
          context.stroke();
          context.fillText(`${label} · ${(mm / 10).toFixed(1)} cm`, (mirror ? 1 - points[1].x : points[1].x) * canvas.width + 8, points[1].y * canvas.height - 8);
        });
        allPoints.forEach((point) => {
          context.beginPath();
          context.arc((mirror ? 1 - point.x : point.x) * canvas.width, point.y * canvas.height, Math.max(4, canvas.width / 150), 0, Math.PI * 2);
          context.fill();
        });
      }
      frameRef.current = requestAnimationFrame(drawAndDetect);
    };
    frameRef.current = requestAnimationFrame(drawAndDetect);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [active, mode, metrics, calibrationPoints, objectPoints, measurements, pixelsPerMm, scaleReady, mirror]);

  function canvasPoint(event: MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const displayX = (event.clientX - rect.left) / rect.width;
    return {
      x: mirror ? 1 - displayX : displayX,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function completeCalibration(points: Point[]) {
    if (points.length !== 2 || !Number.isFinite(referenceMm) || referenceMm <= 0 || !frameSize.width) return;
    const px = distance(points[0], points[1], frameSize.width, frameSize.height);
    if (px < 8) {
      setError("Choose two points farther apart on the reference edge.");
      return;
    }
    setPixelsPerMm(px / referenceMm);
    setCalibrationPoints(points);
    setMeasurements([]);
    setObjectPoints([]);
    setError("");
    setNotice(`Calibration set to ${(px / referenceMm).toFixed(2)} pixels per mm. Keep the subject and reference in the same plane.`);
  }

  function invalidateCalibration() {
    setPixelsPerMm(null);
    setCalibrationPoints([]);
    setMeasurements([]);
    setObjectPoints([]);
    setLiveMeasurements({});
  }

  function handleCanvasClick(event: MouseEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    if (!point) return;
    if (mode === "calibration") {
      setError("");
      const next = calibrationPoints.length === 2 ? [point] : [...calibrationPoints, point];
      setCalibrationPoints(next);
      if (next.length === 1) {
        setPixelsPerMm(null);
        setMeasurements([]);
        setObjectPoints([]);
        setLiveMeasurements({});
      }
      if (next.length === 2) completeCalibration(next);
      return;
    }
    if (mode === "object") {
      if (!scaleReady) {
        setError("Calibrate the camera with a known-size reference before adding measurements.");
        return;
      }
      const next = objectPoints.length === 1 ? [...objectPoints, point] : [point];
      if (next.length === 2) {
        const mm = distance(next[0], next[1], frameSize.width, frameSize.height) / pixelsPerMm!;
        const id = nextIdRef.current++;
        const label = objectLabel.trim() || `Measurement ${measurements.length + 1}`;
        setMeasurements((items) => [...items, {
          id,
          label,
          mm,
          points: [next[0], next[1]],
        }]);
        setObjectPoints([]);
        setNotice("Measurement added. It remains on the camera overlay until you remove it or clear the list.");
      } else {
        setObjectPoints(next);
      }
    }
  }

  async function detectReferenceEdges() {
    if (!active || !videoRef.current || !frameSize.width) {
      setError("Start the camera before detecting reference edges.");
      return;
    }
    setError("");
    setDetectingEdges(true);
    let source: any;
    let gray: any;
    let blurred: any;
    let edges: any;
    let hierarchy: any;
    let contours: any;
    try {
      const cv = await loadOpenCv();
      const snapshot = document.createElement("canvas");
      snapshot.width = frameSize.width;
      snapshot.height = frameSize.height;
      snapshot.getContext("2d")?.drawImage(videoRef.current, 0, 0, snapshot.width, snapshot.height);
      source = cv.imread(snapshot);
      gray = new cv.Mat();
      blurred = new cv.Mat();
      edges = new cv.Mat();
      hierarchy = new cv.Mat();
      contours = new cv.MatVector();
      cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      cv.Canny(blurred, edges, 45, 130);
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      let candidate: { x: number; y: number; width: number; height: number; area: number } | null = null;
      for (let index = 0; index < contours.size(); index += 1) {
        const contour = contours.get(index);
        const perimeter = cv.arcLength(contour, true);
        const polygon = new cv.Mat();
        cv.approxPolyDP(contour, polygon, 0.025 * perimeter, true);
        if (polygon.rows === 4) {
          const bounds = cv.boundingRect(polygon);
          const area = bounds.width * bounds.height;
          const ratio = bounds.width / Math.max(1, bounds.height);
          if (area > frameSize.width * frameSize.height * 0.001 && area < frameSize.width * frameSize.height * 0.35 && ratio > 0.35 && ratio < 2.85 && (!candidate || area > candidate.area)) {
            candidate = { ...bounds, area };
          }
        }
        polygon.delete();
        contour.delete();
      }
      if (!candidate) throw new Error("No clear rectangular reference edge was found. Adjust lighting and try again, or place the two points manually.");
      const left = candidate.x / frameSize.width;
      const right = (candidate.x + candidate.width) / frameSize.width;
      const top = candidate.y / frameSize.height;
      const bottom = (candidate.y + candidate.height) / frameSize.height;
      const chooseShortEdge = reference === "210";
      const horizontalEdge = chooseShortEdge ? candidate.width < candidate.height : candidate.width >= candidate.height;
      const points: Point[] = horizontalEdge
        ? [{ x: left, y: (top + bottom) / 2 }, { x: right, y: (top + bottom) / 2 }]
        : [{ x: (left + right) / 2, y: top }, { x: (left + right) / 2, y: bottom }];
      setCalibrationPoints(points);
      completeCalibration(points);
      setNotice("Largest clear rectangular contour selected. Check that the selected edges belong to your reference object.");
    } catch (detectionError) {
      setError(detectionError instanceof Error ? detectionError.message : "Could not detect the reference edges. Place two points manually.");
    } finally {
      source?.delete();
      gray?.delete();
      blurred?.delete();
      edges?.delete();
      hierarchy?.delete();
      contours?.delete();
      setDetectingEdges(false);
    }
  }

  function changeFacing(nextFacing: "user" | "environment") {
    facingRef.current = nextFacing;
    setFacing(nextFacing);
    setPixelsPerMm(null);
    setCalibrationPoints([]);
    setMeasurements([]);
    setObjectPoints([]);
    setLiveMeasurements({});
    if (active) {
      stopCamera();
      window.setTimeout(() => void startCamera(), 0);
    }
  }

  const modeName = mode === "calibration" ? "Calibration" : mode === "object" ? "Object measure" : "Body measure";

  return (
    <>
      <section className="webcam-page-intro">
        <p className="eyebrow">OPTIONAL · ON-DEVICE TOOL</p>
        <h1>Webcam <em>measurements.</em></h1>
        <p>Calibrate against a known-width reference, then inspect linear body or object measurements. This tool is separate from SmartFit and your manual tailoring form.</p>
      </section>
      <section className="webcam-tool">
        <div className="webcam-disclaimer" role="note">
          <CircleHelp size={20} />
          <p><b>Accuracy matters.</b> This is a visual aid, not a tailoring-grade measurement or fit guarantee. Perspective, lens distortion, pose, clothing, landmark placement and camera angle can all introduce error. The reference and subject must be at the same distance from the camera and in the same plane; re-calibrate if the camera moves. Body lengths are linear only—no circumference is measured or sent to your tailoring form. A tailor should verify every measurement.</p>
        </div>
        <div className="webcam-toolbar">
          <div className="webcam-tabs" role="group" aria-label="Measurement mode">
            <button type="button" className={mode === "calibration" ? "is-selected" : ""} aria-pressed={mode === "calibration"} onClick={() => setMode("calibration")}><Crosshair size={15} /> Calibrate</button>
            <button type="button" className={mode === "body" ? "is-selected" : ""} aria-pressed={mode === "body"} onClick={() => setMode("body")}><Ruler size={15} /> Body</button>
            <button type="button" className={mode === "object" ? "is-selected" : ""} aria-pressed={mode === "object"} onClick={() => setMode("object")}><Ruler size={15} /> Object</button>
          </div>
          <div className="webcam-camera-controls">
            <label>Camera<select value={facing} onChange={(event) => changeFacing(event.target.value === "environment" ? "environment" : "user")}><option value="user">Front</option><option value="environment">Rear</option></select></label>
            <button type="button" className="webcam-secondary-button" onClick={() => setMirror((value) => !value)} aria-pressed={mirror}><FlipHorizontal size={15} /> Mirror {mirror ? "on" : "off"}</button>
          </div>
        </div>

        <div className="webcam-layout">
          <div className="webcam-camera-column">
            <div className={`webcam-stage ${active ? "is-active" : ""}`} style={frameSize.width ? { aspectRatio: `${frameSize.width} / ${frameSize.height}` } : undefined}>
              <video ref={videoRef} className={mirror ? "is-mirrored" : ""} autoPlay muted playsInline aria-label="Live webcam measurement preview" />
              <canvas ref={canvasRef} onClick={handleCanvasClick} aria-label={`Camera overlay for ${modeName}; click to place points`} />
              {!active && <div className="webcam-placeholder"><Camera size={28} /><b>Camera preview</b><span>Allow access to begin. Your frames stay on this device.</span></div>}
            </div>
            <div className="webcam-camera-actions">
              {active
                ? <button className="button button-dark" type="button" onClick={stopCamera}><X size={15} /> Stop camera</button>
                : <button className="button button-dark" type="button" onClick={() => void startCamera()} disabled={loading}><Camera size={15} /> {loading ? "Preparing camera and pose model…" : "Allow camera access"}</button>}
              <span>{active ? "Camera is active" : "Camera is off"}</span>
            </div>
            {error && <p className="form-status smartfit-error" role="alert">{error}</p>}
            {notice && <p className="form-status" role="status">{notice}</p>}
          </div>

          <aside className="webcam-controls-panel">
            {mode === "calibration" && (
              <section className="webcam-panel-section">
                <h2>1. Set your reference</h2>
                <p>Place a flat reference beside the area you’ll measure. Choose its width, then click the two ends of that edge in the preview.</p>
                <label>Reference width<select value={reference} onChange={(event) => { setReference(event.target.value); invalidateCalibration(); }}><option value="85.6">Credit card · 85.60 mm</option><option value="210">A4 short edge · 210 mm</option><option value="custom">Custom width</option></select></label>
                {reference === "custom" && <label>Known width (mm)<input type="number" min="1" max="2000" step="0.1" value={customWidth} onChange={(event) => { setCustomWidth(event.target.value); invalidateCalibration(); }} /></label>}
                <button className="webcam-secondary-button webcam-detect-button" type="button" onClick={() => void detectReferenceEdges()} disabled={!active || detectingEdges || !Number.isFinite(referenceMm) || referenceMm <= 0}>{detectingEdges ? "Finding edges…" : "Try OpenCV edge detection"}</button>
                <p className="webcam-helper">Automatic detection picks the largest clear rectangular contour; inspect the selection because it can choose the wrong edge. Manual point placement is available anytime.</p>
                {scaleReady && <p className="webcam-calibrated"><Check size={15} /> Calibrated · {pixelsPerMm!.toFixed(2)} px/mm</p>}
                <button className="webcam-text-button" type="button" onClick={invalidateCalibration}>Reset calibration</button>
              </section>
            )}

            {mode === "body" && (
              <section className="webcam-panel-section">
                <h2>2. Body lengths</h2>
                <p>Stand facing the camera, feet and selected areas visible. Pose is analyzed locally at up to about 30 frames per second; values refresh around 5 times per second.</p>
                <div className="webcam-metric-options">
                  {BODY_METRICS.map(({ id, label }) => <label key={id}><input type="checkbox" checked={metrics.includes(id)} onChange={(event) => setMetrics((current) => event.target.checked ? [...current, id] : current.filter((value) => value !== id))} />{label}</label>)}
                </div>
                {!scaleReady && <p className="webcam-helper">Calibrate first to show measurements in millimetres and centimetres.</p>}
                {visibilityWarning && <p className="webcam-warning" role="status">{visibilityWarning}</p>}
                <dl className="webcam-live-values">
                  {BODY_METRICS.filter(({ id }) => metrics.includes(id)).map(({ id, label }) => (
                    <div key={id}><dt>{label}</dt><dd>{liveMeasurements[id] !== undefined && scaleReady ? `${(liveMeasurements[id] / 10).toFixed(1)} cm` : "—"}</dd></div>
                  ))}
                </dl>
                {metrics.includes("height") && <p className="webcam-helper">Estimated height extrapolates from nose, shoulders and ankles; it is especially approximate and may not equal standing height.</p>}
              </section>
            )}

            {mode === "object" && (
              <section className="webcam-panel-section">
                <h2>3. Object measurements</h2>
                <p>Enter a label, then click any two points in the calibrated preview. Completed line measurements remain on the overlay.</p>
                <label>Measurement label<input type="text" maxLength={40} value={objectLabel} onChange={(event) => setObjectLabel(event.target.value)} /></label>
                {!scaleReady && <p className="webcam-warning">Calibrate before measuring an object.</p>}
                {objectPoints.length === 1 && <p className="webcam-helper">First point placed. Click the second endpoint.</p>}
                <div className="webcam-object-list">
                  {measurements.map((item) => <div key={item.id}><span><b>{item.label}</b><small>{(item.mm / 10).toFixed(1)} cm · {item.mm.toFixed(0)} mm</small></span><button type="button" aria-label={`Delete ${item.label}`} onClick={() => setMeasurements((current) => current.filter(({ id }) => id !== item.id))}><Trash2 size={15} /></button></div>)}
                  {measurements.length === 0 && <p>No object measurements yet.</p>}
                </div>
                {measurements.length > 0 && <button className="webcam-text-button" type="button" onClick={() => { setMeasurements([]); setObjectPoints([]); }}>Clear all measurements</button>}
              </section>
            )}
          </aside>
        </div>
        <p className="webcam-privacy"><b>Privacy:</b> Camera frames and pose data are processed in this browser only; they are not uploaded or saved. MediaPipe’s runtime is downloaded from jsDelivr when the camera starts, and the optional OpenCV.js runtime is downloaded from docs.opencv.org only if you choose edge detection.</p>
      </section>
    </>
  );
}
