let facingMode = "user";
const videoElement = document.getElementById('cameraFeed');
const canvasElement = document.getElementById('handCanvas');
const canvasCtx = canvasElement.getContext('2d');
let camera;
let currentGesture;

const hands = new Hands({locateFile: (file) => {
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
}});

hands.setOptions({
  maxNumHands: 2,
  modelComplexity: 1,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7
});

const fingerColors = {
  thumb: '#FF0000',
  index: '#00FF00',
  middle: '#0000FF',
  ring: '#FFFF00',
  pinky: '#FF00FF'
};

hands.onResults(onResults);

function calculateAngle(p1, p2, p3) {
  const radians = Math.atan2(p3.y - p2.y, p3.x - p2.x) - Math.atan2(p1.y - p2.y, p1.x - p2.x);
  let angle = Math.abs(radians * 180.0 / Math.PI);
  if (angle > 180.0) {
    angle = 360 - angle;
  }
  return angle;
}

function isFingerExtended(landmarks, fingerPoints, fingerName) {
  if (fingerName === 'thumb') {
    // For thumb, check if tip is farther from wrist than the joint before it
    const wrist = landmarks[0];
    const tip = landmarks[fingerPoints[3]]; // Thumb tip
    const joint = landmarks[fingerPoints[2]]; // Joint before tip

    const tipDistance = Math.sqrt(Math.pow(tip.x - wrist.x, 2) + Math.pow(tip.y - wrist.y, 2));
    const jointDistance = Math.sqrt(Math.pow(joint.x - wrist.x, 2) + Math.pow(joint.y - wrist.y, 2));

    return tipDistance > jointDistance * 1.1;
  } else {
    // For other fingers, check if tip is higher than the joint two positions back
    const tip = landmarks[fingerPoints[3]];
    const joint = landmarks[fingerPoints[1]];

    // Also check angle at the middle joint
    const p1 = landmarks[fingerPoints[1]];
    const p2 = landmarks[fingerPoints[2]];
    const p3 = landmarks[fingerPoints[3]];

    const angle = calculateAngle(p1, p2, p3);

    return tip.y < joint.y && angle > 120;
  }
}

function detectFingerStates(landmarks) {
  const fingerStates = {};
  const fingerPoints = {
    thumb: [1, 2, 3, 4],
    index: [5, 6, 7, 8],
    middle: [9, 10, 11, 12],
    ring: [13, 14, 15, 16],
    pinky: [17, 18, 19, 20]
  };

  for (const [fingerName, points] of Object.entries(fingerPoints)) {
    fingerStates[fingerName] = isFingerExtended(landmarks, points, fingerName);
  }

  return fingerStates;
}

function onResults(results) {
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
  canvasCtx.scale(facingMode === "user" ? -1 : 1, 1);
  canvasCtx.translate(facingMode === "user" ? -canvasElement.width : 0, 0);
  canvasCtx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

  if (results.multiHandLandmarks) {
    for (const landmarks of results.multiHandLandmarks) {
      // Draw hand skeleton
      drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, {color: '#FFFFFF', lineWidth: 2});

      // Draw individual fingers with different colors and depth
      drawFinger(canvasCtx, landmarks, [1, 2, 3, 4], fingerColors.thumb, "Thumb");
      drawFinger(canvasCtx, landmarks, [5, 6, 7, 8], fingerColors.index, "Index");
      drawFinger(canvasCtx, landmarks, [9, 10, 11, 12], fingerColors.middle, "Middle");
      drawFinger(canvasCtx, landmarks, [13, 14, 15, 16], fingerColors.ring, "Ring");
      drawFinger(canvasCtx, landmarks, [17, 18, 19, 20], fingerColors.pinky, "Pinky");

      // Update finger info with states
      updateFingerInfo(landmarks);
    }
  } else {
    // Clear finger states when no hand is detected
    clearFingerStates();
  }
  canvasCtx.restore();

  // Update gesture info
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    currentGesture = results.multiHandLandmarks.length + " Hand(s) Detected";
  } else {
    currentGesture = "No Hand Detected";
  }
  document.getElementById('currentGesture').textContent = currentGesture;
}

function drawFinger(ctx, landmarks, fingerPoints, color, fingerName) {
  ctx.beginPath();
  ctx.moveTo(landmarks[0].x * canvasElement.width, landmarks[0].y * canvasElement.height);
  for (const point of fingerPoints) {
    ctx.lineTo(landmarks[point].x * canvasElement.width, landmarks[point].y * canvasElement.height);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.stroke();

  // Draw depth circles at finger joints
  for (const point of fingerPoints) {
    const radius = (1 - landmarks[point].z) * 10;
    ctx.beginPath();
    ctx.arc(landmarks[point].x * canvasElement.width, landmarks[point].y * canvasElement.height, radius, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function updateFingerInfo(landmarks) {
  const fingerTips = {
    thumb: landmarks[4],
    index: landmarks[8],
    middle: landmarks[12],
    ring: landmarks[16],
    pinky: landmarks[20]
  };

  const fingerStates = detectFingerStates(landmarks);

  // Clear existing floating captions
  clearFloatingCaptions();

  for (const [finger, tip] of Object.entries(fingerTips)) {
    const element = document.getElementById(finger);
    const statusElement = document.getElementById(finger + 'Status');
    const depth = (1 - tip.z).toFixed(2);

    const isExtended = fingerStates[finger];
    const status = isExtended ? 'Extended' : 'Folded';

    // Update text content
    element.querySelector('div:first-child').textContent = 
      `${finger.charAt(0).toUpperCase() + finger.slice(1)}: X:${tip.x.toFixed(2)} Y:${tip.y.toFixed(2)} Z:${depth}`;
    statusElement.textContent = status;

    // Update styling
    element.style.backgroundColor = fingerColors[finger];
    element.style.color = 'black';

    // Add extended/folded class
    element.classList.remove('extended', 'folded');
    element.classList.add(isExtended ? 'extended' : 'folded');

    // Create floating caption
    createFloatingCaption(finger, tip, isExtended);
  }
}

function createFloatingCaption(fingerName, tip, isExtended) {
  const container = document.getElementById('cameraContainer');
  const caption = document.createElement('div');
  caption.className = `floating-caption ${isExtended ? 'extended' : 'folded'}`;
  caption.textContent = `${fingerName.charAt(0).toUpperCase() + fingerName.slice(1)}: ${isExtended ? 'Extended' : 'Folded'}`;

  // Calculate position based on tip coordinates
  const containerRect = container.getBoundingClientRect();
  let x = tip.x * container.offsetWidth;
  let y = tip.y * container.offsetHeight;

  // Flip x coordinate for mirrored display
  if (facingMode === "user") {
    x = container.offsetWidth - x;
  }

  caption.style.left = x + 'px';
  caption.style.top = y + 'px';
  caption.style.borderColor = fingerColors[fingerName];

  container.appendChild(caption);
}

function clearFloatingCaptions() {
  const container = document.getElementById('cameraContainer');
  const captions = container.querySelectorAll('.floating-caption');
  captions.forEach(caption => caption.remove());
}

function clearFingerStates() {
  const fingers = ['thumb', 'index', 'middle', 'ring', 'pinky'];
  fingers.forEach(finger => {
    const element = document.getElementById(finger);
    const statusElement = document.getElementById(finger + 'Status');

    element.querySelector('div:first-child').textContent = finger.charAt(0).toUpperCase() + finger.slice(1);
    statusElement.textContent = '-';
    element.style.backgroundColor = 'rgba(255,255,255,0.1)';
    element.style.color = '#fff';
    element.classList.remove('extended', 'folded');
  });

  // Clear floating captions when no hand is detected
  clearFloatingCaptions();
}

function initializeCamera() {
  camera = new Camera(videoElement, {
    onFrame: async () => {
      await hands.send({image: videoElement});
    },
    width: 1280,
    height: 720,
    facingMode: facingMode
  });
}

async function startCamera() {
  try {
    if (camera) {
      await camera.stop();
    }
    initializeCamera();
    await camera.start();
  } catch (err) {
    console.error("Error starting the camera: ", err);
    alert("Failed to start the camera. Please ensure you've granted the necessary permissions.");
  }
}

document.getElementById('startCamera').addEventListener('click', startCamera);

document.getElementById('switchCamera').addEventListener('click', async () => {
  facingMode = facingMode === "user" ? "environment" : "user";
  videoElement.style.transform = facingMode === "user" ? "scaleX(-1)" : "scaleX(1)";
  await startCamera();
});

function onResize() {
  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;
}

videoElement.addEventListener('loadedmetadata', onResize);
window.addEventListener('resize', onResize);

initializeCamera();