import express from 'express';
import eventServicePkg from '../services/eventService.js';

const eventService = eventServicePkg.default || eventServicePkg;
const {
  listEvents,
  getEventByIdOrSlug,
  createEvent,
  updateEvent,
  deleteEvent
} = eventService;

const router = express.Router();

// GET /api/events - List events (supports ?status= filter)
router.get('/', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
  });

  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const events = await listEvents(filter);

    return res.json({
      success: true,
      total: events.length,
      events
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to list events'
    });
  }
});

// GET /api/events/:idOrSlug - Get event by ID or slug
router.get('/:idOrSlug', async (req, res) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0'
  });

  try {
    const { idOrSlug } = req.params;
    const event = await getEventByIdOrSlug(idOrSlug);

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.json({
      success: true,
      event
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to get event'
    });
  }
});

// POST /api/events - Create new event
router.post('/', async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        error: 'Event name is required'
      });
    }

    const created = await createEvent(req.body);
    return res.status(201).json({
      success: true,
      event: created
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to create event'
    });
  }
});

// PUT /api/events/:id - Update existing event
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateEvent(id, req.body || {});

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.json({
      success: true,
      event: updated
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to update event'
    });
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteEvent(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    return res.json({
      success: true,
      message: 'Event deleted successfully',
      event: deleted
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to delete event'
    });
  }
});

export default router;
