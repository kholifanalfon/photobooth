export const PAPER_PRESETS = {
  '4R': {
    id: '4R',
    name: '4R (102 × 152 mm / 4×6")',
    label: '4R',
    desc: 'Standar Foto Kiosk (102 × 152 mm)',
    widthMm: 102,
    heightMm: 152,
    dpi: 300,
    portrait: { width: 1200, height: 1800 },
    landscape: { width: 1800, height: 1200 },
    hasOrientation: true
  },
  '3x5cm': {
    id: '3x5cm',
    name: '3 × 5 cm (30 × 50 mm)',
    label: '3×5 cm',
    desc: 'Format Pasfoto / Mini (30 × 50 mm)',
    widthMm: 30,
    heightMm: 50,
    dpi: 300,
    portrait: { width: 354, height: 591 },
    landscape: { width: 591, height: 354 },
    hasOrientation: true
  },
  '5x5cm': {
    id: '5x5cm',
    name: '5 × 5 cm (50 × 50 mm)',
    label: '5×5 cm',
    desc: 'Format Square / Kotak (50 × 50 mm)',
    widthMm: 50,
    heightMm: 50,
    dpi: 300,
    portrait: { width: 591, height: 591 },
    landscape: { width: 591, height: 591 },
    hasOrientation: false
  },
  'image': {
    id: 'image',
    name: 'Sesuai Gambar Frame (Auto)',
    label: 'Ikuti Frame',
    desc: 'Ukuran kertas mengikuti gambar desain frame yang diupload',
    widthMm: null,
    heightMm: null,
    dpi: 300,
    portrait: { width: 1200, height: 1800 },
    landscape: { width: 1800, height: 1200 },
    hasOrientation: true,
    isCustom: true
  }
};

export const SAMPLE_PLACEHOLDER_PHOTOS = [
  "/samples/pose1.jpg",
  "/samples/pose2.jpg",
  "/samples/pose3.jpg",
  "/samples/pose1.jpg",
  "/samples/pose2.jpg",
  "/samples/pose3.jpg",
  "/samples/pose1.jpg",
  "/samples/pose2.jpg",
  "/samples/pose3.jpg",
  "/samples/pose1.jpg"
];

export const SLOT_PRESETS = {
  1: {
    label: '1 Foto (Single)',
    desc: 'Polaroid / Single 4R',
    portrait: [{ id: 1, x: 100, y: 240, width: 1000, height: 1300, radius: 8, borderWidth: 3, borderColor: '#1E293B' }],
    landscape: [{ id: 1, x: 120, y: 100, width: 1200, height: 1000, radius: 16 }]
  },
  2: {
    label: '2 Foto (Duo)',
    desc: '2 Pose Vertikal / Horizontal',
    portrait: [
      { id: 1, x: 100, y: 240, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 100, y: 910, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ],
    landscape: [
      { id: 1, x: 100, y: 100, width: 750, height: 1000, radius: 16 },
      { id: 2, x: 950, y: 100, width: 750, height: 1000, radius: 16 }
    ]
  },
  3: {
    label: '3 Foto (Combo Top 2 + Bottom 1)',
    desc: '2 Pose Atas + 1 Pose Bawah 4R',
    portrait: [
      { id: 1, x: 80, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 620, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 3, x: 80, y: 920, width: 1040, height: 620, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ],
    landscape: [
      { id: 1, x: 80, y: 100, width: 480, height: 1000, radius: 16 },
      { id: 2, x: 600, y: 100, width: 480, height: 1000, radius: 16 },
      { id: 3, x: 1120, y: 100, width: 480, height: 1000, radius: 16 }
    ]
  },
  4: {
    label: '4 Foto (Grid 2x2)',
    desc: '4 Pose Klasik 4R',
    portrait: [
      { id: 1, x: 80, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 620, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 3, x: 80, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 4, x: 620, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ],
    landscape: [
      { id: 1, x: 120, y: 70, width: 720, height: 480, radius: 16 },
      { id: 2, x: 960, y: 70, width: 720, height: 480, radius: 16 },
      { id: 3, x: 120, y: 600, width: 720, height: 480, radius: 16 },
      { id: 4, x: 960, y: 600, width: 720, height: 480, radius: 16 }
    ]
  },
  6: {
    label: '6 Foto (Double 3-Strip / Kolase)',
    desc: '2 Strip x 3 Pose (Format Tiket 4R)',
    portrait: [
      { id: 1, x: 95, y: 466, width: 470, height: 378, radius: 0 },
      { id: 2, x: 95, y: 826, width: 470, height: 378, radius: 0 },
      { id: 3, x: 95, y: 1188, width: 470, height: 378, radius: 0 },
      { id: 4, x: 637, y: 466, width: 470, height: 378, radius: 0 },
      { id: 5, x: 637, y: 826, width: 470, height: 378, radius: 0 },
      { id: 6, x: 637, y: 1188, width: 470, height: 378, radius: 0 }
    ],
    landscape: [
      { id: 1, x: 70, y: 80, width: 510, height: 480, radius: 14 },
      { id: 2, x: 640, y: 80, width: 510, height: 480, radius: 14 },
      { id: 3, x: 1210, y: 80, width: 510, height: 480, radius: 14 },
      { id: 4, x: 70, y: 600, width: 510, height: 480, radius: 14 },
      { id: 5, x: 640, y: 600, width: 510, height: 480, radius: 14 },
      { id: 6, x: 1210, y: 600, width: 510, height: 480, radius: 14 }
    ]
  },
  10: {
    label: "10 Foto (Double 5-Strip Wedding)",
    desc: "5 Kiri + 5 Kanan (4R Format Strip Cetak)",
    portrait: [
      { id: 1, x: 215, y: 205, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 0 },
      { id: 2, x: 215, y: 413, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 1 },
      { id: 3, x: 215, y: 621, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 2 },
      { id: 4, x: 215, y: 829, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 3 },
      { id: 5, x: 215, y: 1037, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 4 },
      { id: 6, x: 655, y: 205, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 0, photoIndex: 0 },
      { id: 7, x: 655, y: 413, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 1, photoIndex: 1 },
      { id: 8, x: 655, y: 621, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 2, photoIndex: 2 },
      { id: 9, x: 655, y: 829, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 3, photoIndex: 3 },
      { id: 10, x: 655, y: 1037, width: 330, height: 196, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 4, photoIndex: 4 }
    ],
    landscape: [
      { id: 1, x: 60, y: 80, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 0 },
      { id: 2, x: 390, y: 80, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 1 },
      { id: 3, x: 720, y: 80, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 2 },
      { id: 4, x: 1050, y: 80, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 3 },
      { id: 5, x: 1380, y: 80, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: null, photoIndex: 4 },
      { id: 6, x: 60, y: 640, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 0, photoIndex: 0 },
      { id: 7, x: 390, y: 640, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 1, photoIndex: 1 },
      { id: 8, x: 720, y: 640, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 2, photoIndex: 2 },
      { id: 9, x: 1050, y: 640, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 3, photoIndex: 3 },
      { id: 10, x: 1380, y: 640, width: 310, height: 210, radius: 10, borderWidth: 1, borderColor: "#D4AF37", mirrorFromSlot: 4, photoIndex: 4 }
    ]
  }
};

/**
 * 4 Modern 4R Frames with "Photo Booth" header and "Thank You" footer
 * matching the photobooth kiosk reference:
 * 1. Bingkai 1 Foto (1 large portrait slot)
 * 2. Bingkai 2 Foto (2 landscape slots stacked)
 * 3. Bingkai 3 Foto (2 portrait slots top + 1 landscape slot bottom)
 * 4. Bingkai 4 Foto (2x2 grid of portrait slots)
 */
export const MODERN_4R_FRAMES = [
  {
    id: 'frame-4r-1photo',
    name: 'Bingkai 1 Foto',
    enabled: true,
    orientation: 'portrait',
    paperSize: '4R',
    width: 1200,
    height: 1800,
    imageUrl: '/frames/frame_4r_1photo.png',
    layerMode: 'background',
    photoCount: 1,
    slots: [
      { id: 1, x: 100, y: 240, width: 1000, height: 1300, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ]
  },
  {
    id: 'frame-4r-2photos',
    name: 'Bingkai 2 Foto',
    enabled: true,
    orientation: 'portrait',
    paperSize: '4R',
    width: 1200,
    height: 1800,
    imageUrl: '/frames/frame_4r_2photos.png',
    layerMode: 'background',
    photoCount: 2,
    slots: [
      { id: 1, x: 100, y: 240, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 100, y: 910, width: 1000, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ]
  },
  {
    id: 'frame-4r-3photos',
    name: 'Bingkai 3 Foto',
    enabled: true,
    orientation: 'portrait',
    paperSize: '4R',
    width: 1200,
    height: 1800,
    imageUrl: '/frames/frame_4r_3photos.png',
    layerMode: 'background',
    photoCount: 3,
    slots: [
      { id: 1, x: 80, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 620, y: 240, width: 500, height: 640, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 3, x: 80, y: 920, width: 1040, height: 620, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ]
  },
  {
    id: 'frame-4r-4photos',
    name: 'Bingkai 4 Foto',
    enabled: true,
    orientation: 'portrait',
    paperSize: '4R',
    width: 1200,
    height: 1800,
    imageUrl: '/frames/frame_4r_4photos.png',
    layerMode: 'background',
    photoCount: 4,
    slots: [
      { id: 1, x: 80, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 2, x: 620, y: 240, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 3, x: 80, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' },
      { id: 4, x: 620, y: 910, width: 500, height: 630, radius: 8, borderWidth: 3, borderColor: '#1E293B' }
    ]
  }
];

/**
 * Resolves each slot's photographed pose index based on mirror settings.
 *
 * @param {Array<Object>} slots
 * @returns {{ slotPhotoIndices: number[], uniquePhotoCount: number }}
 */
export const resolveSlotsPhotoMapping = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return { slotPhotoIndices: [], uniquePhotoCount: 1 };
  }

  const slotPhotoIndices = new Array(slots.length).fill(null);
  let nextPose = 0;

  // Pass 1: Independent slots
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const m = s.mirrorFromSlot;
    const hasValidMirror =
      m !== undefined &&
      m !== null &&
      Number(m) >= 0 &&
      Number(m) < slots.length &&
      Number(m) !== i;

    if (!hasValidMirror) {
      if (typeof s.photoIndex === "number" && s.photoIndex >= 0) {
        slotPhotoIndices[i] = s.photoIndex;
        if (s.photoIndex >= nextPose) nextPose = s.photoIndex + 1;
      } else {
        slotPhotoIndices[i] = nextPose++;
      }
    }
  }

  // Pass 2: Mirrored slots (support chains without infinite loops)
  for (let i = 0; i < slots.length; i++) {
    if (slotPhotoIndices[i] === null) {
      const visited = new Set([i]);
      let target = Number(slots[i].mirrorFromSlot);
      while (
        target >= 0 &&
        target < slots.length &&
        !visited.has(target) &&
        slotPhotoIndices[target] === null
      ) {
        visited.add(target);
        target = Number(slots[target].mirrorFromSlot);
      }

      if (
        target >= 0 &&
        target < slots.length &&
        slotPhotoIndices[target] !== null
      ) {
        slotPhotoIndices[i] = slotPhotoIndices[target];
      } else {
        // Break cyclic / unresolved reference
        slotPhotoIndices[i] = nextPose++;
      }
    }
  }

  const uniquePhotos = new Set(slotPhotoIndices.filter((idx) => idx !== null));
  return {
    slotPhotoIndices,
    uniquePhotoCount: Math.max(1, uniquePhotos.size)
  };
};
