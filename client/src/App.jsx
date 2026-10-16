import React, { useState } from 'react';
import LandingPage from './components/LandingPage';
import FrameSelector from './components/FrameSelector';
import CameraSession from './components/CameraSession';
import PreviewResult from './components/PreviewResult';

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // LANDING, FRAME_PICKER, CAMERA, PREVIEW
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);

  const handleStartLanding = () => {
    setCurrentStep('FRAME_PICKER');
  };

  const handleConfirmFrame = (config) => {
    setLayoutConfig(config);
    setCurrentStep('CAMERA');
  };

  const handleCompletePhotos = (photos) => {
    setCapturedPhotos(photos);
    setCurrentStep('PREVIEW');
  };

  const handleResetSession = () => {
    setCapturedPhotos([]);
    setLayoutConfig(null);
    setCurrentStep('LANDING');
  };

  return (
    <div className="w-full min-h-screen">
      {currentStep === 'LANDING' && <LandingPage onStartSession={handleStartLanding} />}

      {currentStep === 'FRAME_PICKER' && (
        <FrameSelector
          onConfirm={handleConfirmFrame}
          onBack={() => setCurrentStep('LANDING')}
        />
      )}

      {currentStep === 'CAMERA' && (
        <CameraSession
          layoutConfig={layoutConfig}
          onComplete={handleCompletePhotos}
          onCancel={() => setCurrentStep('FRAME_PICKER')}
        />
      )}

      {currentStep === 'PREVIEW' && (
        <PreviewResult
          photos={capturedPhotos}
          layoutConfig={layoutConfig}
          onResetSession={handleResetSession}
        />
      )}
    </div>
  );
}
