# AdaptivePAT

## AI-Based Virtual Camera Tracking for Robust FSOC Coarse Alignment

### Overview
AdaptivePAT is a software-based virtual testbed for coarse alignment and tracking of mobile Free Space Optical Communication (FSOC) terminals. It simulates a 3D environment where an AI-assisted virtual pan-tilt camera system detects and tracks a virtual optical beacon. The system incorporates temporal tracking, motion prediction, and confidence-aware tracking to handle complex scenarios such as target loss and various disturbances.

### Core Tracking States
The tracking system operates across multiple states to ensure robust target lock:
- **SEARCH**: Actively scanning the environment for the target beacon.
- **ACQUIRE**: Target detected; moving to center the target in the field of view.
- **TRACK**: Maintaining lock on the target using continuous adjustments.
- **PREDICT**: Estimating target trajectory during temporary loss of sight.
- **LOCAL REACQUISITION**: Searching near the last known position.
- **GLOBAL REACQUISITION**: Broad search when local reacquisition fails.
- **RECOVER**: Re-establishing full tracking after a loss event.

### Disturbance Scenarios
The testbed supports various disturbance simulations to test tracking robustness:
- Camera vibration
- Camera jitter
- Sudden movement
- Target acceleration
- Target direction changes
- Image noise
- Occlusion
- Clutter/distractors
- Temporary target loss

### Baseline vs AdaptivePAT
The simulation demonstrates the improvements of the AdaptivePAT methodology over a standard baseline:
- **Baseline**: Detection → Camera Control → Tracking
- **AdaptivePAT**: Detection → Confidence → Tracking → Prediction → Adaptive Control → Reacquisition

### Metrics
The system continuously monitors and visualizes the following metrics in the dashboard:
- Acquisition time
- Reacquisition time
- Tracking error
- Lock retention
- Target-loss events
- Successful reacquisition
- FPS (Frames per second)
- Latency
- Confidence score

### Technology Stack
- **Frontend**: React 19, Vite
- **3D Rendering**: Three.js, React Three Fiber (@react-three/fiber), React Three Drei (@react-three/drei)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Charting**: Recharts
- **Icons**: Lucide React

### Local Development
To run the simulator locally, follow these steps:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```

### Environment Variables
Currently, the project runs entirely on the frontend and does not require active environment variables for the core simulation. If you connect an external backend or analytics, copy `.env.example` to `.env` and configure accordingly:
```bash
cp .env.example .env
```

### Deployment
This project is configured as a static site and can be easily deployed to platforms like Vercel, Netlify, or GitHub Pages. 
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

### Future Scope
- Real camera integration
- Hardware-in-the-loop testing
- Physical pan/tilt platform
- Atmospheric/optical channel modeling
- Fine pointing mechanisms
- Multi-target tracking
