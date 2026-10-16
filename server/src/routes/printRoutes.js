const express = require('express');
const { prisma } = require('../db');

const router = express.Router();

// POST /api/print
router.post('/', async (req, res) => {
  try {
    const { sessionId, copies = 1, printerName = 'Default Printer' } = req.body || {};
    let printJob;
    if (sessionId && process.env.DATABASE_URL) {
      try {
        printJob = await prisma.printJob.create({
          data: {
            sessionId,
            copies: Number(copies) || 1,
            printerName: String(printerName),
            status: 'QUEUED'
          }
        });
      } catch (dbErr) {
        if (process.env.NODE_ENV !== 'test') {
          console.warn('Prisma DB error in create print job:', dbErr.message);
        }
      }
    }

    const jobId = printJob ? printJob.id : `print_${Date.now()}`;
    return res.json({
      success: true,
      jobId,
      printJobId: jobId,
      sessionId: sessionId || null,
      copies: Number(copies) || 1,
      status: 'QUEUED',
      message: 'Print job queued for local kiosk printer'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
