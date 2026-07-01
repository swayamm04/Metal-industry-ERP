const express = require('express');
const router = express.Router();
const {
    createAdjustmentNote,
    getAdjustmentNotes,
    getAdjustmentNoteById,
    deleteAdjustmentNote
} = require('../controllers/adjustmentNoteController');
const { protect } = require('../middleware/authMiddleware');

router.route('/')
    .get(protect, getAdjustmentNotes)
    .post(protect, createAdjustmentNote);

router.route('/:id')
    .get(protect, getAdjustmentNoteById)
    .delete(protect, deleteAdjustmentNote);

module.exports = router;
