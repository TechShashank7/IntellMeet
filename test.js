import mongoose from 'mongoose';
import Session from './backend/src/models/Session.js';
import ActionItem from './backend/src/models/ActionItem.js';
mongoose.connect('mongodb://localhost:27017/intellmeet').then(async () => {
  const s = await Session.findOne({ 'actionItems.0': { $exists: true } }).populate('actionItems');
  if (s && s.actionItems.length > 0) {
    console.log("Raw object from populate:", s.actionItems[0]);
    console.log("After toObject:", s.actionItems[0].toObject ? s.actionItems[0].toObject() : s.actionItems[0]);
  } else {
    console.log("No session found with action items.");
  }
  process.exit(0);
}).catch(console.error);
