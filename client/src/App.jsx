import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import FrameSelector from './components/FrameSelector';
import CameraSession from './components/CameraSession';
import PreviewResult from './components/PreviewResult';
import DownloadPage from './components/DownloadPage';

export default function App() {
  const [currentStep, setCurrentStep] = useState('LANDING'); // LANDING, FRAME_PICKER, CAMERA, PREVIEW, DOWNLOAD
  const [layoutConfig, setLayoutConfig] = useState(null);
  const [capturedPhotos, setCapturedPhotos] = useState([]);
  const [downloadFilename, setDownloadFilename] = useState('');

  // Detect URL path to display dedicated mobile download page if accessed via /download/:filename
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.startsWith('/download/')) {
        const file = path.replace(/^\/download\//, '').split('?')[0];
        setDownloadFilename(file);
        setCurrentStep('DOWNLOAD');
      }
    }
  }, []);

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
    <div className="w-full h-full h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col justify-center">
      {currentStep === 'DOWNLOAD' && (
        <DownloadPage filename={downloadFilename} />
      )}

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
